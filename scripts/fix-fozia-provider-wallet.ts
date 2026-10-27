import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import { walletTransactionMagnitude } from '../src/lib/wallet-transaction-metrics';

const PROVIDER_ID = '2e59797a-db9b-4485-afa8-69a54c9bd42f';
const BOOKING_ID = '86c0cb14-167b-4526-95c8-d0356742c6c5';
const CORRECT_PAYOUT = 16.2;
const SOFT_HOLD_ADJUSTMENT_TX = 'admin-soft-hold-phantom-sep30-2025';

interface WalletRow {
    id: string;
    userId: string;
    amount: string | number | null;
    isCredit: boolean | null;
    note: string | null;
    transactionId: string | null;
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

function isSep30(createdDate: string | null): boolean {
    const d = String(createdDate ?? '');
    return d.startsWith('2025-09-30') || d.startsWith('2026-09-30');
}

function isPhantomRestore(note: string | null): boolean {
    const n = (note ?? '').toLowerCase();
    return (
        n.includes('soft-hold') ||
        n.includes('soft hold') ||
        n.includes('hold restored') ||
        (n.includes('withdrawal') && n.includes('restor')) ||
        (n.includes('reject') && n.includes('restor')) ||
        n.includes('funds restored')
    );
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

    const { data: provider, error: providerError } = await admin
        .from('provider')
        .select('id, email, walletAmount')
        .eq('id', PROVIDER_ID)
        .maybeSingle();

    if (providerError || !provider) {
        console.error('Provider not found:', providerError?.message);
        process.exit(1);
    }

    const { data: booking, error: bookingError } = await admin
        .from('booked_service')
        .select('id, totalAmount, price, status, paymentType, adminCommission, serviceName')
        .eq('id', BOOKING_ID)
        .maybeSingle();

    if (bookingError || !booking) {
        console.error('Booking not found:', bookingError?.message);
        process.exit(1);
    }

    const { data: rows, error: rowsError } = await admin
        .from('wallet_transaction')
        .select('id, userId, amount, isCredit, note, transactionId, createdDate')
        .eq('userId', PROVIDER_ID)
        .order('createdDate', { ascending: true });

    if (rowsError) {
        console.error(rowsError.message);
        process.exit(1);
    }

    const allRows = (rows ?? []) as WalletRow[];
    const storedBefore = Math.round(Number(provider.walletAmount ?? 0) * 100) / 100;
    const ledgerBefore = ledgerNet(allRows);

    const payoutCredit = allRows.find(
        (row) => row.transactionId === BOOKING_ID && row.isCredit === true
    );
    if (!payoutCredit) {
        console.error('Missing 86c0cb payout credit');
        process.exit(1);
    }

    const credited = mag(payoutCredit.amount);
    const alreadyCorrected = Math.abs(credited - CORRECT_PAYOUT) < 0.005;
    const commissionFix = alreadyCorrected ? 0 : Math.round((credited - CORRECT_PAYOUT) * 100) / 100;

    const existingSoftHoldAdj = allRows.find(
        (row) => row.transactionId === SOFT_HOLD_ADJUSTMENT_TX
    );

    const sep30Credits = allRows.filter(
        (row) => row.isCredit === true && isSep30(row.createdDate) && isPhantomRestore(row.note)
    );

    const allDebitsByTx = new Map<string, number>();
    for (const row of allRows) {
        if (row.isCredit === true) continue;
        const key = String(row.transactionId ?? '');
        if (!key) continue;
        allDebitsByTx.set(key, (allDebitsByTx.get(key) ?? 0) + mag(row.amount));
    }

    const noDebitPhantoms = sep30Credits.filter((credit) => {
        const key = String(credit.transactionId ?? '');
        if (!key) return true;
        return (allDebitsByTx.get(key) ?? 0) <= 0;
    });

    const softHoldPhantomTotal =
        Math.round(noDebitPhantoms.reduce((sum, row) => sum + mag(row.amount), 0) * 100) / 100;
    const softHoldDebitNeeded =
        existingSoftHoldAdj || softHoldPhantomTotal <= 0 ? 0 : softHoldPhantomTotal;

    // After rewriting payout + inserting soft-hold debit, ledger should be:
    const ledgerAfter =
        Math.round((ledgerBefore - commissionFix - softHoldDebitNeeded) * 100) / 100;

    console.log('Provider:', provider.email, PROVIDER_ID);
    console.log(
        'Booking:',
        BOOKING_ID,
        '|',
        booking.serviceName,
        '| totalAmount:',
        booking.totalAmount
    );
    console.log(
        'Payout credit:',
        payoutCredit.id,
        '|',
        credited.toFixed(2),
        alreadyCorrected ? '(already 16.20)' : `→ rewrite to ${CORRECT_PAYOUT.toFixed(2)} (−${commissionFix.toFixed(2)})`
    );
    console.log('');
    console.log('Sep 30 restore-like credits with no prior debit:', noDebitPhantoms.length);
    for (const row of noDebitPhantoms) {
        console.log(
            `  +${mag(row.amount).toFixed(2)} ${row.id.slice(0, 8)} ${row.createdDate} | ${(row.note ?? '').slice(0, 90)}`
        );
    }
    console.log(
        'Soft-hold phantom debit:',
        softHoldDebitNeeded.toFixed(2),
        existingSoftHoldAdj ? '(already applied)' : ''
    );
    console.log('');
    console.log('walletAmount:', storedBefore.toFixed(2), '→', ledgerAfter.toFixed(2), '(sync to ledger)');
    console.log('ledger net:', ledgerBefore.toFixed(2), '→', ledgerAfter.toFixed(2));

    if (dryRun) {
        console.log('\nDry run only. Pass --apply to rewrite payout, insert soft-hold debit, sync wallet.');
        return;
    }

    const now = new Date().toISOString();

    if (!alreadyCorrected) {
        const { error: payoutUpdateError } = await admin
            .from('wallet_transaction')
            .update({
                amount: CORRECT_PAYOUT.toFixed(2),
                note: `Order #86c0cb completed (payout after admin commission) — corrected from ${credited.toFixed(2)} to ${CORRECT_PAYOUT.toFixed(2)} (10% of ETB 18)`,
            })
            .eq('id', payoutCredit.id);

        if (payoutUpdateError) {
            console.error('Payout row update failed:', payoutUpdateError.message);
            process.exit(1);
        }
    }

    if (softHoldDebitNeeded > 0) {
        const ids = noDebitPhantoms.map((row) => row.id.slice(0, 8)).join(',');
        const { error: insertError } = await admin.from('wallet_transaction').insert({
            amount: softHoldDebitNeeded.toFixed(2),
            createdDate: now,
            isCredit: false,
            note: `Admin adjustment: reverse Sep 30 soft-hold/reject restores with no prior debit (${ids})`,
            paymentType: 'admin',
            transactionId: SOFT_HOLD_ADJUSTMENT_TX,
            type: 'provider',
            userId: PROVIDER_ID,
            provider_id: null,
            customer_id: null,
        });

        if (insertError) {
            console.error('Soft-hold debit insert failed:', insertError.message);
            process.exit(1);
        }
    }

    const { data: afterRows, error: afterError } = await admin
        .from('wallet_transaction')
        .select('id, userId, amount, isCredit, note, transactionId, createdDate')
        .eq('userId', PROVIDER_ID);

    if (afterError) {
        console.error(afterError.message);
        process.exit(1);
    }

    const finalLedger = ledgerNet((afterRows ?? []) as WalletRow[]);
    const { error: walletError } = await admin
        .from('provider')
        .update({ walletAmount: finalLedger.toFixed(2) })
        .eq('id', PROVIDER_ID);

    if (walletError) {
        console.error('Wallet sync failed:', walletError.message);
        process.exit(1);
    }

    const expectedFee = Math.round(18 * 0.1 * 100) / 100;
    const { error: bookingUpdateError } = await admin
        .from('booked_service')
        .update({ adminCommission: expectedFee.toFixed(2) })
        .eq('id', BOOKING_ID);

    if (bookingUpdateError) {
        console.error('Booking adminCommission update failed:', bookingUpdateError.message);
        process.exit(1);
    }

    console.log('\nDone.');
    console.log('Final ledger / walletAmount:', finalLedger.toFixed(2));
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
