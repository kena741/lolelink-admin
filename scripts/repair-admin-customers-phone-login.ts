/**
 * One-shot: admin-created customers with null email cannot log in on mobile
 * (app does phone → customer.email → email/password). Backfill email + auth.
 *
 *   pnpm tsx scripts/repair-admin-customers-phone-login.ts
 */
import { createClient } from '@supabase/supabase-js';
import { resolveCustomerLoginEmail } from '../src/lib/customer-phone-login';
import { loadEnvLocal } from './lib/load-env-local';

loadEnvLocal();

async function main() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase URL / service role key');

    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: rows, error } = await admin
        .from('customer')
        .select('id, user_id, phone, email, first_name, signup_source')
        .eq('signup_source', 'admin')
        .or('email.is.null,email.eq.');

    if (error) throw error;
    const list = rows ?? [];
    if (list.length === 0) {
        console.log('No admin customers missing email.');
        return;
    }

    console.log(`Repairing ${list.length} customer(s)…`);
    for (const row of list) {
        const resolved = resolveCustomerLoginEmail(null, String(row.phone ?? ''));
        if (!resolved) {
            console.warn(`skip ${row.id} bad phone=${row.phone}`);
            continue;
        }
        const { email, localPhone } = resolved;
        const { error: authError } = await admin.auth.admin.updateUserById(String(row.user_id), {
            email,
            email_confirm: true,
            phone: `251${localPhone}`,
            phone_confirm: true,
        });
        if (authError) {
            console.warn(`auth fail ${row.first_name}: ${authError.message}`);
            continue;
        }
        const { error: rowError } = await admin
            .from('customer')
            .update({ email, phone: localPhone, login_type: 'email' })
            .eq('id', row.id);
        if (rowError) {
            console.warn(`row fail ${row.first_name}: ${rowError.message}`);
            continue;
        }
        console.log(`ok ${row.first_name} → ${email}`);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
