import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import {
    fetchChapaEtbBalance,
    loadChapaSecretKey,
    resolveChapaSettlementAmount,
    verifyChapaTransaction,
} from '../src/lib/chapa-config';

import {
    isChapaWalletTransaction,
    sumChapaNetFlow,
    sumNetFlow,
    walletTransactionMagnitude,
    type WalletTransactionMetricRow,
} from '../src/lib/wallet-transaction-metrics';

interface WalletRow extends WalletTransactionMetricRow {
    id: string;
    transactionId: string;
    createdDate: string;
    userId: string;
    note: string;
}

function ledgerNetForUser(rows: WalletRow[], userId: string): number {
    return rows.reduce((sum, row) => {
        if (row.userId !== userId) return sum;
        const magnitude = walletTransactionMagnitude(row.amount);
        return row.isCredit === true ? sum + magnitude : sum - magnitude;
    }, 0);
}

const MIN_SETTLEMENT_FOR_LEDGER_FIX = 50;

function shouldApplySettlementFix(stored: number, settlement: number): boolean {
    if (settlement <= 0) return false;
    if (stored <= settlement + 0.01) return false;
    if (settlement < MIN_SETTLEMENT_FOR_LEDGER_FIX) return false;
    return true;
}

function normalizeNoteForSettlement(note: string): string {
    const trimmed = note.trim();
    if (trimmed.toLowerCase().includes('net after fee')) return trimmed;
    if (!trimmed) return 'Chapa credit (net after fee)';
    return `${trimmed} (Chapa, net after fee)`;
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
    const secretKey = await loadChapaSecretKey(admin);
    if (!secretKey) {
        console.error('Missing Chapa secret key');
        process.exit(1);
    }

    const { data: walletRaw, error: walletError } = await admin
        .from('wallet_transaction')
        .select('id, amount, isCredit, note, transactionId, type, userId, createdDate, paymentType')
        .order('createdDate', { ascending: true });

    if (walletError || !walletRaw) {
        console.error('wallet_transaction:', walletError?.message);
        process.exit(1);
    }

    const rows = walletRaw as WalletRow[];
    const beforeNet = sumNetFlow(rows, { adjusted: true });
    const beforeChapa = sumChapaNetFlow(rows);

    console.log('Before — Net Flow:', beforeNet.toFixed(2), '| App wallet Chapa:', beforeChapa.toFixed(2));

    const byTransactionId = new Map<string, WalletRow[]>();
    for (const row of rows) {
        const tx = (row.transactionId ?? '').trim();
        if (!tx) continue;
        const group = byTransactionId.get(tx) ?? [];
        group.push(row);
        byTransactionId.set(tx, group);
    }

    let deletedDuplicates = 0;
    let duplicateReduction = 0;

    for (const [tx, group] of byTransactionId) {
        if (group.length < 2) continue;

        const sorted = [...group].sort((a, b) => a.createdDate.localeCompare(b.createdDate));
        const keep = sorted[0];
        const remove = sorted.slice(1);

        console.log(`\nDuplicate transactionId ${tx}: keep ${keep.id}, remove ${remove.length}`);
        for (const row of remove) {
            const magnitude = walletTransactionMagnitude(row.amount);
            const signed = row.isCredit === true ? magnitude : -magnitude;
            duplicateReduction += signed;
            console.log(`  delete ${row.id} | ${row.isCredit ? 'credit' : 'debit'} ${magnitude.toFixed(2)}`);

            if (apply) {
                const { error } = await admin.from('wallet_transaction').delete().eq('id', row.id);
                if (error) {
                    console.error('  failed:', error.message);
                    process.exit(1);
                }
            }
            deletedDuplicates += 1;
        }
    }

    let simulatedRows = [...rows];
    if (apply) {
        const { data: refreshed } = await admin
            .from('wallet_transaction')
            .select('id, amount, isCredit, note, transactionId, type, userId, createdDate, paymentType')
            .order('createdDate', { ascending: true });
        simulatedRows = (refreshed ?? []) as WalletRow[];
    } else {
        const removeIds = new Set<string>();
        for (const [, group] of byTransactionId) {
            if (group.length < 2) continue;
            const sorted = [...group].sort((a, b) => a.createdDate.localeCompare(b.createdDate));
            for (const row of sorted.slice(1)) removeIds.add(row.id);
        }
        simulatedRows = simulatedRows.filter((row) => !removeIds.has(row.id));
    }

    let amountFixes = 0;
    let amountReduction = 0;
    let verifySkipped = 0;

    for (const row of simulatedRows) {
        if (row.isCredit !== true) continue;
        if (!isChapaWalletTransaction(row)) continue;

        const tx = (row.transactionId ?? '').trim();
        if (!tx) continue;

        const stored = walletTransactionMagnitude(row.amount);
        const verified = await verifyChapaTransaction(secretKey, tx);
        if (!verified.ok) {
            verifySkipped += 1;
            continue;
        }

        const settlement = resolveChapaSettlementAmount(verified.data);
        if (settlement == null || settlement <= 0) continue;
        if (!shouldApplySettlementFix(stored, settlement)) continue;

        const nextAmount = settlement.toFixed(2);
        amountReduction += stored - settlement;
        amountFixes += 1;

        console.log(`\nAmount fix ${row.id} | ${tx.slice(0, 36)}`);
        console.log(`  ${stored.toFixed(2)} → ${nextAmount}`);

        if (apply) {
            const { error } = await admin
                .from('wallet_transaction')
                .update({
                    amount: nextAmount,
                    note: normalizeNoteForSettlement(row.note ?? ''),
                })
                .eq('id', row.id);

            if (error) {
                console.error('  failed:', error.message);
                process.exit(1);
            }
        } else {
            const index = simulatedRows.findIndex((item) => item.id === row.id);
            if (index >= 0) {
                simulatedRows[index] = {
                    ...simulatedRows[index],
                    amount: nextAmount,
                    note: normalizeNoteForSettlement(row.note ?? ''),
                };
            }
        }
    }

    const finalRows = apply
        ? (((await admin
            .from('wallet_transaction')
            .select('id, amount, isCredit, note, transactionId, type, userId, createdDate, paymentType')).data ?? []) as WalletRow[])
        : simulatedRows;
    const afterNet = sumNetFlow(finalRows, { adjusted: true });
    const afterChapa = sumChapaNetFlow(finalRows);

    const providerIds = [...new Set(finalRows.map((row) => row.userId).filter(Boolean))];
    let syncedProviders = 0;

    console.log('\n--- Provider wallet sync ---');
    for (const providerId of providerIds) {
        const { data: provider } = await admin
            .from('provider')
            .select('id, email, walletAmount')
            .eq('id', providerId)
            .maybeSingle();

        if (!provider) continue;

        const ledgerNet = Math.round(ledgerNetForUser(finalRows, providerId) * 100) / 100;
        const stored = Number(provider.walletAmount ?? 0);
        if (Math.abs(stored - ledgerNet) < 0.01) continue;

        console.log(`  ${provider.email ?? providerId}: ${stored.toFixed(2)} → ${ledgerNet.toFixed(2)}`);
        syncedProviders += 1;

        if (apply) {
            const { error } = await admin
                .from('provider')
                .update({ walletAmount: ledgerNet.toFixed(2) })
                .eq('id', providerId);
            if (error) {
                console.error('  failed:', error.message);
                process.exit(1);
            }
        }
    }

    let liveChapa: number | null = null;
    try {
        const balance = await fetchChapaEtbBalance(secretKey);
        liveChapa = balance.availableBalance;
    } catch {
        liveChapa = null;
    }

    console.log('\n--- Summary ---');
    console.log(`Duplicate rows removed: ${deletedDuplicates} (${duplicateReduction.toFixed(2)} ledger impact)`);
    console.log(`Chapa amount fixes: ${amountFixes} (−${amountReduction.toFixed(2)} gross over-record)`);
    console.log(`Chapa verify skipped: ${verifySkipped}`);
    console.log(`Provider wallets synced: ${syncedProviders}`);
    console.log(`Net Flow: ${beforeNet.toFixed(2)} → ${afterNet.toFixed(2)}`);
    console.log(`App wallet Chapa: ${beforeChapa.toFixed(2)} → ${afterChapa.toFixed(2)}`);
    if (liveChapa != null) {
        console.log(`Live Chapa: ${liveChapa.toFixed(2)}`);
        console.log(`Live − App wallet Chapa: ${(liveChapa - afterChapa).toFixed(2)}`);
        console.log(`Live − Net Flow: ${(liveChapa - afterNet).toFixed(2)}`);
    }

    if (dryRun || !apply) {
        console.log(dryRun ? '\nDry run.' : '\nPass --apply to execute.');
    } else {
        console.log('\nDone.');
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
