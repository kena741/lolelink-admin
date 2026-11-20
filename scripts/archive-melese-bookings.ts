/**
 * Soft-archive Melese Customer + Melese Provider bookings.
 *
 *   npx tsx scripts/archive-melese-bookings.ts
 *   npx tsx scripts/archive-melese-bookings.ts --apply
 */

import { createClient } from '@supabase/supabase-js';
import {
    BOOKING_AUTO_ARCHIVE_NOTE,
    BOOKING_AUTO_ARCHIVE_CUSTOMER_IDS,
    BOOKING_AUTO_ARCHIVE_PROVIDER_IDS,
} from '../src/lib/booking-auto-archive';
import { loadEnvLocal } from './lib/load-env-local';

const CUSTOMER_ID = 'e626b0bc-d085-4038-aa41-7ebf4de63019';
const PROVIDER_ID = '1a075e03-21b3-4cc9-9ce6-41e78b06c93b';
const DEFAULT_NOTE = 'Melese — archived';

function hasFlag(name: string): boolean {
    return process.argv.includes(name);
}

async function main(): Promise<void> {
    loadEnvLocal();

    const apply = hasFlag('--apply');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    // Sanity: Melese IDs must stay in the auto-archive allowlist.
    if (!(BOOKING_AUTO_ARCHIVE_CUSTOMER_IDS as readonly string[]).includes(CUSTOMER_ID)) {
        console.error('Melese customer missing from BOOKING_AUTO_ARCHIVE_CUSTOMER_IDS');
        process.exit(1);
    }
    if (!(BOOKING_AUTO_ARCHIVE_PROVIDER_IDS as readonly string[]).includes(PROVIDER_ID)) {
        console.error('Melese provider missing from BOOKING_AUTO_ARCHIVE_PROVIDER_IDS');
        process.exit(1);
    }

    const admin = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const selectCols =
        'id, status, payment_status, totalAmount, email, firstName, lastName, customer_id, provider_id, is_archived, archive_note, createdAt';

    const byId = new Map<string, Record<string, unknown>>();

    const { data: byCustomer, error: cErr } = await admin
        .from('booked_service')
        .select(selectCols)
        .eq('customer_id', CUSTOMER_ID);
    if (cErr) {
        console.error(cErr.message);
        process.exit(1);
    }
    for (const row of byCustomer ?? []) byId.set(row.id as string, row);

    const { data: byProvider, error: pErr } = await admin
        .from('booked_service')
        .select(selectCols)
        .eq('provider_id', PROVIDER_ID);
    if (pErr) {
        console.error(pErr.message);
        process.exit(1);
    }
    for (const row of byProvider ?? []) byId.set(row.id as string, row);

    const { data: byEmail, error: eErr } = await admin
        .from('booked_service')
        .select(selectCols)
        .or(
            'email.ilike.%meleseayen%,email.eq.miyemon960@lovadio.com,and(firstName.ilike.melese,lastName.ilike.customer),and(firstName.ilike.melese,lastName.ilike.ayen)'
        );
    if (eErr) {
        console.error(eErr.message);
        process.exit(1);
    }
    for (const row of byEmail ?? []) byId.set(row.id as string, row);

    const all = [...byId.values()];
    const toArchive = all.filter((b) => b.is_archived !== true);

    console.log(`Total Melese-related bookings: ${all.length}`);
    console.log(`Already archived: ${all.length - toArchive.length}`);
    console.log(`To archive: ${toArchive.length}`);
    console.log(`Note: "${DEFAULT_NOTE}" (auto note: "${BOOKING_AUTO_ARCHIVE_NOTE}")`);
    console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);

    for (const b of toArchive) {
        console.log(
            `  ${b.id} | ${b.status} | ${b.payment_status} | ${b.totalAmount} | ${b.email} | ${b.firstName} ${b.lastName} | ${b.createdAt}`
        );
    }

    if (!apply) {
        console.log('\nPass --apply to soft-archive.');
        return;
    }

    if (toArchive.length === 0) {
        console.log('\nNothing to update.');
        return;
    }

    const ids = toArchive.map((b) => b.id as string);
    const { data, error } = await admin
        .from('booked_service')
        .update({ is_archived: true, archive_note: DEFAULT_NOTE })
        .in('id', ids)
        .select('id');

    if (error) {
        console.error(error.message);
        process.exit(1);
    }

    console.log(`\nArchived ${data?.length ?? 0} booking(s).`);
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
