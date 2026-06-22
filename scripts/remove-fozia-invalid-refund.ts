import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import { walletTransactionMagnitude } from '../src/lib/wallet-transaction-metrics';

const CUSTOMER_ID = '8a8f7b79-d371-4a7e-b140-162da35cc5cc';
const REFUND_NOTE = 'Reversal: removed 4 invalid self-bookings (service fees refunded)';

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

    const { data: refundRows, error: refundError } = await admin
        .from('wallet_transaction')
        .select('id, amount, note, transactionId, userId')
        .eq('userId', CUSTOMER_ID)
        .eq('note', REFUND_NOTE);

    if (refundError) {
        console.error(refundError.message);
        process.exit(1);
    }

    const { data: customer, error: customerError } = await admin
        .from('customer')
        .select('id, email, wallet_amount')
        .eq('id', CUSTOMER_ID)
        .maybeSingle();

    if (customerError || !customer) {
        console.error('Customer not found:', customerError?.message);
        process.exit(1);
    }

    const { data: allCustomerRows, error: rowsError } = await admin
        .from('wallet_transaction')
        .select('id, userId, amount, isCredit, note')
        .eq('userId', CUSTOMER_ID);

    if (rowsError) {
        console.error(rowsError.message);
        process.exit(1);
    }

    const refundTotal = (refundRows ?? []).reduce(
        (sum, row) => sum + walletTransactionMagnitude(row.amount),
        0
    );
    const currentWallet = Number(customer.wallet_amount ?? 0);
    const rowsAfterRemoval = (allCustomerRows ?? []).filter(
        (row) => !(refundRows ?? []).some((refund) => refund.id === row.id)
    );
    const ledgerNet = Math.round(ledgerNetForUser(rowsAfterRemoval, CUSTOMER_ID) * 100) / 100;

    console.log(`Customer: ${customer.email}`);
    console.log(`Refund rows to delete: ${(refundRows ?? []).length} | ETB ${refundTotal.toFixed(2)}`);
    for (const row of refundRows ?? []) {
        console.log(`  ${row.id} | ${row.transactionId} | ${row.amount}`);
    }
    console.log(`wallet_amount: ${currentWallet.toFixed(2)} → ${ledgerNet.toFixed(2)} (sync to ledger)`);

    if ((refundRows ?? []).length === 0) {
        console.log('\nNo invalid refund row found. Nothing to do.');
        return;
    }

    if (dryRun || !apply) {
        console.log(dryRun ? '\nDry run.' : '\nPass --apply to execute.');
        return;
    }

    const refundIds = (refundRows ?? []).map((row) => row.id);
    const { error: deleteError } = await admin.from('wallet_transaction').delete().in('id', refundIds);
    if (deleteError) {
        console.error('Failed to delete refund row:', deleteError.message);
        process.exit(1);
    }

    const { error: walletUpdateError } = await admin
        .from('customer')
        .update({ wallet_amount: ledgerNet })
        .eq('id', CUSTOMER_ID);

    if (walletUpdateError) {
        console.error('Failed to update customer wallet:', walletUpdateError.message);
        process.exit(1);
    }

    console.log('\nDone. Removed invalid refund credit and synced customer wallet to ledger.');
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
