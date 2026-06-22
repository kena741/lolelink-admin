import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';

const BOOKING_IDS = [
    '3046c200-d206-4428-be79-8b23b39999a6',
    '86256d21-93d7-47e2-b618-2fde3405ae2f',
    '8725ce4a-17ad-4db3-a788-b055c16a28f4',
    '6069374c-28cb-40d4-830c-3e6c0d9a12e5',
] as const;

const CUSTOMER_ID = '8a8f7b79-d371-4a7e-b140-162da35cc5cc';
const FEE_PER_BOOKING = 177.92;

async function main(): Promise<void> {
    loadEnvLocal();

    const dryRun = process.argv.includes('--dry-run');
    const apply = process.argv.includes('--apply');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing Supabase env');
        process.exit(1);
    }

    const admin = createClient(url, key);

    const { data: bookings, error: bookingsError } = await admin
        .from('booked_service')
        .select('id, totalAmount, status, payment_status, paymentCompleted, email, createdAt')
        .in('id', [...BOOKING_IDS]);

    if (bookingsError) {
        console.error(bookingsError.message);
        process.exit(1);
    }

    const { data: debits, error: debitsError } = await admin
        .from('wallet_transaction')
        .select('id, amount, transactionId, userId, note')
        .in('transactionId', [...BOOKING_IDS])
        .eq('isCredit', false);

    if (debitsError) {
        console.error(debitsError.message);
        process.exit(1);
    }

    const { data: customer, error: customerError } = await admin
        .from('customer')
        .select('id, wallet_amount, email')
        .eq('id', CUSTOMER_ID)
        .maybeSingle();

    if (customerError || !customer) {
        console.error('Customer not found:', customerError?.message);
        process.exit(1);
    }

    console.log('Bookings to delete:', (bookings ?? []).length);
    for (const booking of bookings ?? []) {
        console.log(`  ${booking.id} | ${booking.payment_status} | ${booking.status} | ${booking.createdAt}`);
    }
    console.log('Wallet debits to delete:', (debits ?? []).length, '| total', refundTotal.toFixed(2));
    for (const debit of debits ?? []) {
        console.log(`  ${debit.id} | booking ${debit.transactionId} | ${debit.amount}`);
    }
    console.log(`Customer ${customer.email} wallet_amount: ${Number(customer.wallet_amount ?? 0).toFixed(2)} (unchanged — no refund credit)`);

    if (dryRun || !apply) {
        console.log(dryRun ? '\nDry run.' : '\nPass --apply to execute.');
        return;
    }

    for (const bookingId of BOOKING_IDS) {
        await admin.from('notification').delete().eq('booking_id', bookingId);
        await admin.from('payments').delete().eq('booking_id', bookingId);
    }

    const debitIds = (debits ?? []).map((row) => row.id);
    if (debitIds.length > 0) {
        const { error } = await admin.from('wallet_transaction').delete().in('id', debitIds);
        if (error) {
            console.error('Failed to delete wallet debits:', error.message);
            process.exit(1);
        }
    }

    const { error: deleteBookingsError } = await admin
        .from('booked_service')
        .delete()
        .in('id', [...BOOKING_IDS]);

    if (deleteBookingsError) {
        console.error('Failed to delete bookings:', deleteBookingsError.message);
        process.exit(1);
    }

    console.log('\nDone. Removed 4 bookings and deleted fee debits (no wallet refund credit).');
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
