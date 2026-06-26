import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';

interface BookingRow {
    id: string;
    provider_id: string;
    customer_id: string | null;
    provider_user_id: string | null;
    customer_user_id: string | null;
}

function readId(value: unknown): string {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
}

async function main(): Promise<void> {
    loadEnvLocal();

    const dryRun = !process.argv.includes('--apply');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing Supabase env');
        process.exit(1);
    }

    const admin = createClient(url, key);
    const [{ data: bookings }, { data: providers }, { data: customers }] = await Promise.all([
        admin
            .from('booked_service')
            .select('id, provider_id, customer_id, provider_user_id, customer_user_id'),
        admin.from('provider').select('id, user_id'),
        admin.from('customer').select('id, user_id'),
    ]);

    const providerAuthByProfileId = new Map<string, string>();
    for (const provider of providers ?? []) {
        const profileId = readId(provider.id);
        const authUserId = readId(provider.user_id);
        if (profileId && authUserId) {
            providerAuthByProfileId.set(profileId, authUserId);
        }
    }

    const customerAuthByProfileId = new Map<string, string>();
    for (const customer of customers ?? []) {
        const profileId = readId(customer.id);
        const authUserId = readId(customer.user_id);
        if (profileId && authUserId) {
            customerAuthByProfileId.set(profileId, authUserId);
        }
    }

    const updates: Array<{
        id: string;
        provider_user_id: string | null;
        customer_user_id: string | null;
    }> = [];

    let missingProviderAuth = 0;
    let missingCustomerAuth = 0;

    for (const booking of (bookings ?? []) as BookingRow[]) {
        const providerAuthUserId = providerAuthByProfileId.get(booking.provider_id) ?? null;
        const customerAuthUserId = booking.customer_id
            ? customerAuthByProfileId.get(booking.customer_id) ?? null
            : null;

        if (!providerAuthUserId) missingProviderAuth += 1;
        if (booking.customer_id && !customerAuthUserId) missingCustomerAuth += 1;

        const nextProviderUserId = providerAuthUserId;
        const nextCustomerUserId = customerAuthUserId;

        const providerChanged = booking.provider_user_id !== nextProviderUserId;
        const customerChanged = booking.customer_user_id !== nextCustomerUserId;
        if (!providerChanged && !customerChanged) continue;

        updates.push({
            id: booking.id,
            provider_user_id: nextProviderUserId,
            customer_user_id: nextCustomerUserId,
        });
    }

    console.log(`${dryRun ? 'Would update' : 'Updating'} ${updates.length} booked_service row(s)`);
    console.log(`Bookings missing provider auth user_id: ${missingProviderAuth}`);
    console.log(`Bookings with customer but missing customer auth user_id: ${missingCustomerAuth}`);

    for (const update of updates) {
        console.log(
            `  ${update.id} | provider_user_id=${update.provider_user_id ?? '—'} | customer_user_id=${update.customer_user_id ?? '—'}`
        );
        if (!dryRun) {
            const { error } = await admin
                .from('booked_service')
                .update({
                    provider_user_id: update.provider_user_id,
                    customer_user_id: update.customer_user_id,
                })
                .eq('id', update.id);

            if (error) {
                console.error(`Failed ${update.id}: ${error.message}`);
                process.exit(1);
            }
        }
    }

    if (dryRun) {
        console.log('\nRun the SQL migration first if columns do not exist:');
        console.log('  scripts/sql/add-booked-service-auth-user-ids.sql');
        console.log('\nRe-run with --apply to write changes.');
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
