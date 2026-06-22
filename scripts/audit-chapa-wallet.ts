import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import { fetchChapaEtbBalance, loadChapaSecretKey } from '../src/lib/chapa-config';
import {
    computeWalletMetrics,
    isChapaWalletTransaction,
    parseWalletAmount,
    sumChapaNetFlow,
    sumNonChapaNetFlow,
    sumNetFlow,
    walletTransactionMagnitude,
    type WalletTransactionMetricRow,
} from '../src/lib/wallet-transaction-metrics';

interface WalletRow extends WalletTransactionMetricRow {
    id: string;
    paymentType: string;
    note: string;
    transactionId: string;
    createdDate: string;
    userId: string;
    type: string;
}

interface PaymentRow {
    id: string;
    booking_id?: string | null;
    amount?: number | string | null;
    total_amount?: number | string | null;
    status?: string | null;
    payment_method?: string | null;
    provider?: string | null;
    provider_ref?: string | null;
    created_at?: string | null;
}

interface BookingRow {
    id: string;
    paymentType?: string | null;
    payment_type?: string | null;
    payment_status?: string | null;
    paymentCompleted?: boolean | null;
    payment_completed?: boolean | null;
    totalAmount?: number | string | null;
    total_amount?: number | string | null;
    price?: number | string | null;
    payment_id?: string | null;
    createdAt?: string | null;
    created_at?: string | null;
}

