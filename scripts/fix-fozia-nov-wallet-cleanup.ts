/**
 * Remove Nov Telebirr web* fake top-ups for Fozia customer + provider,
 * reverse unpaid booking 723df74e provider payout, sync wallet balances.
 *
 * Usage: npx tsx scripts/fix-fozia-nov-wallet-cleanup.ts --dry-run|--apply
 */
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import { walletTransactionMagnitude } from '../src/lib/wallet-transaction-metrics';

const CUSTOMER_ID = '8a8f7b79-d371-4a7e-b140-162da35cc5cc';
const PROVIDER_ID = '2e59797a-db9b-4485-afa8-69a54c9bd42f';
const UNPAID_BOOKING_ID = '723df74e-3ff3-4263-a179-9505590aefcb';

interface WalletRow {
    id: string;
    userId: string;
    amount: string | number | null;
    isCredit: boolean | null;
    note: string | null;
    transactionId: string | null;
    paymentType: string | null;
    createdDate: string | null;
    type?: string | null;
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

/** Telebirr web checkout ids: web{ms}{rand}, not Chapa web-… */
function isFakeTelebirrWebTopUp(row: WalletRow): boolean {
    if (row.isCredit !== true) return false;
    if (String(row.paymentType ?? '').toLowerCase() !== 'telebirr') return false;
    const tx = String(row.transactionId ?? '');
    return /^web\d{13}[a-z0-9]+$/i.test(tx);
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

    const { data: provider, error: providerError } = await admin
        .from('provider')
        .select('id, email, walletAmount')
        .eq('id', PROVIDER_ID)
        .maybeSingle();
    if (providerError || !provider) {
        console.error('Provider not found:', providerError?.message);
        process.exit(1);
    }

    const { data: custRows, error: custRowsError } = await admin
        .from('wallet_transaction')
        .select('id, userId, amount, isCredit, note, transactionId, paymentType, createdDate, type')
        .eq('userId', CUSTOMER_ID)
        .order('createdDate', { ascending: true });
    if (custRowsError) {
        console.error(custRowsError.message);
        process.exit(1);
    }

    const { data: provRows, error: provRowsError } = await admin
        .from('wallet_transaction')
        .select('id, userId, amount, isCredit, note, transactionId, paymentType, createdDate, type')
        .eq('userId', PROVIDER_ID)
        .order('createdDate', { ascending: true });
    if (provRowsError) {
        console.error(provRowsError.message);
        process.exit(1);
    }

    const customerRows = (custRows ?? []) as WalletRow[];
    const providerRows = (provRows ?? []) as WalletRow[];

    const customerFakes = customerRows.filter(isFakeTelebirrWebTopUp);
    const providerFakes = providerRows.filter(isFakeTelebirrWebTopUp);
    const unpaidPayout = providerRows.find(
        (row) =>
            row.isCredit === true &&
            String(row.transactionId ?? '').toLowerCase() === UNPAID_BOOKING_ID.toLowerCase()
    );

    const deleteIds = [
        ...customerFakes.map((r) => r.id),
        ...providerFakes.map((r) => r.id),
        ...(unpaidPayout ? [unpaidPayout.id] : []),
    ];

    const custFakeTotal =
        Math.round(customerFakes.reduce((s, r) => s + mag(r.amount), 0) * 100) / 100;
    const provFakeTotal =
        Math.round(providerFakes.reduce((s, r) => s + mag(r.amount), 0) * 100) / 100;
    const unpaidAmount = unpaidPayout ? mag(unpaidPayout.amount) : 0;

    const custLedgerBefore = ledgerNet(customerRows);
    const provLedgerBefore = ledgerNet(providerRows);
    const custLedgerAfter = Math.round((custLedgerBefore - custFakeTotal) * 100) / 100;
    const provLedgerAfter =
        Math.round((provLedgerBefore - provFakeTotal - unpaidAmount) * 100) / 100;

    console.log('Customer', customer.email, '| wallet', customer.wallet_amount);
    console.log(
        `  delete ${customerFakes.length} telebirr web* credits = ETB ${custFakeTotal.toFixed(2)}`
    );
    for (const row of customerFakes) {
        console.log(
            `    +${mag(row.amount).toFixed(2)} ${row.createdDate} ${row.transactionId}`
        );
    }
    console.log(
        `  ledger ${custLedgerBefore.toFixed(2)} → ${custLedgerAfter.toFixed(2)} (expect ~28.14)`
    );

    console.log('\nProvider', provider.email, '| wallet', provider.walletAmount);
    console.log(
        `  delete ${providerFakes.length} telebirr web* credits = ETB ${provFakeTotal.toFixed(2)}`
    );
    for (const row of providerFakes) {
        console.log(
            `    +${mag(row.amount).toFixed(2)} ${row.createdDate} ${row.transactionId}`
        );
    }
    if (unpaidPayout) {
        console.log(
            `  delete unpaid booking payout +${unpaidAmount.toFixed(2)} ${UNPAID_BOOKING_ID}`
        );
    } else {
        console.log('  unpaid booking payout already absent');
    }
    console.log(`  ledger ${provLedgerBefore.toFixed(2)} → ${provLedgerAfter.toFixed(2)}`);

    if (deleteIds.length === 0) {
        console.log('\nNothing to remove.');
        return;
    }

    if (dryRun) {
        console.log('\nDry run only. Pass --apply to delete and sync wallets.');
        return;
    }

    const { error: deleteError } = await admin
        .from('wallet_transaction')
        .delete()
        .in('id', deleteIds);
    if (deleteError) {
        console.error('Delete failed:', deleteError.message);
        process.exit(1);
    }

    const { data: custAfter, error: custAfterErr } = await admin
        .from('wallet_transaction')
        .select('id, userId, amount, isCredit, note, transactionId, paymentType, createdDate')
        .eq('userId', CUSTOMER_ID);
    if (custAfterErr) {
        console.error(custAfterErr.message);
        process.exit(1);
    }

    const { data: provAfter, error: provAfterErr } = await admin
        .from('wallet_transaction')
        .select('id, userId, amount, isCredit, note, transactionId, paymentType, createdDate')
        .eq('userId', PROVIDER_ID);
    if (provAfterErr) {
        console.error(provAfterErr.message);
        process.exit(1);
    }

    const finalCust = ledgerNet((custAfter ?? []) as WalletRow[]);
    const finalProv = ledgerNet((provAfter ?? []) as WalletRow[]);

    const { error: custWalletErr } = await admin
        .from('customer')
        .update({ wallet_amount: finalCust.toFixed(2) })
        .eq('id', CUSTOMER_ID);
    if (custWalletErr) {
        console.error('Customer wallet sync failed:', custWalletErr.message);
        process.exit(1);
    }

    const { error: provWalletErr } = await admin
        .from('provider')
        .update({ walletAmount: finalProv.toFixed(2) })
        .eq('id', PROVIDER_ID);
    if (provWalletErr) {
        console.error('Provider wallet sync failed:', provWalletErr.message);
        process.exit(1);
    }

    console.log('\nDone. Deleted', deleteIds.length, 'rows.');
    console.log('Customer wallet_amount:', finalCust.toFixed(2));
    console.log('Provider walletAmount:', finalProv.toFixed(2));
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
