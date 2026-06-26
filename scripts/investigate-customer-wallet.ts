import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import { walletTransactionMagnitude } from '../src/lib/wallet-transaction-metrics';

async function main(): Promise<void> {
    loadEnvLocal();

    const email = process.argv[2] ?? 'foziakassa@gmail.com';
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing Supabase env');
        process.exit(1);
    }

    const admin = createClient(url, key);
    const { data: customer } = await admin.from('customer').select('*').eq('email', email).maybeSingle();
    if (!customer) {
        console.error('Customer not found');
        process.exit(1);
    }

    const authId = String(customer.user_id ?? customer.id);
    console.log(`customer=${customer.id} auth=${authId} stored=${customer.wallet_amount}`);

    const { data: rows } = await admin
        .from('wallet_transaction')
        .select('id, createdDate, isCredit, amount, type, paymentType, transactionId, note')
        .eq('userId', authId)
        .order('createdDate', { ascending: true });

    let net = 0;
    let totalCredits = 0;
    let totalDebits = 0;
    console.log(`\nWALLET ROWS (${rows?.length ?? 0}):`);
    for (const row of rows ?? []) {
        const magnitude = walletTransactionMagnitude(row.amount);
        const delta = row.isCredit === true ? magnitude : -magnitude;
        net += delta;
        if (row.isCredit === true) totalCredits += magnitude;
        else totalDebits += magnitude;
        console.log(
            `${row.createdDate?.slice(0, 19)} | ${row.isCredit ? 'CR' : 'DR'} ${magnitude.toFixed(2)} | bal ${net.toFixed(2)} | ${row.paymentType} | ${(row.note ?? '').slice(0, 65)}`
        );
    }
    console.log(`\nCredits ${totalCredits.toFixed(2)} | Debits ${totalDebits.toFixed(2)} | Net ${net.toFixed(2)}`);

    const { data: bookings } = await admin
        .from('booked_service')
        .select('id, status, payment_status, paymentType, paymentCompleted, totalAmount, price, createdAt')
        .eq('customer_id', customer.id)
        .order('createdAt', { ascending: false });

    console.log(`\nBOOKINGS (${bookings?.length ?? 0}):`);
    for (const booking of bookings ?? []) {
        const amount = booking.totalAmount ?? booking.price ?? '0';
        console.log(
            `${String(booking.id).slice(0, 8)} | ${booking.status} | ${booking.payment_status} | ${booking.paymentType} | paid=${booking.paymentCompleted} | ${amount}`
        );
    }

    const bookingIds = new Set((bookings ?? []).map((b) => String(b.id).toLowerCase()));
    const walletBookingIds = new Set(
        (rows ?? [])
            .map((r) => String(r.transactionId ?? '').toLowerCase())
            .filter((id) => bookingIds.has(id))
    );

    const paidBookings = (bookings ?? []).filter(
        (b) => b.paymentCompleted === true || String(b.payment_status).includes('completed')
    );

    console.log(`\nPaid/completed bookings: ${paidBookings.length}`);
    console.log(`Bookings with wallet_transaction row: ${walletBookingIds.size}`);

    const feeDebitsWithoutRefund = (rows ?? []).filter((row) => {
        if (row.isCredit === true) return false;
        const note = (row.note ?? '').toLowerCase();
        if (!note.includes('fee')) return false;
        const txId = String(row.transactionId ?? '').toLowerCase();
        const hasRefund = (rows ?? []).some((other) => {
            if (other.isCredit !== true) return false;
            if (String(other.transactionId ?? '').toLowerCase() !== txId) return false;
            return (other.note ?? '').toLowerCase().includes('refund');
        });
        return !hasRefund;
    });

    if (feeDebitsWithoutRefund.length > 0) {
        console.log(`\nFee debits with NO matching refund (${feeDebitsWithoutRefund.length}):`);
        for (const row of feeDebitsWithoutRefund) {
            console.log(`  ${walletTransactionMagnitude(row.amount).toFixed(2)} | ${row.transactionId?.slice(0, 8)} | ${row.note}`);
        }
    }

    const chapaFeeDebits = (rows ?? []).filter(
        (row) =>
            row.isCredit !== true
            && String(row.paymentType ?? '').toLowerCase() === 'chapa'
            && (row.note ?? '').toLowerCase().includes('fee')
    );
    if (chapaFeeDebits.length > 0) {
        const chapaFeeTotal = chapaFeeDebits.reduce((s, r) => s + walletTransactionMagnitude(r.amount), 0);
        console.log(`\nChapa fee debits from wallet (likely wrong — paid via Chapa, not wallet): ${chapaFeeTotal.toFixed(2)} ETB across ${chapaFeeDebits.length} rows`);
        for (const row of chapaFeeDebits) {
            console.log(`  ${walletTransactionMagnitude(row.amount).toFixed(2)} | ${row.transactionId?.slice(0, 8)} | ${row.note}`);
        }
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
