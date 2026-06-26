import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import { walletTransactionMagnitude } from '../src/lib/wallet-transaction-metrics';

interface WalletRow {
    userId: string;
    amount: string | number | null;
    isCredit: boolean | null;
}

function ledgerNetForUser(rows: WalletRow[], userId: string): number {
    const normalized = userId.toLowerCase();
    const net = rows.reduce((sum, row) => {
        if ((row.userId ?? '').toLowerCase() !== normalized) return sum;
        const magnitude = walletTransactionMagnitude(row.amount);
        return row.isCredit === true ? sum + magnitude : sum - magnitude;
    }, 0);
    return Math.round(net * 100) / 100;
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
        console.log('Pass --dry-run to preview or --apply to sync wallet balances.');
        process.exit(0);
    }

    const admin = createClient(url, key);
    const [{ data: walletRows, error: walletError }, { data: customers, error: customerError }, { data: providers, error: providerError }] =
        await Promise.all([
            admin.from('wallet_transaction').select('userId, amount, isCredit'),
            admin.from('customer').select('id, user_id, email, wallet_amount'),
            admin.from('provider').select('id, user_id, email, walletAmount'),
        ]);

    if (walletError || customerError || providerError) {
        console.error('Load failed:', walletError?.message ?? customerError?.message ?? providerError?.message);
        process.exit(1);
    }

    const rows = (walletRows ?? []) as WalletRow[];
    const updates: Array<{ table: 'customer' | 'provider'; id: string; email: string; from: number; to: number }> = [];

    for (const customer of customers ?? []) {
        const authUserId = String(customer.user_id ?? '').trim();
        if (!authUserId) continue;
        const ledger = ledgerNetForUser(rows, authUserId);
        const stored = Number(customer.wallet_amount ?? 0);
        const delta = Math.round((stored - ledger) * 100) / 100;
        if (Math.abs(delta) > 0.01) {
            updates.push({
                table: 'customer',
                id: customer.id,
                email: customer.email ?? '',
                from: stored,
                to: ledger,
            });
        }
    }

    for (const provider of providers ?? []) {
        const authUserId = String(provider.user_id ?? '').trim();
        if (!authUserId) continue;
        const ledger = ledgerNetForUser(rows, authUserId);
        const stored = Number(provider.walletAmount ?? 0);
        const delta = Math.round((stored - ledger) * 100) / 100;
        if (Math.abs(delta) > 0.01) {
            updates.push({
                table: 'provider',
                id: provider.id,
                email: provider.email ?? '',
                from: stored,
                to: ledger,
            });
        }
    }

    updates.sort((a, b) => Math.abs(b.from - b.to) - Math.abs(a.from - a.to));
    console.log(`Found ${updates.length} wallet balance correction(s).\n`);

    for (const update of updates) {
        console.log(
            `  ${update.table} ${update.email || update.id}: ${update.from.toFixed(2)} → ${update.to.toFixed(2)}`
        );
    }

    if (updates.length === 0) {
        console.log('\nAll stored balances match ledger.');
        return;
    }

    if (dryRun) {
        console.log('\nDry run only. Re-run with --apply to sync.');
        return;
    }

    for (const update of updates) {
        if (update.table === 'customer') {
            const { error } = await admin
                .from('customer')
                .update({ wallet_amount: update.to.toFixed(2) })
                .eq('id', update.id);
            if (error) {
                console.error(`customer ${update.id}:`, error.message);
                process.exit(1);
            }
            continue;
        }

        const { error } = await admin
            .from('provider')
            .update({ walletAmount: update.to.toFixed(2) })
            .eq('id', update.id);
        if (error) {
            console.error(`provider ${update.id}:`, error.message);
            process.exit(1);
        }
    }

    console.log(`\nSynced ${updates.length} balance(s).`);
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
