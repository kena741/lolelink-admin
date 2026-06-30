import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import { walletTransactionMagnitude } from '../src/lib/wallet-transaction-metrics';

const CUSTOMER_ID = '8a8f7b79-d371-4a7e-b140-162da35cc5cc';
const INVALID_SELF_BOOKING_FEE_ROW_ID = 'd5d3552e-36ce-4a81-a06a-c266b981a9f5';

interface WalletRow {
    id: string;
    userId: string;
    amount: string | number | null;
    isCredit: boolean | null;
    note: string | null;
    transactionId: string | null;
    createdDate?: string | null;
}

interface DeclineRefundSpec {
    bookingId: string;
    shortId: string;
    amount: number;
    refundDate: string;
}

type DeclineRefundInput =
    | { bookingPrefix: string; shortId: string; amount: number }
    | { bookingId: string; shortId: string; amount: number };

const DECLINE_REFUND_SPECS: DeclineRefundInput[] = [
    { bookingPrefix: 'eecbe456', shortId: 'eecbe4', amount: 11.12 },
    { bookingPrefix: '1c1cf188', shortId: '1c1cf1', amount: 11.12 },
    { bookingPrefix: 'abfd1203', shortId: 'abfd12', amount: 11.12 },
    { bookingId: 'a401c972-de52-4398-b8c6-e557a51b21ae', shortId: 'a401c9', amount: 5.56 },
];

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

function resolveRefundSpecs(rows: WalletRow[]): DeclineRefundSpec[] {
    const resolved: DeclineRefundSpec[] = [];

    for (const spec of DECLINE_REFUND_SPECS) {
        if ('bookingId' in spec) {
            const feeDebit = rows.find((row) => {
                if (row.isCredit === true) return false;
                return String(row.transactionId ?? '').toLowerCase() === spec.bookingId.toLowerCase();
            });
            if (!feeDebit?.createdDate) {
                throw new Error(`Fee debit not found for booking ${spec.bookingId}`);
            }
            resolved.push({
                bookingId: spec.bookingId,
                shortId: spec.shortId,
                amount: spec.amount,
                refundDate: refundDateAfterFeeDebit(feeDebit.createdDate),
            });
            continue;
        }

        const feeDebit = rows.find((row) => {
            if (row.isCredit === true) return false;
            const txId = String(row.transactionId ?? '').toLowerCase();
            return txId.startsWith(spec.bookingPrefix.toLowerCase());
        });

        if (!feeDebit?.transactionId || !feeDebit.createdDate) {
            throw new Error(`Fee debit not found for booking prefix ${spec.bookingPrefix}`);
        }

        resolved.push({
            bookingId: feeDebit.transactionId,
            shortId: spec.shortId,
            amount: spec.amount,
            refundDate: refundDateAfterFeeDebit(feeDebit.createdDate),
        });
    }

    return resolved;
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
    const invalidFeeRow = allRows.find((row) => row.id === INVALID_SELF_BOOKING_FEE_ROW_ID);
    const refundSpecs = resolveRefundSpecs(allRows);

    console.log(`Customer: ${customer.email}`);
    console.log(`Stored wallet_amount: ${Number(customer.wallet_amount ?? 0).toFixed(2)}`);
    console.log(`Ledger net (before): ${ledgerBefore.toFixed(2)}`);
    console.log('');

    let ledgerDelta = 0;

    if (invalidFeeRow) {
        const magnitude = walletTransactionMagnitude(invalidFeeRow.amount);
        ledgerDelta += magnitude;
        console.log(
            `DELETE invalid self-booking fee | ${invalidFeeRow.id} | ETB ${magnitude.toFixed(2)} | ${invalidFeeRow.transactionId}`
        );
    } else {
        console.log(`Invalid fee row already removed: ${INVALID_SELF_BOOKING_FEE_ROW_ID}`);
    }

    const refundsToInsert: DeclineRefundSpec[] = [];
    for (const spec of refundSpecs) {
        if (hasDeclineRefund(allRows, spec.bookingId)) {
            console.log(`SKIP decline refund (exists) | ${spec.bookingId} | ETB ${spec.amount.toFixed(2)}`);
            continue;
        }

        refundsToInsert.push(spec);
        ledgerDelta += spec.amount;
        console.log(
            `INSERT decline refund | ${spec.bookingId} | ETB ${spec.amount.toFixed(2)} | ${spec.refundDate} | Order #${spec.shortId} decline refund`
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

    if (invalidFeeRow) {
        const { error: deleteError } = await admin
            .from('wallet_transaction')
            .delete()
            .eq('id', INVALID_SELF_BOOKING_FEE_ROW_ID)
            .eq('userId', CUSTOMER_ID);

        if (deleteError) {
            console.error('Failed to delete invalid fee row:', deleteError.message);
            process.exit(1);
        }
    }

    for (const spec of refundsToInsert) {
        const { error: insertError } = await admin.from('wallet_transaction').insert({
            amount: spec.amount.toFixed(2),
            createdDate: spec.refundDate,
            isCredit: true,
            note: `Order #${spec.shortId} decline refund`,
            paymentType: 'Wallet',
            transactionId: spec.bookingId,
            type: 'customer',
            userId: CUSTOMER_ID,
            customer_id: CUSTOMER_ID,
        });

        if (insertError) {
            console.error(`Failed to insert decline refund for ${spec.bookingId}:`, insertError.message);
            process.exit(1);
        }
    }

    console.log('\nDone. Run sync-wallet-balances-from-ledger.ts --apply to update customer.wallet_amount.');
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
