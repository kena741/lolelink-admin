import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import { parseWalletAmount } from '../src/lib/wallet-transaction-metrics';

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

    const dryRun = process.argv.includes('--dry-run');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing Supabase env');
        process.exit(1);
    }

    const admin = createClient(url, key);
    const { data, error } = await admin.from('wallet_transaction').select('id, amount, isCredit, note');

    if (error) {
        console.error('Failed to load wallet_transaction:', error.message);
        process.exit(1);
    }

    const fixes: Array<{ id: string; from: number; to: string; note: string }> = [];

    for (const row of data ?? []) {
        const r = row as Record<string, unknown>;
        const id = String(r.id ?? '');
        const isCredit = r.isCredit === true;
        const amount = parseWalletAmount(r.amount as string | number);
        const note = String(r.note ?? '');

        if (!id) continue;

        if (isCredit && amount < 0) {
            fixes.push({ id, from: amount, to: Math.abs(amount).toFixed(2), note });
            continue;
        }

        if (!isCredit && amount < 0) {
            fixes.push({ id, from: amount, to: Math.abs(amount).toFixed(2), note });
        }
    }

    console.log(`Found ${fixes.length} wallet_transaction row(s) with invalid signed amounts.`);
    for (const fix of fixes) {
        console.log(`  ${fix.id}: ${fix.from} → ${fix.to} | ${fix.note.slice(0, 70)}`);
    }

    if (fixes.length === 0) {
        console.log('Nothing to fix.');
        return;
    }

    if (dryRun) {
        console.log('\nDry run only. Re-run without --dry-run to apply.');
        return;
    }

    for (const fix of fixes) {
        const { error: updateError } = await admin
            .from('wallet_transaction')
            .update({ amount: fix.to })
            .eq('id', fix.id);

        if (updateError) {
            console.error(`Failed to update ${fix.id}:`, updateError.message);
            process.exit(1);
        }
    }

    console.log(`Updated ${fixes.length} row(s).`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
