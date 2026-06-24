import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import { walletTransactionMagnitude } from '../src/lib/wallet-transaction-metrics';

const DEFAULT_BOOKING_ID = '40d11a98-bfc5-4f81-8689-da76f5567438';

function ledgerNetForUser(
    rows: { userId: string; amount: string | number | null; isCredit: boolean | null }[],
    userId: string
): number {
    return rows.reduce((sum, row) => {
        if (row.userId !== userId) return sum;
        const magnitude = walletTransactionMagnitude(row.amount);
        return row.isCredit === true ? sum + magnitude : sum - magnitude;
    }, 0);
}

function readBookingIdArg(): string {
    const flag = process.argv.find((arg) => arg.startsWith('--booking-id='));
    if (flag) return flag.slice('--booking-id='.length).trim();
    return DEFAULT_BOOKING_ID;
}

async function main(): Promise<void> {
    loadEnvLocal();

    const dryRun = process.argv.includes('--dry-run');
    const apply = process.argv.includes('--apply');
    const bookingId = readBookingIdArg();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing Supabase env');
        process.exit(1);
    }

    if (!dryRun && !apply) {
        console.log('Pass --dry-run to preview or --apply to execute.');
        process.exit(0);
    }

    const admin = createClient(url, key);

    const { data: booking, error: bookingError } = await admin
        .from('booked_service')
        .select('id, provider_id, customer_id, totalAmount, subTotal, status, paymentType')
        .eq('id', bookingId)
        .maybeSingle();

    if (bookingError || !booking) {
        console.error('Booking not found:', bookingError?.message);
        process.exit(1);
    }

    const providerId = booking.provider_id as string;
    const reversalNote = `Admin reversal: erroneous completion payout for booking ${bookingId}`;
    const reversalTxId = `reversal-payout-${bookingId}`;

    const { data: payoutCredit, error: payoutError } = await admin
        .from('wallet_transaction')
        .select('id, amount, isCredit, note, transactionId')
        .eq('userId', providerId)
        .eq('transactionId', bookingId)
        .eq('isCredit', true)
        .maybeSingle();

    if (payoutError) {
        console.error(payoutError.message);
        process.exit(1);
    }

    if (!payoutCredit) {
        console.error('No provider payout credit found for this booking transactionId.');
        process.exit(1);
    }

    const payoutAmount = walletTransactionMagnitude(payoutCredit.amount);

    const { data: existingReversal } = await admin
        .from('wallet_transaction')
        .select('id, amount')
        .eq('userId', providerId)
        .eq('transactionId', reversalTxId)
        .maybeSingle();

    const { data: provider, error: providerError } = await admin
        .from('provider')
        .select('id, email, walletAmount')
        .eq('id', providerId)
        .maybeSingle();

    if (providerError || !provider) {
        console.error('Provider not found:', providerError?.message);
        process.exit(1);
    }

    const { data: allProviderTx, error: txError } = await admin
        .from('wallet_transaction')
        .select('id, userId, amount, isCredit')
        .eq('userId', providerId);

    if (txError) {
        console.error(txError.message);
        process.exit(1);
    }

    const storedWallet = Number(provider.walletAmount ?? 0);
    const ledgerBefore = Math.round(ledgerNetForUser(allProviderTx ?? [], providerId) * 100) / 100;
    const ledgerAfter = Math.round((ledgerBefore - payoutAmount) * 100) / 100;

    console.log('Booking:', bookingId);
    console.log('  status:', booking.status, '| totalAmount:', booking.totalAmount, '| payment:', booking.paymentType);
    console.log('Provider:', provider.email, providerId);
    console.log('Erroneous payout credit:', payoutCredit.id, '| ETB', payoutAmount.toFixed(2));
    console.log('  note:', payoutCredit.note);
    console.log('Existing reversal:', existingReversal ? existingReversal.id : 'none');
    console.log('');
    console.log('Provider walletAmount:', storedWallet.toFixed(2), '→', ledgerAfter.toFixed(2));
    console.log('Ledger net:', ledgerBefore.toFixed(2), '→', ledgerAfter.toFixed(2));
    console.log('Reversal debit:', payoutAmount.toFixed(2), '|', reversalNote);

    if (existingReversal) {
        console.log('\nReversal already exists. Nothing to do.');
        return;
    }

    if (dryRun) {
        console.log('\nDry run only. Pass --apply to insert reversal debit and sync provider wallet.');
        return;
    }

    const now = new Date().toISOString();
    const { error: insertError } = await admin.from('wallet_transaction').insert({
        amount: payoutAmount.toFixed(2),
        createdDate: now,
        isCredit: false,
        note: reversalNote,
        paymentType: 'admin',
        transactionId: reversalTxId,
        type: 'provider',
        userId: providerId,
    });

    if (insertError) {
        console.error('Failed to insert reversal:', insertError.message);
        process.exit(1);
    }

    const { error: walletUpdateError } = await admin
        .from('provider')
        .update({ walletAmount: ledgerAfter.toFixed(2) })
        .eq('id', providerId);

    if (walletUpdateError) {
        console.error('Reversal inserted but wallet sync failed:', walletUpdateError.message);
        process.exit(1);
    }

    console.log('\nDone. Erroneous payout reversed; provider wallet synced to ledger.');
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
