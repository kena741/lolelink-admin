import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';

interface WalletRow {
    id: string;
    userId: string;
    type: string;
}

async function main(): Promise<void> {
    loadEnvLocal();

    const dryRun = !process.argv.includes('--apply');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing Supabase env');
        process.exit(1);
    }

    const admin = createClient(url, key);
    const [{ data: walletRows }, { data: providers }, { data: customers }] = await Promise.all([
        admin.from('wallet_transaction').select('id, userId, type'),
        admin.from('provider').select('id, user_id'),
        admin.from('customer').select('id, user_id'),
    ]);

    const providerAuthByProfileId = new Map<string, string>();
    const customerAuthByProfileId = new Map<string, string>();
    const authUserIds = new Set<string>();

    for (const provider of providers ?? []) {
        const profileId = String(provider.id ?? '').trim();
        const authUserId = String(provider.user_id ?? '').trim();
        if (profileId && authUserId) {
            providerAuthByProfileId.set(profileId, authUserId);
            authUserIds.add(authUserId);
        }
    }

    for (const customer of customers ?? []) {
        const profileId = String(customer.id ?? '').trim();
        const authUserId = String(customer.user_id ?? '').trim();
        if (profileId && authUserId) {
            customerAuthByProfileId.set(profileId, authUserId);
            authUserIds.add(authUserId);
        }
    }

    const updates: Array<{ id: string; from: string; to: string; type: string }> = [];

    for (const row of (walletRows ?? []) as WalletRow[]) {
        const currentUserId = String(row.userId ?? '').trim();
        if (!currentUserId || authUserIds.has(currentUserId)) continue;

        const normalizedType = String(row.type ?? '').trim().toLowerCase();
        const authUserId =
            normalizedType === 'customer'
                ? customerAuthByProfileId.get(currentUserId)
                : providerAuthByProfileId.get(currentUserId);

        if (!authUserId || authUserId === currentUserId) continue;

        updates.push({
            id: row.id,
            from: currentUserId,
            to: authUserId,
            type: row.type,
        });
    }

    console.log(`${dryRun ? 'Would update' : 'Updating'} ${updates.length} wallet_transaction row(s)`);
    for (const update of updates) {
        console.log(`  ${update.id} | ${update.type} | ${update.from} -> ${update.to}`);
        if (!dryRun) {
            const { error } = await admin
                .from('wallet_transaction')
                .update({ userId: update.to })
                .eq('id', update.id);
            if (error) {
                console.error(`Failed ${update.id}: ${error.message}`);
                process.exit(1);
            }
        }
    }

    if (dryRun && updates.length > 0) {
        console.log('\nRe-run with --apply to write changes.');
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
