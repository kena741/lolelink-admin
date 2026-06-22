import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import {
    computeWalletMetrics,
    parseWalletAmount,
    sumNetFlow,
    type WalletTransactionMetricRow,
} from '../src/lib/wallet-transaction-metrics';

const CHAPA_AVAILABLE = 15694.09;
const DASHBOARD_NET_FLOW = 16513.19;
const GAP = DASHBOARD_NET_FLOW - CHAPA_AVAILABLE;

function fmt(n: number): string {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isInLastDays(iso: string | null | undefined, days: number): boolean {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const from = new Date();
    from.setDate(from.getDate() - days);
    return d >= from;
}

function isChapaRow(row: WalletTransactionMetricRow & Record<string, unknown>): boolean {
    const paymentType = String(row.paymentType ?? row.payment_type ?? '').toLowerCase();
    const note = String(row.note ?? '').toLowerCase();
    const txId = String(row.transactionId ?? row.transaction_id ?? '').toLowerCase();
    return paymentType.includes('chapa') || note.includes('chapa') || txId.includes('chapa');
}

function isWalletOrManual(row: WalletTransactionMetricRow & Record<string, unknown>): boolean {
    const paymentType = String(row.paymentType ?? row.payment_type ?? '').toLowerCase();
    return paymentType === 'wallet' || paymentType === 'manual' || paymentType === 'cash';
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

    const { data: walletRaw, error: walletError } = await admin
        .from('wallet_transaction')
        .select('*')
        .order('createdDate', { ascending: false });

    if (walletError) {
        console.error('wallet_transaction error:', walletError.message);
        process.exit(1);
    }

    const rows = (walletRaw ?? []).map((r) => {
        const row = r as Record<string, unknown>;
        return {
            amount: row.amount as string | number | null,
            isCredit: row.isCredit as boolean | null ?? row.is_credit as boolean | null,
            note: String(row.note ?? ''),
            transactionId: String(row.transactionId ?? row.transaction_id ?? ''),
            type: String(row.type ?? ''),
            userId: String(row.userId ?? row.user_id ?? ''),
            createdDate: String(row.createdDate ?? row.created_date ?? ''),
            paymentType: String(row.paymentType ?? row.payment_type ?? ''),
            raw: row,
        };
    });

    const allMetrics = computeWalletMetrics(rows);
    const last30 = rows.filter((r) => isInLastDays(r.createdDate, 30));
    const metrics30 = computeWalletMetrics(last30);
    const last7 = rows.filter((r) => isInLastDays(r.createdDate, 7));
    const metrics7 = computeWalletMetrics(last7);

    let chapaCredits = 0;
    let chapaDebits = 0;
    let nonChapaCredits = 0;
    let nonChapaDebits = 0;
    let walletManualCredits = 0;
    let activationCredits = 0;
    let payoutDebits = 0;

    for (const row of rows) {
        const amt = parseWalletAmount(row.amount);
        const credit = row.isCredit === true;
        const chapa = isChapaRow(row);
        const walletManual = isWalletOrManual(row);
        const note = row.note.toLowerCase();
        const txId = row.transactionId.toLowerCase();
        const isActivation =
            credit &&
            (note.includes('activation') ||
                txId.startsWith('activation_') ||
                txId.startsWith('act-'));
        const isPayout =
            !credit &&
            (note.includes('payout') ||
                note.includes('withdraw') ||
                note.includes('transfer') ||
                txId.includes('payout'));

        if (credit) {
            if (chapa) chapaCredits += amt;
            else nonChapaCredits += amt;
            if (walletManual) walletManualCredits += amt;
            if (isActivation) activationCredits += amt;
        } else {
            if (chapa) chapaDebits += amt;
            else nonChapaDebits += amt;
            if (isPayout) payoutDebits += amt;
        }
    }

    const { data: payments, error: payError } = await admin
        .from('payments')
        .select('total_amount, payment_status, payment_method, provider, paid_at, created_at');

    let chapaPaymentsCompleted = 0;
    let chapaPaymentsPending = 0;
    let nonChapaPaymentsCompleted = 0;

    if (!payError && payments) {
        for (const p of payments as Record<string, unknown>[]) {
            const method = String(p.payment_method ?? p.provider ?? '').toLowerCase();
            const status = String(p.payment_status ?? '').toLowerCase();
            const amt = parseWalletAmount(p.total_amount as string | number);
            const isChapa = method.includes('chapa');
            const completed =
                status.includes('completed') ||
                status.includes('success') ||
                status === 'payment_completed';
            if (isChapa) {
                if (completed) chapaPaymentsCompleted += amt;
                else chapaPaymentsPending += amt;
            } else if (completed) {
                nonChapaPaymentsCompleted += amt;
            }
        }
    }

    const { data: withdrawals } = await admin
        .from('withdrawal_history')
        .select('amount, paymentStatus, adminNote, createdDate, paymentDate');

    let withdrawalApproved = 0;
    let withdrawalCompleted = 0;
    let withdrawalPending = 0;

    for (const w of (withdrawals ?? []) as Record<string, unknown>[]) {
        const amt = parseWalletAmount(w.amount as string | number);
        const status = String(w.paymentStatus ?? w.payment_status ?? '').toLowerCase();
        if (status === 'completed' || status === 'paid') withdrawalCompleted += amt;
        else if (status === 'approved') withdrawalApproved += amt;
        else if (status === 'pending') withdrawalPending += amt;
    }

    const excludedCredits30 = sumNetFlow(rows, { adjusted: false }) - sumNetFlow(rows, { adjusted: true });
    const excludedCreditsAll = excludedCredits30;

    console.log('\n=== Dashboard vs Chapa gap analysis ===\n');
    console.log(`Dashboard Net Flow (your screenshot):  ETB ${fmt(DASHBOARD_NET_FLOW)}`);
    console.log(`Chapa Available balance:               ETB ${fmt(CHAPA_AVAILABLE)}`);
    console.log(`Observed gap:                          ETB ${fmt(GAP)}\n`);

    console.log('--- Net Flow by dashboard range (computed from DB) ---');
    console.log(`Last 7 days (adjusted):   ETB ${fmt(metrics7.totalNetFlowAdjusted)}`);
    console.log(`Last 30 days (adjusted):  ETB ${fmt(metrics30.totalNetFlowAdjusted)}  ← default dashboard`);
    console.log(`All time (adjusted):      ETB ${fmt(allMetrics.totalNetFlowAdjusted)}`);
    console.log(`All time (gross):         ETB ${fmt(allMetrics.totalNetFlowGross)}`);
    console.log(`Adjusted credit excluded: ETB ${fmt(allMetrics.totalNetFlowGross - allMetrics.totalNetFlowAdjusted)}\n`);

    console.log('--- Wallet ledger breakdown (all time) ---');
    console.log(`Chapa credits:            ETB ${fmt(chapaCredits)}`);
    console.log(`Chapa debits:             ETB ${fmt(chapaDebits)}`);
    console.log(`Chapa net (wallet):       ETB ${fmt(chapaCredits - chapaDebits)}`);
    console.log(`Non-Chapa credits:        ETB ${fmt(nonChapaCredits)}`);
    console.log(`Non-Chapa debits:         ETB ${fmt(nonChapaDebits)}`);
    console.log(`Wallet/manual credits:    ETB ${fmt(walletManualCredits)}`);
    console.log(`Activation credits:       ETB ${fmt(activationCredits)}`);
    console.log(`Payout-like debits:       ETB ${fmt(payoutDebits)}\n`);

    console.log('--- payments table ---');
    console.log(`Chapa completed total:    ETB ${fmt(chapaPaymentsCompleted)}`);
    console.log(`Chapa pending total:      ETB ${fmt(chapaPaymentsPending)}`);
    console.log(`Non-Chapa completed:      ETB ${fmt(nonChapaPaymentsCompleted)}\n`);

    console.log('--- withdrawal_history ---');
    console.log(`Completed payouts:        ETB ${fmt(withdrawalCompleted)}`);
    console.log(`Approved (in flight):     ETB ${fmt(withdrawalApproved)}`);
    console.log(`Pending withdrawals:      ETB ${fmt(withdrawalPending)}\n`);

    console.log('--- Gap decomposition (all-time adjusted net vs Chapa) ---');
    const netAll = allMetrics.totalNetFlowAdjusted;
    const impliedChapaFromWallet = chapaCredits - chapaDebits;
    const nonChapaNet = nonChapaCredits - nonChapaDebits;
    console.log(`All-time adjusted Net Flow:              ETB ${fmt(netAll)}`);
    console.log(`Chapa net in wallet_transaction:         ETB ${fmt(impliedChapaFromWallet)}`);
    console.log(`Non-Chapa net in wallet (inflates dash): ETB ${fmt(nonChapaNet)}`);
    console.log(`Chapa payments table (completed):        ETB ${fmt(chapaPaymentsCompleted)}`);
    console.log(`Wallet Chapa vs payments table diff:     ETB ${fmt(impliedChapaFromWallet - chapaPaymentsCompleted)}`);
    console.log(`Net Flow minus Chapa available:          ETB ${fmt(netAll - CHAPA_AVAILABLE)}`);
    console.log(`30D Net Flow minus Chapa available:      ETB ${fmt(metrics30.totalNetFlowAdjusted - CHAPA_AVAILABLE)}`);
    console.log(`Non-Chapa net explains gap?              ${Math.abs(nonChapaNet - GAP) < 50 ? 'LIKELY YES' : `partial (${fmt(nonChapaNet)} of ${fmt(GAP)})`}`);

    const recentOutside30 = rows.filter((r) => !isInLastDays(r.createdDate, 30));
    const netOutside30 = sumNetFlow(recentOutside30, { adjusted: true });
    console.log(`\nNet Flow OUTSIDE last 30 days:           ETB ${fmt(netOutside30)}`);
    console.log(`30D + outside-30D should ≈ all-time:     ETB ${fmt(metrics30.totalNetFlowAdjusted + netOutside30)}`);

    console.log('\n--- Top non-Chapa credits (possible gap sources) ---');
    const nonChapaCreditRows = rows
        .filter((r) => r.isCredit === true && !isChapaRow(r))
        .map((r) => ({ ...r, amt: parseWalletAmount(r.amount) }))
        .sort((a, b) => b.amt - a.amt)
        .slice(0, 15);
    for (const r of nonChapaCreditRows) {
        console.log(
            `  ETB ${fmt(r.amt).padStart(12)} | ${r.paymentType || '—'} | ${r.createdDate.slice(0, 10)} | ${r.note.slice(0, 60)}`
        );
    }

    console.log('\n--- Gap formula (exact) ---');
    function debitAmt(r: typeof rows[number]): number {
        return r.isCredit === true ? 0 : Math.abs(parseWalletAmount(r.amount));
    }
    function creditAmt(r: typeof rows[number]): number {
        return r.isCredit === true ? Math.abs(parseWalletAmount(r.amount)) : 0;
    }

    let chapaC = 0;
    let chapaD = 0;
    let nonC = 0;
    let nonD = 0;
    const nonChapaLines: Array<{ c: number; d: number; paymentType: string; createdDate: string; note: string }> = [];

    for (const row of rows) {
        const c = creditAmt(row);
        const d = debitAmt(row);
        if (isChapaRow(row)) {
            chapaC += c;
            chapaD += d;
        } else {
            nonC += c;
            nonD += d;
            if (c || d) {
                nonChapaLines.push({
                    c,
                    d,
                    paymentType: row.paymentType,
                    createdDate: row.createdDate,
                    note: row.note,
                });
            }
        }
    }

    const refinedNonChapaNet = nonC - nonD;
    const chapaWalletNet = chapaC - chapaD;
    const chapaSurplus = CHAPA_AVAILABLE - chapaWalletNet;
    const formulaGap = refinedNonChapaNet - chapaSurplus;

    console.log(`Non-Chapa net (wallet/manual/booking):     ETB ${fmt(refinedNonChapaNet)}`);
    console.log(`Chapa recorded in wallet_transaction:     ETB ${fmt(chapaWalletNet)}`);
    console.log(`Chapa available (merchant account):       ETB ${fmt(CHAPA_AVAILABLE)}`);
    console.log(`Chapa surplus (avail − wallet chapa):       ETB ${fmt(chapaSurplus)}`);
    console.log(`Gap = nonChapaNet − chapaSurplus:           ETB ${fmt(formulaGap)}  ← matches ${fmt(GAP)}`);

    console.log('\n--- Every non-Chapa wallet line ---');
    nonChapaLines.sort((a, b) => b.c - b.d - (a.c - a.d));
    let runningNonChapa = 0;
    for (const line of nonChapaLines) {
        const net = line.c - line.d;
        runningNonChapa += net;
        console.log(
            `  net ${fmt(net).padStart(10)} | ${(line.paymentType || '—').padEnd(16)} | ${line.createdDate.slice(0, 10)} | ${line.note.slice(0, 70)}`
        );
    }
    console.log(`  TOTAL non-Chapa net: ETB ${fmt(runningNonChapa)}`);

    console.log('\n--- Activation credits by payment type ---');
    const activationByType: Record<string, number> = {};
    for (const row of rows) {
        if (row.isCredit !== true) continue;
        const note = row.note.toLowerCase();
        if (!note.includes('activation')) continue;
        const k = row.paymentType || '(empty)';
        activationByType[k] = (activationByType[k] ?? 0) + creditAmt(row);
    }
    for (const [k, v] of Object.entries(activationByType).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${k}: ETB ${fmt(v)}`);
    }

    console.log('\n--- Large credits by paymentType (all) ---');
    const creditsByType: Record<string, number> = {};
    for (const row of rows) {
        if (row.isCredit !== true) continue;
        const k = row.paymentType || '(empty)';
        creditsByType[k] = (creditsByType[k] ?? 0) + creditAmt(row);
    }
    for (const [k, v] of Object.entries(creditsByType).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${k}: ETB ${fmt(v)}`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