function fmt(n: number): string {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isChapaMethod(value: string | null | undefined): boolean {
    return String(value ?? '').toLowerCase().includes('chapa');
}

function isCompletedPaymentStatus(status: string | null | undefined): boolean {
    const s = String(status ?? '').toLowerCase();
    return (
        s.includes('completed')
        || s.includes('success')
        || s === 'paid'
        || s === 'payment_completed'
    );
}

function paymentAmount(row: PaymentRow): number {
    return walletTransactionMagnitude(row.amount ?? row.total_amount);
}

function bookingAmount(row: BookingRow): number {
    const total = parseWalletAmount(row.totalAmount ?? row.total_amount);
    if (total > 0) return total;
    return parseWalletAmount(row.price);
}

function bookingIsChapaPaid(row: BookingRow): boolean {
    const paymentType = String(row.paymentType ?? row.payment_type ?? '').toLowerCase();
    const paymentStatus = String(row.payment_status ?? '').toLowerCase();
    const completed = row.paymentCompleted === true || row.payment_completed === true;
    return paymentType.includes('chapa') && (completed || isCompletedPaymentStatus(paymentStatus));
}

function walletDelta(row: WalletRow): number {
    const magnitude = walletTransactionMagnitude(row.amount);
    return row.isCredit === true ? magnitude : -magnitude;
}

function normalizeWalletRows(data: Record<string, unknown>[]): WalletRow[] {
    return data.map((row) => ({
        id: String(row.id ?? ''),
        amount: row.amount as string | number | null,
        isCredit: (row.isCredit ?? row.is_credit) as boolean | null,
        note: String(row.note ?? ''),
        transactionId: String(row.transactionId ?? row.transaction_id ?? ''),
        type: String(row.type ?? ''),
        userId: String(row.userId ?? row.user_id ?? ''),
        createdDate: String(row.createdDate ?? row.created_date ?? ''),
        paymentType: String(row.paymentType ?? row.payment_type ?? ''),
    }));
}

async function main(): Promise<void> {
    loadEnvLocal();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing Supabase env');
        process.exit(1);
    }

    const admin = createClient(url, key);

    const [
        walletRes,
        paymentsRes,
        bookingsRes,
        chapaBalance,
    ] = await Promise.all([
        admin.from('wallet_transaction').select('*').order('createdDate', { ascending: false }),
        admin.from('payments').select('*'),
        admin.from('booked_service').select('*'),
        (async () => {
            try {
                const secretKey = await loadChapaSecretKey(admin);
                if (!secretKey) return null;
                return await fetchChapaEtbBalance(secretKey);
            } catch {
                return null;
            }
        })(),
    ]);

    if (walletRes.error) {
        console.error('wallet_transaction:', walletRes.error.message);
        process.exit(1);
    }

    const walletRows = normalizeWalletRows((walletRes.data ?? []) as Record<string, unknown>[]);
    const payments = (paymentsRes.data ?? []) as PaymentRow[];
    const bookings = (bookingsRes.data ?? []) as BookingRow[];

    const walletTxIds = new Set(
        walletRows.map((row) => row.transactionId.trim().toLowerCase()).filter(Boolean)
    );

    const chapaAvailable = chapaBalance?.availableBalance ?? null;
    const chapaLedger = chapaBalance?.ledgerBalance ?? null;
    const netFlow = sumNetFlow(walletRows, { adjusted: true });
    const chapaWalletNet = sumChapaNetFlow(walletRows);
    const nonChapaNet = sumNonChapaNetFlow(walletRows);
    const metrics = computeWalletMetrics(walletRows);

    console.log('\n══════════════════════════════════════════════════════════');
    console.log('  CHAPA / WALLET AUDIT (read-only — no backfill applied)');
    console.log('══════════════════════════════════════════════════════════\n');

    console.log('HEADLINE');
    console.log('──────────────────────────────────────────────────────────');
    console.log(`  Chapa available (live)     ETB ${chapaAvailable != null ? fmt(chapaAvailable) : 'n/a'}`);
    console.log(`  Chapa ledger (live)        ETB ${chapaLedger != null ? fmt(chapaLedger) : 'n/a'}`);
    console.log(`  Net Flow (app)             ETB ${fmt(netFlow)}`);
    console.log(`  App wallet Chapa net       ETB ${fmt(chapaWalletNet)}`);
    console.log(`  Non-Chapa net              ETB ${fmt(nonChapaNet)}`);
    if (chapaAvailable != null) {
        console.log(`  Chapa avail − Net Flow     ETB ${fmt(chapaAvailable - netFlow)}`);
        console.log(`  Chapa avail − App Chapa    ETB ${fmt(chapaAvailable - chapaWalletNet)}`);
    }
    console.log(`  Wallet row count           ${walletRows.length}`);
    console.log('');

    const negativeAmountRows = walletRows.filter((row) => parseWalletAmount(row.amount) < 0);
    const duplicateTxIds = new Map<string, number>();
    for (const row of walletRows) {
        const id = row.transactionId.trim().toLowerCase();
        if (!id) continue;
        duplicateTxIds.set(id, (duplicateTxIds.get(id) ?? 0) + 1);
    }
    const duplicateTxIdList = [...duplicateTxIds.entries()].filter(([, count]) => count > 1);

    console.log('DATA QUALITY');
    console.log('──────────────────────────────────────────────────────────');
    console.log(`  Negative amount rows       ${negativeAmountRows.length}  (${fmt(negativeAmountRows.reduce((s, r) => s + walletDelta(r), 0))} net impact if unfixed)`);
    console.log(`  Duplicate transactionId    ${duplicateTxIdList.length}`);
    if (negativeAmountRows.length > 0) {
        for (const row of negativeAmountRows) {
            console.log(`    · ${row.id.slice(0, 8)}… | ${fmt(parseWalletAmount(row.amount))} | ${row.paymentType} | ${row.note.slice(0, 50)}`);
        }
    }
    if (duplicateTxIdList.length > 0) {
        for (const [txId, count] of duplicateTxIdList.slice(0, 10)) {
            console.log(`    · ${txId} (${count} rows)`);
        }
    }
    console.log('');

    const chapaPayments = payments.filter(
        (row) => isChapaMethod(row.payment_method) || isChapaMethod(row.provider)
    );
    const completedChapaPayments = chapaPayments.filter((row) => isCompletedPaymentStatus(row.status));
    const missingWalletFromPayments = completedChapaPayments.filter((row) => {
        const ref = String(row.provider_ref ?? '').trim().toLowerCase();
        if (ref && walletTxIds.has(ref)) return false;
        const bookingId = String(row.booking_id ?? '').trim();
        if (bookingId) {
            const hasBookingNote = walletRows.some((w) => w.note.includes(bookingId));
            if (hasBookingNote) return false;
        }
        return paymentAmount(row) > 0;
    });

    const chapaPaidBookings = bookings.filter(bookingIsChapaPaid);
    const missingWalletFromBookings = chapaPaidBookings.filter((booking) => {
        const bookingId = booking.id;
        const hasWallet = walletRows.some(
            (w) =>
                w.transactionId.includes(bookingId.slice(0, 8))
                || w.note.includes(bookingId)
                || (booking.payment_id && w.transactionId === booking.payment_id)
        );
        return !hasWallet && bookingAmount(booking) > 0;
    });

    const missingPaymentRowsTotal = missingWalletFromPayments.reduce((s, r) => s + paymentAmount(r), 0);
    const missingBookingRowsTotal = missingWalletFromBookings.reduce((s, r) => s + bookingAmount(r), 0);

    console.log('MISSING WALLET CREDITS (backfill candidates)');
    console.log('──────────────────────────────────────────────────────────');
    console.log(`  payments table (Chapa completed)     ${completedChapaPayments.length} total`);
    console.log(`  Missing wallet match               ${missingWalletFromPayments.length} rows  ETB ${fmt(missingPaymentRowsTotal)}`);
    if (missingWalletFromPayments.length > 0) {
        for (const row of missingWalletFromPayments.slice(0, 15)) {
            console.log(
                `    · booking ${String(row.booking_id ?? '—').slice(0, 8)}… | ETB ${fmt(paymentAmount(row))} | ref ${String(row.provider_ref ?? '—').slice(0, 24)} | ${String(row.status ?? '—')}`
            );
        }
        if (missingWalletFromPayments.length > 15) {
            console.log(`    … and ${missingWalletFromPayments.length - 15} more`);
        }
    }
    console.log('');
    console.log(`  booked_service (Chapa paid)          ${chapaPaidBookings.length} total`);
    console.log(`  Missing wallet match               ${missingWalletFromBookings.length} rows  ETB ${fmt(missingBookingRowsTotal)}`);
    if (missingWalletFromBookings.length > 0) {
        for (const row of missingWalletFromBookings.slice(0, 15)) {
            console.log(
                `    · ${row.id.slice(0, 8)}… | ETB ${fmt(bookingAmount(row))} | ${String(row.payment_status ?? '—')} | ${String(row.createdAt ?? row.created_at ?? '').slice(0, 10)}`
            );
        }
        if (missingWalletFromBookings.length > 15) {
            console.log(`    … and ${missingWalletFromBookings.length - 15} more`);
        }
    }
    console.log('');

    const manualCredits = walletRows.filter(
        (row) =>
            row.isCredit === true
            && String(row.paymentType).toLowerCase() === 'manual'
    );
    const walletCredits = walletRows.filter(
        (row) => row.isCredit === true && String(row.paymentType).toLowerCase() === 'wallet'
    );
    const walletDebits = walletRows.filter(
        (row) => row.isCredit !== true && String(row.paymentType).toLowerCase() === 'wallet'
    );

    const manualTotal = manualCredits.reduce((s, r) => s + walletTransactionMagnitude(r.amount), 0);
    const walletCreditTotal = walletCredits.reduce((s, r) => s + walletTransactionMagnitude(r.amount), 0);
    const walletDebitTotal = walletDebits.reduce((s, r) => s + walletTransactionMagnitude(r.amount), 0);

    console.log('NON-CHAPA (do not backfill as Chapa)');
    console.log('──────────────────────────────────────────────────────────');
    console.log(`  Manual credits             ${manualCredits.length} rows  ETB ${fmt(manualTotal)}`);
    for (const row of manualCredits) {
        console.log(`    · ETB ${fmt(walletTransactionMagnitude(row.amount))} | ${row.createdDate.slice(0, 10)} | ${row.note.slice(0, 60)}`);
    }
    console.log(`  Wallet credits             ${walletCredits.length} rows  ETB ${fmt(walletCreditTotal)}`);
    for (const row of walletCredits) {
        console.log(`    · ETB ${fmt(walletTransactionMagnitude(row.amount))} | ${row.createdDate.slice(0, 10)} | ${row.note.slice(0, 60)}`);
    }
    console.log(`  Wallet debits              ${walletDebits.length} rows  ETB ${fmt(walletDebitTotal)}`);
    for (const row of walletDebits) {
        console.log(`    · ETB ${fmt(walletTransactionMagnitude(row.amount))} | ${row.createdDate.slice(0, 10)} | ${row.note.slice(0, 60)}`);
    }
    console.log(`  Non-Chapa net total        ETB ${fmt(nonChapaNet)}`);
    console.log('');

    const chapaWalletCredits = walletRows.filter((row) => row.isCredit === true && isChapaWalletTransaction(row));
    const chapaByType: Record<string, number> = {};
    for (const row of walletRows.filter((row) => isChapaWalletTransaction(row))) {
        const keyName = row.paymentType || '(empty)';
        chapaByType[keyName] = (chapaByType[keyName] ?? 0) + walletDelta(row);
    }

    console.log('APP WALLET CHAPA BREAKDOWN');
    console.log('──────────────────────────────────────────────────────────');
    console.log(`  Chapa credit rows          ${chapaWalletCredits.length}`);
    for (const [type, amount] of Object.entries(chapaByType).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))) {
        console.log(`    · ${type.padEnd(12)} ETB ${fmt(amount)}`);
    }
    console.log(`  Activation fee (metric)    ETB ${fmt(metrics.totalActivationFeeAdjusted)}`);
    console.log(`  Customer top up (metric)   ETB ${fmt(metrics.totalCustomerTopUpAdjusted)}`);
    console.log('');

    const chapaSurplus = chapaAvailable != null ? chapaAvailable - chapaWalletNet : null;
    const explainedGap = chapaAvailable != null ? nonChapaNet - (chapaSurplus ?? 0) : null;

    console.log('GAP RECONCILIATION');
    console.log('──────────────────────────────────────────────────────────');
    console.log('  Category                          ETB        Action');
    console.log('  ─────────────────────────────────────────────────────');
    console.log(`  Non-Chapa net (inflates Net Flow)   ${fmt(nonChapaNet).padStart(10)}   No backfill`);
    if (chapaSurplus != null) {
        console.log(`  Chapa surplus (avail > app wallet)  ${fmt(chapaSurplus).padStart(10)}   Audit missing credits`);
    }
    console.log(`  Missing from payments table         ${fmt(missingPaymentRowsTotal).padStart(10)}   Backfill candidate`);
    console.log(`  Missing from booked_service         ${fmt(missingBookingRowsTotal).padStart(10)}   Backfill candidate`);
    if (chapaAvailable != null && explainedGap != null) {
        console.log(`  Chapa avail − Net Flow (headline)   ${fmt(chapaAvailable - netFlow).padStart(10)}   Target ≈ ${fmt(explainedGap)}`);
    }
  console.log('');

    console.log('RECOMMENDED NEXT STEPS');
    console.log('──────────────────────────────────────────────────────────');
    if (negativeAmountRows.length > 0) {
        console.log('  1. Fix negative amount rows (run fix-negative-wallet-debit-amounts.ts)');
    }
    if (missingWalletFromPayments.length > 0 || missingWalletFromBookings.length > 0) {
        console.log('  2. Backfill wallet_transaction for verified Chapa payments (payments + bookings lists above)');
    }
    console.log('  3. Update Chapa verify/webhook to always insert wallet_transaction on success');
    console.log('  4. Re-run this audit until Chapa avail − App Chapa ≈ 0 (minus fees/timing)');
    console.log('');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
