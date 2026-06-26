import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';

interface WalletRow {
    id: string;
    createdDate: string;
    userId: string;
    transactionId: string;
    isCredit: boolean;
    note: string;
    amount: string;
}

function classifyKind(note: string, isCredit: boolean): string {
    const normalized = note.toLowerCase();
    if (isCredit && normalized.includes('refund')) return 'refund_credit';
    if (!isCredit && (normalized.includes('service fee debited') || normalized.includes('service booking fee'))) {
        return 'fee_debit';
    }
    if (!isCredit && normalized.includes('cancel') && !normalized.includes('refund')) return 'cancel_debit';
    if (isCredit && normalized.includes('completed (payout')) return 'payout_credit';
    if (normalized.includes('admin commission refund')) return 'zero_commission';
    if (normalized.includes('admin reversal')) return 'admin_reversal';
    if (normalized.includes('withdrawal payout')) return 'withdrawal';
    if (normalized.includes('activation') && isCredit) return 'activation_credit';
    return 'other';
}

function findDuplicateDeleteIds(rows: WalletRow[]): WalletRow[] {
    const withKind = rows
        .filter((row) => row.transactionId.trim() !== '')
        .map((row) => ({
            ...row,
            kind: classifyKind(row.note ?? '', row.isCredit === true),
        }));

    const groups = new Map<string, typeof withKind>();
    for (const row of withKind) {
        const key = `${row.transactionId}|${row.userId}|${row.isCredit}|${row.kind}`;
        const bucket = groups.get(key) ?? [];
        bucket.push(row);
        groups.set(key, bucket);
    }

    const toDelete: WalletRow[] = [];
    for (const group of groups.values()) {
        if (group.length < 2) continue;
        const sorted = [...group].sort((a, b) => {
            const dateCmp = a.createdDate.localeCompare(b.createdDate);
            if (dateCmp !== 0) return dateCmp;
            return a.id.localeCompare(b.id);
        });
        toDelete.push(...sorted.slice(1));
    }

    return toDelete.sort((a, b) => a.createdDate.localeCompare(b.createdDate));
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
        console.log('Pass --dry-run to preview or --apply to delete duplicate rows.');
        process.exit(0);
    }

    const admin = createClient(url, key);
    const { data, error } = await admin
        .from('wallet_transaction')
        .select('id, createdDate, userId, transactionId, isCredit, note, amount')
        .order('createdDate', { ascending: true });

    if (error) {
        console.error('wallet_transaction:', error.message);
        process.exit(1);
    }

    const toDelete = findDuplicateDeleteIds((data ?? []) as WalletRow[]);
    console.log(`Found ${toDelete.length} duplicate wallet_transaction row(s) to delete.\n`);

    for (const row of toDelete) {
        const kind = classifyKind(row.note ?? '', row.isCredit === true);
        console.log(
            `  ${row.id} | ${row.transactionId.slice(0, 8)}… | ${kind} | ${row.isCredit ? 'credit' : 'debit'} | ${row.amount} | ${row.note}`
        );
    }

    if (toDelete.length === 0) {
        console.log('\nNothing to delete.');
        return;
    }

    if (dryRun) {
        console.log('\nDry run only. Re-run with --apply to delete.');
        return;
    }

    const ids = toDelete.map((row) => row.id);
    const { data: deleted, error: deleteError } = await admin
        .from('wallet_transaction')
        .delete()
        .in('id', ids)
        .select('id, transactionId, note, amount');

    if (deleteError) {
        console.error('Delete failed:', deleteError.message);
        process.exit(1);
    }

    console.log(`\nDeleted ${deleted?.length ?? 0} row(s).`);
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
