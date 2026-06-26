import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import { walletTransactionMagnitude } from '../src/lib/wallet-transaction-metrics';

const CUSTOMER_ID = 'b6653709-a566-4c4b-b1ba-a31945376bef';
const MISSING_DECLINE_REFUND_BOOKING_ID = '5d9edf62-8d63-415c-b815-8e644ab6990e';
const MISSING_DECLINE_REFUND_SHORT_ID = '5d9edf';
const MISSING_DECLINE_REFUND_AMOUNT = 5.56;

const ERRONEOUS_DEBIT_ROW_IDS = [
    'bb3638fd-d537-49b5-9002-f7c720fe03d8',
    '0af659b9-1880-45be-92b6-8d5b06d9b311',
    '315f9c97-cb79-4f1e-ad9c-e182e588e752',
    'ab4d5638-bcef-47c1-8bba-578df13be85a',
    'f202582d-d745-4710-b9cf-5add147ed8ca',
    '50faa2f5-4f96-4883-b226-22e8ef118ff2',
] as const;

interface WalletRow {
    id: string;
    userId: string;
    amount: string | number | null;
    isCredit: boolean | null;
    note: string | null;
    transactionId: string | null;
    createdDate?: string | null;
}

function ledgerNetForUser(rows: WalletRow[], userId: string): number {
    const net = rows.reduce((sum, row) => {
        if (row.userId !== userId) return sum;
        const magnitude = walletTransactionMagnitude(row.amount);
        return row.isCredit === true ? sum + magnitude : sum - magnitude;
    }, 0);
    return Math.round(net * 100) / 100;
}

function hasDeclineRefund(rows: WalletRow[], bookingId: string): boolean {
    const normalizedBookingId = bookingId.toLowerCase();
    return rows.some((row) => {
        if (row.isCredit !== true) return false;
        if (String(row.transactionId ?? '').toLowerCase() !== normalizedBookingId) return false;
        return (row.note ?? '').toLowerCase().includes('decline refund');
    });
}

function refundDateAfterFeeDebit(feeDebitCreatedDate: string): string {
    return new Date(new Date(feeDebitCreatedDate).getTime() + 60_000).toISOString();
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

    if (!dryRun && !apply) {
        console.log('Pass --dry-run to preview or --apply to execute.');
        process.exit(0);
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

    const allRows = (rows ?? []) as WalletRow[];
    const ledgerBefore = ledgerNetForUser(allRows, CUSTOMER_ID);
    let ledgerDelta = 0;

    console.log(`Customer: ${customer.email}`);
    console.log(`Stored wallet_amount: ${Number(customer.wallet_amount ?? 0).toFixed(2)}`);
    console.log(`Ledger net (before): ${ledgerBefore.toFixed(2)}`);
    console.log('');

    const rowsToDelete: WalletRow[] = [];
    for (const rowId of ERRONEOUS_DEBIT_ROW_IDS) {
        const row = allRows.find((entry) => entry.id === rowId);
        if (!row) {
            console.log(`SKIP delete (already removed) | ${rowId}`);
            continue;
        }
        const magnitude = walletTransactionMagnitude(row.amount);
        ledgerDelta += magnitude;
        rowsToDelete.push(row);
        console.log(
            `DELETE erroneous debit | ${row.id} | ETB ${magnitude.toFixed(2)} | ${row.transactionId} | ${row.note}`
        );
    }

    const feeDebit = allRows.find(
        (row) =>
            row.isCredit !== true
            && String(row.transactionId ?? '').toLowerCase() === MISSING_DECLINE_REFUND_BOOKING_ID.toLowerCase()
    );

    let refundToInsert: { bookingId: string; amount: number; refundDate: string } | null = null;
    if (hasDeclineRefund(allRows, MISSING_DECLINE_REFUND_BOOKING_ID)) {
        console.log(`SKIP decline refund (exists) | ${MISSING_DECLINE_REFUND_BOOKING_ID}`);
    } else if (!feeDebit?.createdDate) {
        console.error('Missing fee debit for 5d9edf62 — cannot insert decline refund.');
        process.exit(1);
    } else {
        refundToInsert = {
            bookingId: MISSING_DECLINE_REFUND_BOOKING_ID,
            amount: MISSING_DECLINE_REFUND_AMOUNT,
            refundDate: refundDateAfterFeeDebit(feeDebit.createdDate),
        };
        ledgerDelta += refundToInsert.amount;
        console.log(
            `INSERT decline refund | ${refundToInsert.bookingId} | ETB ${refundToInsert.amount.toFixed(2)} | ${refundToInsert.refundDate} | Order #${MISSING_DECLINE_REFUND_SHORT_ID} decline refund`
        );
    }

    const ledgerAfter = Math.round((ledgerBefore + ledgerDelta) * 100) / 100;
    console.log('');
    console.log(`Ledger net (after): ${ledgerAfter.toFixed(2)} (delta +${ledgerDelta.toFixed(2)})`);
    console.log(`Expected wallet_amount after sync: ${ledgerAfter.toFixed(2)}`);

    if (dryRun) {
        console.log('\nDry run.');
        return;
    }

    for (const row of rowsToDelete) {
        const { error: deleteError } = await admin
            .from('wallet_transaction')
            .delete()
            .eq('id', row.id)
            .eq('userId', CUSTOMER_ID);

        if (deleteError) {
            console.error(`Failed to delete ${row.id}:`, deleteError.message);
            process.exit(1);
        }
    }

    if (refundToInsert) {
        const { error: insertError } = await admin.from('wallet_transaction').insert({
            amount: refundToInsert.amount.toFixed(2),
            createdDate: refundToInsert.refundDate,
            isCredit: true,
            note: `Order #${MISSING_DECLINE_REFUND_SHORT_ID} decline refund`,
            paymentType: 'Wallet',
            transactionId: refundToInsert.bookingId,
            type: 'customer',
            userId: CUSTOMER_ID,
            customer_id: CUSTOMER_ID,
        });

        if (insertError) {
            console.error('Failed to insert decline refund:', insertError.message);
            process.exit(1);
        }
    }

    console.log('\nDone. Run sync-wallet-balances-from-ledger.ts --apply to update customer.wallet_amount.');
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
