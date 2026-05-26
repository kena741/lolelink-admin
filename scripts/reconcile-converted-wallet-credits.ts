import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import {
    buildUserIdsWithProviderActivation,
    isCustomerTransactionType,
    shouldExcludeFromAdjustedCredit,
    type WalletTransactionMetricRow,
} from '../src/lib/wallet-transaction-metrics';

interface WalletRow extends WalletTransactionMetricRow {
    id: string;
}

const SUPERSEDED_SUFFIX = '[superseded-by-conversion]';

interface ReconcileAction {
    row: WalletRow;
    action: 'delete' | 'retag';
    reason: string;
}

function buildProviderTransactionIds(rows: WalletRow[]): Set<string> {
    const ids = new Set<string>();
    for (const row of rows) {
        if (!row.transactionId) continue;
        if (isCustomerTransactionType(row.type)) continue;
        ids.add(row.transactionId);
    }
    return ids;
}

function planReconcileActions(rows: WalletRow[]): ReconcileAction[] {
    const providerActivationUserIds = buildUserIdsWithProviderActivation(rows);
    const providerTransactionIds = buildProviderTransactionIds(rows);
    const actions: ReconcileAction[] = [];

    for (const row of rows) {
        if (!isCustomerTransactionType(row.type)) continue;

        const sharedProviderTx =
            row.transactionId && providerTransactionIds.has(row.transactionId);
        const sharedUserActivation =
            row.userId && providerActivationUserIds.has(row.userId);

        if (sharedProviderTx) {
            actions.push({
                row,
                action: 'delete',
                reason: 'duplicate transactionId already recorded on provider row',
            });
            continue;
        }

        if (
            sharedUserActivation
            && shouldExcludeFromAdjustedCredit(row, providerActivationUserIds)
        ) {
            actions.push({
                row,
                action: 'retag',
                reason: 'customer top-up superseded by provider activation for same userId',
            });
        }
    }

    return actions;
}

function parseArgValue(prefix: string): string | undefined {
    const raw = process.argv.find((a) => a.startsWith(prefix));
    if (!raw) return undefined;
    const eq = raw.indexOf('=');
    if (eq === -1) return undefined;
    const v = raw.slice(eq + 1).trim();
    return v.length > 0 ? v : undefined;
}

async function main(): Promise<void> {
    loadEnvLocal();

    const dryRun = !process.argv.includes('--apply');
    const deleteDuplicates = process.argv.includes('--delete');
    const onlyUserId = parseArgValue('--user-id=');
    const onlyTransactionId = parseArgValue('--transaction-id=');

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
        process.exit(1);
    }

    const supabase = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase
        .from('wallet_transaction')
        .select('id, amount, isCredit, note, transactionId, type, userId, createdDate');

    if (error || !data) {
        console.error('Failed to load wallet_transaction rows:', error?.message ?? 'unknown');
        process.exit(1);
    }

    const rows = data as WalletRow[];
    let actions = planReconcileActions(rows);

    if (onlyUserId) {
        actions = actions.filter((entry) => entry.row.userId === onlyUserId);
    }
    if (onlyTransactionId) {
        actions = actions.filter((entry) => entry.row.transactionId === onlyTransactionId);
    }

    const deleteActions = actions.filter((entry) => entry.action === 'delete');
    const retagActions = actions.filter((entry) => entry.action === 'retag');

    console.log(`Wallet rows loaded: ${rows.length}`);
    console.log(`Planned actions: ${actions.length} (${deleteActions.length} delete, ${retagActions.length} retag)`);
    if (deleteDuplicates) {
        console.log('Delete mode enabled for duplicate customer rows.\n');
    } else if (deleteActions.length > 0) {
        console.log('Duplicate customer rows found. Re-run with --delete to remove them.\n');
    }
    console.log(dryRun ? 'Dry run — pass --apply to write changes.\n' : 'Applying changes...\n');

    let deleted = 0;
    let updated = 0;
    let failed = 0;

    for (const entry of actions) {
        const { row, action, reason } = entry;
        const verb = dryRun ? 'would' : action === 'delete' ? 'delete' : 'update';

        console.log(
            `${verb}  ${row.id}  userId=${row.userId}  type=${row.type}  tx=${row.transactionId}  amount=${row.amount}  (${reason})`
        );

        if (dryRun) continue;

        if (action === 'delete') {
            if (!deleteDuplicates) continue;

            const { error: deleteError } = await supabase
                .from('wallet_transaction')
                .delete()
                .eq('id', row.id);

            if (deleteError) {
                failed += 1;
                console.error(`  fail  ${row.id}  ${deleteError.message}`);
                continue;
            }

            deleted += 1;
            continue;
        }

        const nextNote = (row.note ?? '').includes(SUPERSEDED_SUFFIX)
            ? row.note ?? ''
            : `${row.note ?? ''}${row.note ? ' ' : ''}${SUPERSEDED_SUFFIX}`.trim();

        const { error: updateError } = await supabase
            .from('wallet_transaction')
            .update({
                type: 'provider',
                note: nextNote,
            })
            .eq('id', row.id);

        if (updateError) {
            failed += 1;
            console.error(`  fail  ${row.id}  ${updateError.message}`);
            continue;
        }

        updated += 1;
    }

    console.log('\nSummary');
    console.log(`  deleted: ${dryRun ? (deleteDuplicates ? deleteActions.length : 0) : deleted}`);
    console.log(`  retagged: ${dryRun ? retagActions.length : updated}`);
    console.log(`  failed: ${failed}`);
    if (!deleteDuplicates && deleteActions.length > 0) {
        console.log(`  hint: run with --delete --apply to remove ${deleteActions.length} duplicate customer row(s)`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
