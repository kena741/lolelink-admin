import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import { walletTransactionMagnitude } from '../src/lib/wallet-transaction-metrics';
import { computePercentCommissionFee } from '../src/lib/booking-admin-commission';
import { computeProviderPayoutWithPercent } from '../src/lib/booking-completion-payout';

function readArg(prefix: string, fallback = ''): string {
    const flag = process.argv.find((arg) => arg.startsWith(`${prefix}=`));
    return flag ? flag.slice(prefix.length + 1).trim() : fallback;
}

function ledgerNet(
    rows: { amount: string | number | null; isCredit: boolean | null }[]
): number {
    return rows.reduce((sum, row) => {
        const magnitude = walletTransactionMagnitude(row.amount);
        return row.isCredit === true ? sum + magnitude : sum - magnitude;
    }, 0);
}

async function main(): Promise<void> {
    loadEnvLocal();

    const dryRun = process.argv.includes('--dry-run');
    const apply = process.argv.includes('--apply');
    const bookingId = readArg('--booking-id');
    const commissionPercent = Number(readArg('--percent', '7'));

    if (!bookingId) {
        console.error('Pass --booking-id=<uuid>');
        process.exit(1);
    }
    if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
        console.error('Invalid --percent');
        process.exit(1);
    }
    if (!dryRun && !apply) {
        console.log('Pass --dry-run to preview or --apply to execute.');
        process.exit(0);
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing Supabase env');
        process.exit(1);
    }

    const admin = createClient(url, key);
    const adjustmentTxId = `commission-adjustment-${bookingId}`;

    const { data: booking, error: bookingError } = await admin
        .from('booked_service')
        .select('id, provider_id, totalAmount, price, adminCommission, status, paymentType, serviceName')
        .eq('id', bookingId)
        .maybeSingle();

    if (bookingError || !booking) {
        console.error('Booking not found:', bookingError?.message);
        process.exit(1);
    }

    const providerId = String(booking.provider_id ?? '').trim();
    if (!providerId) {
        console.error('Booking has no provider');
        process.exit(1);
    }

    const gross = Number(booking.totalAmount ?? booking.price ?? 0);
    if (!(gross > 0)) {
        console.error('Invalid booking gross amount');
        process.exit(1);
    }

    const expectedPayout = computeProviderPayoutWithPercent(gross, commissionPercent);
    const expectedFee = computePercentCommissionFee(gross, commissionPercent);

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
        console.error('No provider payout credit found for this booking.');
        process.exit(1);
    }

    const creditedAmount = walletTransactionMagnitude(payoutCredit.amount);
    const adjustmentAmount = Math.round((creditedAmount - expectedPayout) * 100) / 100;

    if (!(adjustmentAmount > 0)) {
        console.log('No adjustment needed. Credited:', creditedAmount, 'Expected:', expectedPayout);
        return;
    }

    const { data: existingAdjustment } = await admin
        .from('wallet_transaction')
        .select('id, amount')
        .eq('userId', providerId)
        .eq('transactionId', adjustmentTxId)
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

    const { data: allTx, error: txError } = await admin
        .from('wallet_transaction')
        .select('id, amount, isCredit')
        .eq('userId', providerId);

    if (txError) {
        console.error(txError.message);
        process.exit(1);
    }

    const storedBefore = walletTransactionMagnitude(provider.walletAmount);
    const ledgerBefore = Math.round(ledgerNet(allTx ?? []) * 100) / 100;
    const storedAfter = Math.round((storedBefore - adjustmentAmount) * 100) / 100;
    const ledgerAfter = Math.round((ledgerBefore - adjustmentAmount) * 100) / 100;
    const adjustmentNote = `Admin adjustment: ${commissionPercent}% platform fee for booking ${bookingId}`;

    console.log('Booking:', bookingId, '|', booking.serviceName);
    console.log('  gross:', gross.toFixed(2), '| status:', booking.status);
    console.log('Provider:', provider.email);
    console.log('Payout credit:', creditedAmount.toFixed(2), '| note:', payoutCredit.note);
    console.log(`Target payout (${commissionPercent}% fee):`, expectedPayout.toFixed(2), '| fee:', expectedFee.toFixed(2));
    console.log('Adjustment debit:', adjustmentAmount.toFixed(2));
    console.log('Existing adjustment:', existingAdjustment ? existingAdjustment.id : 'none');
    console.log('');
    console.log('walletAmount:', storedBefore.toFixed(2), '→', storedAfter.toFixed(2));
    console.log('ledger net:', ledgerBefore.toFixed(2), '→', ledgerAfter.toFixed(2));
    console.log('adminCommission on booking:', booking.adminCommission ?? 'null', '→', expectedFee.toFixed(2));

    if (existingAdjustment) {
        console.log('\nAdjustment already exists. Nothing to do.');
        return;
    }

    if (dryRun) {
        console.log('\nDry run only. Pass --apply to insert adjustment and sync wallet.');
        return;
    }

    const now = new Date().toISOString();
    const { error: insertError } = await admin.from('wallet_transaction').insert({
        amount: adjustmentAmount.toFixed(2),
        createdDate: now,
        isCredit: false,
        note: adjustmentNote,
        paymentType: 'admin',
        transactionId: adjustmentTxId,
        type: 'provider',
        userId: providerId,
        provider_id: null,
        customer_id: null,
    });

    if (insertError) {
        console.error('Failed to insert adjustment:', insertError.message);
        process.exit(1);
    }

    const { error: walletUpdateError } = await admin
        .from('provider')
        .update({ walletAmount: storedAfter.toFixed(2) })
        .eq('id', providerId);

    if (walletUpdateError) {
        console.error('Adjustment inserted but wallet sync failed:', walletUpdateError.message);
        process.exit(1);
    }

    const { error: bookingUpdateError } = await admin
        .from('booked_service')
        .update({ adminCommission: expectedFee.toFixed(2) })
        .eq('id', bookingId);

    if (bookingUpdateError) {
        console.error('Wallet fixed but booking adminCommission update failed:', bookingUpdateError.message);
        process.exit(1);
    }

    console.log('\nDone. Applied 7% commission correction.');
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
