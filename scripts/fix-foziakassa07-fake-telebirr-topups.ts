import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import { walletTransactionMagnitude } from '../src/lib/wallet-transaction-metrics';

const CUSTOMER_ID = '8a8f7b79-d371-4a7e-b140-162da35cc5cc';
const FAKE_TX_REFS = [
    'web1792396205358t9tpfd7z',
    'web17923977101876si4ghah',
    'web179239781198276o9h5jv',
] as const;

interface WalletRow {
    id: string;
    userId: string;
    amount: string | number | null;
    isCredit: boolean | null;
    note: string | null;
    transactionId: string | null;
    paymentType: string | null;
    createdDate: string | null;
}

function mag(amount: string | number | null): number {
    return walletTransactionMagnitude(amount);
}

function ledgerNet(rows: WalletRow[]): number {
    const net = rows.reduce((sum, row) => {
        const amount = mag(row.amount);
        return row.isCredit === true ? sum + amount : sum - amount;
    }, 0);
    return Math.round(net * 100) / 100;
}

async function main(): Promise<void> {
    loadEnvLocal();

    const dryRun = process.argv.includes('--dry-run');
    const apply = process.argv.includes('--apply');
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
        .select('id, userId, amount, isCredit, note, transactionId, paymentType, createdDate')
        .eq('userId', CUSTOMER_ID)
        .order('createdDate', { ascending: true });

    if (rowsError) {
        console.error(rowsError.message);
        process.exit(1);
    }

    const allRows = (rows ?? []) as WalletRow[];
    const fakeRows = allRows.filter(
        (row) =>
            row.isCredit === true &&
            FAKE_TX_REFS.includes(String(row.transactionId ?? '') as (typeof FAKE_TX_REFS)[number])
    );

    const fakeTotal =
        Math.round(fakeRows.reduce((sum, row) => sum + mag(row.amount), 0) * 100) / 100;
    const storedBefore = Math.round(Number(customer.wallet_amount ?? 0) * 100) / 100;
    const ledgerBefore = ledgerNet(allRows);
    const ledgerAfter = Math.round((ledgerBefore - fakeTotal) * 100) / 100;

    console.log('Customer:', customer.email, CUSTOMER_ID);
    console.log('Fake Telebirr top-up rows:', fakeRows.length, '| total ETB', fakeTotal.toFixed(2));
    for (const row of fakeRows) {
        console.log(
            `  DELETE +${mag(row.amount).toFixed(2)} ${row.id} ${row.createdDate} ${row.transactionId} ${row.paymentType}`
        );
    }
    console.log('');
    console.log('wallet_amount:', storedBefore.toFixed(2), '→', ledgerAfter.toFixed(2));
    console.log('ledger net:', ledgerBefore.toFixed(2), '→', ledgerAfter.toFixed(2));

    if (fakeRows.length === 0) {
        console.log('\nNothing to remove.');
        return;
    }

    if (dryRun) {
        console.log('\nDry run only. Pass --apply to delete fake credits and sync wallet_amount.');
        return;
    }

    const ids = fakeRows.map((row) => row.id);
    const { error: deleteError } = await admin.from('wallet_transaction').delete().in('id', ids);
    if (deleteError) {
        console.error('Delete failed:', deleteError.message);
        process.exit(1);
    }

    const { data: afterRows, error: afterError } = await admin
        .from('wallet_transaction')
        .select('id, userId, amount, isCredit, note, transactionId, paymentType, createdDate')
        .eq('userId', CUSTOMER_ID);

    if (afterError) {
        console.error(afterError.message);
        process.exit(1);
    }

    const finalLedger = ledgerNet((afterRows ?? []) as WalletRow[]);
    const { error: walletError } = await admin
        .from('customer')
        .update({ wallet_amount: finalLedger.toFixed(2) })
        .eq('id', CUSTOMER_ID);

    if (walletError) {
        console.error('Wallet sync failed:', walletError.message);
        process.exit(1);
    }

    console.log('\nDone.');
    console.log('Deleted', ids.length, 'rows');
    console.log('Final ledger / wallet_amount:', finalLedger.toFixed(2));
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
