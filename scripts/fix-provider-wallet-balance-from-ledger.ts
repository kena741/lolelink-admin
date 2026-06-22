import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import { walletTransactionMagnitude } from '../src/lib/wallet-transaction-metrics';

interface WalletRow {
    id: string;
    userId: string;
    amount: string | number | null;
    isCredit: boolean | null;
    note: string | null;
}

interface ProviderRow {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    walletAmount?: string | null;
}

function parseStoredWallet(value: string | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function ledgerNetForUser(rows: WalletRow[], userId: string): number {
    return rows.reduce((sum, row) => {
        if (row.userId !== userId) return sum;
        const magnitude = walletTransactionMagnitude(row.amount);
        return row.isCredit === true ? sum + magnitude : sum - magnitude;
    }, 0);
}

function providerName(provider: ProviderRow): string {
    const full = [provider.firstName, provider.lastName].filter(Boolean).join(' ').trim();
    return full || provider.email || provider.id;
}

async function main(): Promise<void> {
    loadEnvLocal();

    const dryRun = process.argv.includes('--dry-run');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing Supabase env');
        process.exit(1);
    }

    const admin = createClient(url, key);

    const { data: walletRowsRaw, error: walletError } = await admin
        .from('wallet_transaction')
        .select('id, userId, amount, isCredit, note');

    if (walletError) {
        console.error('wallet_transaction:', walletError.message);
        process.exit(1);
    }

    const walletRows = (walletRowsRaw ?? []) as WalletRow[];

    const dawitProviderId = '2036fd57-b7fd-44f4-b431-223653a69525';
    const dawitMispriced = walletRows.filter((row) => {
        if (row.userId !== dawitProviderId || row.isCredit !== true) return false;
        const magnitude = walletTransactionMagnitude(row.amount);
        return magnitude > 0 && magnitude < 10;
    });

    if (dawitMispriced.length > 0) {
        console.log(`\nFix mispriced activation amount(s) for Dawit Mekonnen (${dawitMispriced.length} row(s)):`);
        for (const row of dawitMispriced) {
            const from = walletTransactionMagnitude(row.amount);
            console.log(`  ${row.id}: ${from.toFixed(2)} → 499.00 | ${(row.note ?? '').slice(0, 60)}`);
            if (!dryRun) {
                const { error } = await admin
                    .from('wallet_transaction')
                    .update({ amount: '499.00' })
                    .eq('id', row.id);
                if (error) {
                    console.error('Failed to update wallet_transaction:', error.message);
                    process.exit(1);
                }
            }
        }
        for (const row of dawitMispriced) {
            row.amount = '499.00';
        }
    }

    const userIds = [...new Set(walletRows.map((row) => row.userId).filter(Boolean))];
    const { data: providersRaw, error: providerError } = await admin
        .from('provider')
        .select('id, firstName, lastName, email, walletAmount')
        .in('id', userIds);

    if (providerError) {
        console.error('provider:', providerError.message);
        process.exit(1);
    }

    const providers = (providersRaw ?? []) as ProviderRow[];
    const fixes: Array<{
        provider: ProviderRow;
        stored: number;
        ledgerNet: number;
    }> = [];

    for (const provider of providers) {
        const stored = parseStoredWallet(provider.walletAmount);
        const ledgerNet = Math.round(ledgerNetForUser(walletRows, provider.id) * 100) / 100;
        if (stored === 0 && Math.abs(ledgerNet) >= 0.01) {
            fixes.push({ provider, stored, ledgerNet });
        }
    }

    fixes.sort((left, right) => right.ledgerNet - left.ledgerNet);

    console.log(`\nProvider walletAmount fixes (stored 0, ledger non-zero): ${fixes.length}`);
    for (const fix of fixes) {
        console.log(
            `  ${providerName(fix.provider)} <${fix.provider.email ?? '—'}> | ${fix.stored.toFixed(2)} → ${fix.ledgerNet.toFixed(2)} | ${fix.provider.id}`
        );
    }

    if (fixes.length === 0) {
        console.log('Nothing to fix.');
        return;
    }

    if (dryRun) {
        console.log('\nDry run only. Re-run with --apply to update provider.walletAmount.');
        return;
    }

    if (!process.argv.includes('--apply')) {
        console.log('\nPass --apply to update provider.walletAmount (or --dry-run to preview only).');
        return;
    }

    for (const fix of fixes) {
        const { error } = await admin
            .from('provider')
            .update({ walletAmount: fix.ledgerNet.toFixed(2) })
            .eq('id', fix.provider.id);

        if (error) {
            console.error(`Failed ${fix.provider.id}:`, error.message);
            process.exit(1);
        }
    }

    console.log(`\nUpdated walletAmount for ${fixes.length} provider(s).`);
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
});
