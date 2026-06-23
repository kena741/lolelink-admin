import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import {
    fetchAllChapaTransactions,
    fetchAllChapaTransfers,
    fetchChapaEtbBalance,
    isChapaSuccessStatus,
    loadChapaSecretKey,
    resolveChapaListSettlementAmount,
    resolveChapaSettlementAmount,
    resolveChapaTransferDebitAmount,
    verifyChapaTransaction,
    type ChapaListTransaction,
} from '../src/lib/chapa-config';
import {
    isChapaWalletTransaction,
    sumChapaNetFlow,
    walletTransactionMagnitude,
    type WalletTransactionMetricRow,
} from '../src/lib/wallet-transaction-metrics';

interface WalletRow extends WalletTransactionMetricRow {
    id: string;
    transactionId: string;
    createdDate: string;
    note: string;
    paymentType: string;
}

interface ResolvedChapaPayment {
    refId: string;
    txRef: string;
    settlement: number;
    gross: number;
    charge: number;
    createdAt: string;
    paymentMethod: string;
    listTx: ChapaListTransaction;
}

function fmt(value: number): string {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSuccessfulChapaListTransaction(tx: ChapaListTransaction): boolean {
    return isChapaSuccessStatus(String(tx.status ?? ''));
}

function isSuccessfulChapaTransfer(status: string | undefined): boolean {
    return isChapaSuccessStatus(String(status ?? ''));
}

async function resolveChapaPayment(
    secretKey: string,
    tx: ChapaListTransaction,
    verifyDelayMs: number
): Promise<ResolvedChapaPayment | null> {
    const refId = String(tx.ref_id ?? '').trim();
    if (!refId) return null;

    const verified = await verifyChapaTransaction(secretKey, refId);
    if (verifyDelayMs > 0) await sleep(verifyDelayMs);

    const settlementFromList = resolveChapaListSettlementAmount(tx);
    if (!verified.ok) {
        return {
            refId,
            txRef: refId,
            settlement: settlementFromList,
            gross: Number(tx.amount ?? 0),
            charge: Number(tx.charge ?? 0),
            createdAt: String(tx.created_at ?? ''),
            paymentMethod: String(tx.payment_method ?? ''),
            listTx: tx,
        };
    }

    const settlement = resolveChapaSettlementAmount(verified.data) ?? settlementFromList;
    const txRef = String(verified.data.tx_ref ?? verified.data.reference ?? refId).trim();

    return {
        refId,
        txRef,
        settlement,
        gross: Number(verified.data.amount ?? tx.amount ?? 0),
        charge: Number(verified.data.charge ?? tx.charge ?? 0),
        createdAt: String(tx.created_at ?? ''),
        paymentMethod: String(tx.payment_method ?? ''),
        listTx: tx,
    };
}

async function main(): Promise<void> {
    loadEnvLocal();

    const verifyDelayMs = Number(process.env.CHAPA_SCAN_VERIFY_DELAY_MS ?? '120');
    const openingBalance = Number(process.env.CHAPA_OPENING_BALANCE_ETB ?? '1000');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing Supabase env');
        process.exit(1);
    }

    const admin = createClient(url, key);
    const secretKey = await loadChapaSecretKey(admin);
    if (!secretKey) {
        console.error('Missing Chapa secret key');
        process.exit(1);
    }

    console.log('\n══════════════════════════════════════════════════════════');
    console.log('  CHAPA TRANSACTION SCAN (read-only)');
    console.log('══════════════════════════════════════════════════════════\n');

    console.log('Fetching Chapa transactions...');
    const listTransactions = await fetchAllChapaTransactions(secretKey, {
        onPage: (page, count) => console.log(`  page ${page}: ${count} rows`),
    });

    console.log('Fetching Chapa transfers...');
    const listTransfers = await fetchAllChapaTransfers(secretKey, {
        onPage: (page, count) => console.log(`  page ${page}: ${count} rows`),
    });

    const successfulList = listTransactions.filter(isSuccessfulChapaListTransaction);
    const failedList = listTransactions.filter((tx) => !isSuccessfulChapaListTransaction(tx));
    const successfulTransfers = listTransfers.filter((tx) => isSuccessfulChapaTransfer(tx.status));

    console.log(`\nChapa list: ${listTransactions.length} payments (${successfulList.length} success, ${failedList.length} failed/cancelled)`);
    console.log(`Chapa transfers: ${listTransfers.length} (${successfulTransfers.length} success)\n`);

    console.log('Resolving tx_ref for successful Chapa payments (verify by ref_id)...');
    const resolvedPayments: ResolvedChapaPayment[] = [];
    for (const [index, tx] of successfulList.entries()) {
        const resolved = await resolveChapaPayment(secretKey, tx, verifyDelayMs);
        if (resolved) resolvedPayments.push(resolved);
        if ((index + 1) % 25 === 0) {
            console.log(`  verified ${index + 1}/${successfulList.length}`);
        }
    }

    const chapaInflowSettlement = resolvedPayments.reduce((sum, item) => sum + item.settlement, 0);
    const chapaOutflow = successfulTransfers.reduce(
        (sum, item) => sum + resolveChapaTransferDebitAmount(item),
        0
    );
    const gatewayNet = Math.round((chapaInflowSettlement - chapaOutflow) * 100) / 100;
    const impliedLiveWithOpening = Math.round((openingBalance + gatewayNet) * 100) / 100;

    let liveChapa: number | null = null;
    let liveLedger: number | null = null;
    try {
        const balance = await fetchChapaEtbBalance(secretKey);
        liveChapa = balance.availableBalance;
        liveLedger = balance.ledgerBalance;
    } catch (error) {
        console.warn('Live balance fetch failed:', error instanceof Error ? error.message : error);
    }

    const { data: walletRaw, error: walletError } = await admin
        .from('wallet_transaction')
        .select('id, amount, isCredit, note, transactionId, type, userId, createdDate, paymentType')
        .order('createdDate', { ascending: true });

    if (walletError || !walletRaw) {
        console.error('wallet_transaction:', walletError?.message);
        process.exit(1);
    }

    const walletRows = walletRaw as WalletRow[];
    const chapaWalletRows = walletRows.filter((row) => isChapaWalletTransaction(row));
    const chapaWalletCredits = chapaWalletRows.filter((row) => row.isCredit === true);
    const chapaWalletDebits = chapaWalletRows.filter((row) => row.isCredit !== true);
    const ledgerChapaNet = sumChapaNetFlow(walletRows);

    const chapaByTxRef = new Map<string, ResolvedChapaPayment[]>();
    for (const payment of resolvedPayments) {
        const group = chapaByTxRef.get(payment.txRef) ?? [];
        group.push(payment);
        chapaByTxRef.set(payment.txRef, group);
    }

    const walletByTxRef = new Map<string, WalletRow[]>();
    for (const row of chapaWalletCredits) {
        const txRef = (row.transactionId ?? '').trim();
        if (!txRef) continue;
        const group = walletByTxRef.get(txRef) ?? [];
        group.push(row);
        walletByTxRef.set(txRef, group);
    }

    const orphanChapa: ResolvedChapaPayment[] = [];
    for (const payment of resolvedPayments) {
        if (!walletByTxRef.has(payment.txRef)) orphanChapa.push(payment);
    }

    const orphanLedger: Array<{
        row: WalletRow;
        stored: number;
        verifiedSettlement: number | null;
        verifyError: string | null;
    }> = [];

    const ledgerMismatch: Array<{
        row: WalletRow;
        stored: number;
        chapaSettlement: number;
        delta: number;
    }> = [];

    for (const row of chapaWalletCredits) {
        const txRef = (row.transactionId ?? '').trim();
        const stored = walletTransactionMagnitude(row.amount);
        const chapaMatch = txRef ? chapaByTxRef.get(txRef) : undefined;

        if (!chapaMatch || chapaMatch.length === 0) {
            const verified = txRef ? await verifyChapaTransaction(secretKey, txRef) : { ok: false as const, error: 'missing tx_ref' };
            if (verifyDelayMs > 0) await sleep(verifyDelayMs);
            orphanLedger.push({
                row,
                stored,
                verifiedSettlement: verified.ok ? resolveChapaSettlementAmount(verified.data) : null,
                verifyError: verified.ok ? null : verified.error,
            });
            continue;
        }

        const chapaSettlement = chapaMatch.reduce((sum, item) => sum + item.settlement, 0);
        if (stored > chapaSettlement + 0.5) {
            ledgerMismatch.push({
                row,
                stored,
                chapaSettlement,
                delta: Math.round((stored - chapaSettlement) * 100) / 100,
            });
        }
    }

    console.log('\nHEADLINE');
    console.log('──────────────────────────────────────────────────────────');
    console.log(`  Live Chapa available          ETB ${liveChapa != null ? fmt(liveChapa) : 'n/a'}`);
    if (liveLedger != null) {
        console.log(`  Live Chapa ledger             ETB ${fmt(liveLedger)}`);
    }
    console.log(`  Chapa API inflow (success)    ETB ${fmt(chapaInflowSettlement)}  (${resolvedPayments.length} payments)`);
    console.log(`  Chapa API outflow (transfers) ETB ${fmt(chapaOutflow)}  (${successfulTransfers.length} transfers)`);
    console.log(`  Gateway net (in − out)        ETB ${fmt(gatewayNet)}`);
    console.log(`  Opening balance (assumed)     ETB ${fmt(openingBalance)}`);
    console.log(`  Opening + gateway net         ETB ${fmt(impliedLiveWithOpening)}`);
    if (liveChapa != null) {
        console.log(`  Live − (opening + gateway)    ETB ${fmt(liveChapa - impliedLiveWithOpening)}`);
        console.log(`  Live − gateway net            ETB ${fmt(liveChapa - gatewayNet)}  (≈ opening if clean)`);
    }
    console.log(`  App ledger Chapa net          ETB ${fmt(ledgerChapaNet)}`);
    console.log(`  App Chapa credits             ${chapaWalletCredits.length} rows  ETB ${fmt(chapaWalletCredits.reduce((s, r) => s + walletTransactionMagnitude(r.amount), 0))}`);
    console.log(`  App Chapa debits              ${chapaWalletDebits.length} rows  ETB ${fmt(chapaWalletDebits.reduce((s, r) => s + walletTransactionMagnitude(r.amount), 0))}`);
    if (liveChapa != null) {
        console.log(`  Live − ledger Chapa           ETB ${fmt(liveChapa - ledgerChapaNet)}`);
    }
    console.log(`  Gateway net − ledger Chapa    ETB ${fmt(gatewayNet - ledgerChapaNet)}`);

    const orphanChapaTotal = orphanChapa.reduce((sum, item) => sum + item.settlement, 0);
    const orphanLedgerStored = orphanLedger.reduce((sum, item) => sum + item.stored, 0);
    const mismatchTotal = ledgerMismatch.reduce((sum, item) => sum + item.delta, 0);

    console.log('\nRECONCILE');
    console.log('──────────────────────────────────────────────────────────');
    console.log(`  Chapa payments without wallet row     ${orphanChapa.length}  ETB ${fmt(orphanChapaTotal)}`);
    console.log(`  Wallet Chapa credits without list hit ${orphanLedger.length}  ETB ${fmt(orphanLedgerStored)} stored`);
    console.log(`  Wallet stored above Chapa settlement  ${ledgerMismatch.length}  ETB ${fmt(mismatchTotal)} over`);

    if (orphanChapa.length > 0) {
        console.log('\nORPHAN CHAPA PAYMENTS (success, no wallet_transaction match)');
        for (const item of orphanChapa.sort((a, b) => b.settlement - a.settlement).slice(0, 25)) {
            console.log(
                `  · ETB ${fmt(item.settlement)} | ${item.txRef.slice(0, 40)} | ${item.createdAt.slice(0, 10)} | ${item.paymentMethod}`
            );
        }
        if (orphanChapa.length > 25) console.log(`  … and ${orphanChapa.length - 25} more`);
    }

    if (ledgerMismatch.length > 0) {
        console.log('\nLEDGER OVER RECORDS (stored > Chapa settlement)');
        for (const item of ledgerMismatch.sort((a, b) => b.delta - a.delta).slice(0, 25)) {
            const tx = (item.row.transactionId ?? '').slice(0, 40);
            console.log(
                `  · ${item.row.id.slice(0, 8)}… | ${tx} | stored ${fmt(item.stored)} vs Chapa ${fmt(item.chapaSettlement)} (+${fmt(item.delta)})`
            );
            console.log(`    ${(item.row.note ?? '').slice(0, 72)}`);
        }
        if (ledgerMismatch.length > 25) console.log(`  … and ${ledgerMismatch.length - 25} more`);
    }

    if (orphanLedger.length > 0) {
        console.log('\nORPHAN LEDGER CHAPA CREDITS (no Chapa list match by tx_ref)');
        for (const item of orphanLedger.sort((a, b) => b.stored - a.stored).slice(0, 25)) {
            const tx = (item.row.transactionId ?? '').slice(0, 40);
            const verified = item.verifiedSettlement != null ? `verify ${fmt(item.verifiedSettlement)}` : `verify failed: ${item.verifyError}`;
            console.log(`  · ETB ${fmt(item.stored)} | ${tx} | ${verified}`);
            console.log(`    ${(item.row.note ?? '').slice(0, 72)}`);
        }
        if (orphanLedger.length > 25) console.log(`  … and ${orphanLedger.length - 25} more`);
    }

    console.log('\nDone. Set CHAPA_OPENING_BALANCE_ETB to adjust opening assumption.');
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
