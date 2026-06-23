import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import { walletTransactionMagnitude } from '../src/lib/wallet-transaction-metrics';

const CUSTOMER_ID = '8a8f7b79-d371-4a7e-b140-162da35cc5cc';
const TARGET_BALANCE = 0.95;
const INVALID_BACKFILL_ROW_ID = '5b375951-9d32-4f4a-96f3-91d79a5470f3';
const INVALID_BACKFILL_TX = 'svc_a21a90efc8_1781775264064_APJ7ZD';
const CORRECTION_TX = `wallet-correction-${CUSTOMER_ID.slice(0, 8)}-095`;

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

    const { data: customer, error: customerError } = await admin
        .from('customer')
        .select('id, email, wallet_amount')
        .eq('id', CUSTOMER_ID)
        .maybeSingle();

    if (customerError || !customer) {
        console.error('Customer not found:', customerError?.message);
        process.exit(1);
    }

    const { data: rows, error: rowsError } = await admin
        .from('wallet_transaction')
        .select('id, userId, amount, isCredit, note, transactionId, paymentType, type, createdDate')
        .eq('userId', CUSTOMER_ID)
        .order('createdDate', { ascending: true });

    if (rowsError) {
        console.error(rowsError.message);
        process.exit(1);
    }

    const allRows = rows ?? [];
    const invalidRow = allRows.find((row) => row.id === INVALID_BACKFILL_ROW_ID);
    const rowsAfterInvalidRemoval = allRows.filter((row) => row.id !== INVALID_BACKFILL_ROW_ID);
    const netAfterRemoval = Math.round(ledgerNetForUser(rowsAfterInvalidRemoval, CUSTOMER_ID) * 100) / 100;

    const { data: existingCorrection } = await admin
        .from('wallet_transaction')
        .select('id, amount')
        .eq('transactionId', CORRECTION_TX)
        .maybeSingle();

    console.log(`Customer: ${customer.email}`);
    console.log(`Current wallet_amount: ${Number(customer.wallet_amount ?? 0).toFixed(2)}`);
    console.log(`Target wallet_amount: ${TARGET_BALANCE.toFixed(2)}`);
    console.log('');

    if (invalidRow) {
        console.log(
            `DELETE invalid Chapa backfill | ${invalidRow.id} | ETB ${walletTransactionMagnitude(invalidRow.amount).toFixed(2)} | ${invalidRow.transactionId}`
        );
    } else {
        console.log('Invalid backfill row already removed:', INVALID_BACKFILL_ROW_ID);
    }

    console.log(`Ledger after removal: ETB ${netAfterRemoval.toFixed(2)}`);

    const needsCorrection = Math.abs(netAfterRemoval - TARGET_BALANCE) > 0.005;
    if (needsCorrection && !existingCorrection) {
        console.log(
            `INSERT correction credit | ETB ${TARGET_BALANCE.toFixed(2)} | tx ${CORRECTION_TX}`
        );
    } else if (existingCorrection) {
        console.log(`Correction row exists: ${existingCorrection.id} | ETB ${existingCorrection.amount}`);
    } else {
        console.log('Ledger already matches target after invalid row removal.');
    }

    const finalLedger = existingCorrection
        ? netAfterRemoval
        : needsCorrection
          ? TARGET_BALANCE
          : netAfterRemoval;

    console.log(`Final wallet_amount: ${Number(customer.wallet_amount ?? 0).toFixed(2)} → ${finalLedger.toFixed(2)}`);

    if (dryRun || !apply) {
        console.log(dryRun ? '\nDry run.' : '\nPass --apply to execute.');
        return;
    }

    if (invalidRow) {
        const { error: deleteError } = await admin
            .from('wallet_transaction')
            .delete()
            .eq('id', INVALID_BACKFILL_ROW_ID)
            .eq('transactionId', INVALID_BACKFILL_TX);

        if (deleteError) {
            console.error('Failed to delete invalid backfill:', deleteError.message);
            process.exit(1);
        }
    }

    if (needsCorrection && !existingCorrection) {
        const { error: insertError } = await admin.from('wallet_transaction').insert({
            amount: TARGET_BALANCE.toFixed(2),
            createdDate: new Date().toISOString(),
            isCredit: true,
            note: 'Wallet balance correction after invalid Chapa booking backfill removed (verified ETB 0.95)',
            paymentType: 'wallet',
            transactionId: CORRECTION_TX,
            type: 'customer',
            userId: CUSTOMER_ID,
        });

        if (insertError) {
            console.error('Failed to insert correction:', insertError.message);
            process.exit(1);
        }
    }

    const { data: finalRows } = await admin
        .from('wallet_transaction')
        .select('id, userId, amount, isCredit')
        .eq('userId', CUSTOMER_ID);

    const syncedLedger = Math.round(ledgerNetForUser(finalRows ?? [], CUSTOMER_ID) * 100) / 100;

    const { error: walletUpdateError } = await admin
        .from('customer')
        .update({ wallet_amount: syncedLedger.toFixed(2) })
        .eq('id', CUSTOMER_ID);

    if (walletUpdateError) {
        console.error('Failed to update customer wallet:', walletUpdateError.message);
        process.exit(1);
    }

    console.log('\nDone. Customer wallet synced to ETB', syncedLedger.toFixed(2));
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
