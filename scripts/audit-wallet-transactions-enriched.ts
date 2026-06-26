import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import { resolveWalletAuthUserId } from '../src/lib/wallet-transaction-auth-resolve';
import { buildWalletProfileLookupsByProfileId } from '../src/lib/wallet-transaction-profile';
import {
    buildAuthUserLookup,
    isCustomerWalletTransactionType,
    readAuthUserId,
} from '../src/lib/wallet-transaction-user';
import { walletTransactionMagnitude } from '../src/lib/wallet-transaction-metrics';

interface WalletRow {
    id: string;
    userId: string;
    customer_id: string | null;
    provider_id: string | null;
    type: string;
    amount: string;
    isCredit: boolean;
    note: string;
    transactionId: string;
    paymentType: string;
    createdDate: string;
}

interface IssueBucket {
    count: number;
    sampleIds: string[];
}

function bump(map: Map<string, IssueBucket>, key: string, id: string): void {
    const entry = map.get(key) ?? { count: 0, sampleIds: [] };
    entry.count += 1;
    if (entry.sampleIds.length < 3) entry.sampleIds.push(id);
    map.set(key, entry);
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
    const [{ data: rawRows }, { data: customers }, { data: providers }] = await Promise.all([
        admin.from('wallet_transaction').select('*').order('createdDate', { ascending: true }),
        admin.from('customer').select('id, user_id, email, wallet_amount'),
        admin.from('provider').select('id, user_id, email, walletAmount'),
    ]);

    const rows = (rawRows ?? []) as WalletRow[];
    const { providerById, customerById } = await buildWalletProfileLookupsByProfileId(admin, rows);

    const authIds = new Set<string>();
    for (const row of rows) {
        const raw = readAuthUserId(row.userId);
        if (raw) authIds.add(raw);
    }
    for (const profile of Object.values(customerById)) {
        if (profile.authUserId) authIds.add(profile.authUserId);
    }
    for (const profile of Object.values(providerById)) {
        if (profile.authUserId) authIds.add(profile.authUserId);
    }

    const authUserById = await buildAuthUserLookup(admin, [...authIds]);
    const knownAuthUserIds = new Set(Object.keys(authUserById));

    const customerByAuth = new Map(
        (customers ?? [])
            .filter((c) => c.user_id)
            .map((c) => [String(c.user_id).toLowerCase(), c])
    );
    const providerByAuth = new Map(
        (providers ?? [])
            .filter((p) => p.user_id)
            .map((p) => [String(p.user_id).toLowerCase(), p])
    );

    const issues = new Map<string, IssueBucket>();
    const ledgerByAuthUser = new Map<string, number>();
    const cleanRowIds: string[] = [];

    let withCustomerProfile = 0;
    let withProviderProfile = 0;
    let sharedProfileAuthId = 0;

    for (const row of rows) {
        const type = (row.type ?? '').trim().toLowerCase();
        const customerProfileId = readAuthUserId(row.customer_id) ?? '';
        const providerProfileId = readAuthUserId(row.provider_id) ?? '';
        const customerFromProfile = customerProfileId ? customerById[customerProfileId] : undefined;
        const providerFromProfile = providerProfileId ? providerById[providerProfileId] : undefined;

        const { authUserId, userIdStoredAsProfile } = resolveWalletAuthUserId({
            rawUserId: row.userId,
            customerProfile: customerFromProfile
                ? { profileId: customerFromProfile.profileId, authUserId: customerFromProfile.authUserId }
                : null,
            providerProfile: providerFromProfile
                ? { profileId: providerFromProfile.profileId, authUserId: providerFromProfile.authUserId }
                : null,
            knownAuthUserIds,
        });

        if (customerProfileId) withCustomerProfile += 1;
        if (providerProfileId) withProviderProfile += 1;

        const profileId = customerProfileId || providerProfileId;
        if (profileId && authUserId && profileId.toLowerCase() === authUserId.toLowerCase()) {
            sharedProfileAuthId += 1;
        }

        const magnitude = walletTransactionMagnitude(row.amount);
        const rawAmount = Number(row.amount);
        const isCredit = row.isCredit === true;
        let rowHasIssue = false;

        if (rawAmount < 0) {
            bump(issues, 'negative_amount_stored', row.id);
            rowHasIssue = true;
        }
        if (magnitude < 0.005) {
            bump(issues, 'zero_amount_row', row.id);
            rowHasIssue = true;
        }
        if (!readAuthUserId(row.userId)) {
            bump(issues, 'missing_user_id', row.id);
            rowHasIssue = true;
        }
        if (!authUserId || !knownAuthUserIds.has(authUserId)) {
            bump(issues, 'auth_user_not_found', row.id);
            rowHasIssue = true;
        }
        if (userIdStoredAsProfile) {
            bump(issues, 'ledger_user_id_is_profile_not_auth', row.id);
            rowHasIssue = true;
        }

        if (type === 'customer') {
            if (!customerProfileId) {
                bump(issues, 'customer_type_missing_customer_id', row.id);
                rowHasIssue = true;
            } else if (providerProfileId) {
                bump(issues, 'customer_type_has_provider_id', row.id);
                rowHasIssue = true;
            }
        }

        if (type === 'provider' || type === 'provider_payout') {
            if (!providerProfileId) {
                bump(issues, 'provider_type_missing_provider_id', row.id);
                rowHasIssue = true;
            } else if (customerProfileId) {
                bump(issues, 'provider_type_has_customer_id', row.id);
                rowHasIssue = true;
            }
        }

        if (customerProfileId && !customerFromProfile) {
            bump(issues, 'orphan_customer_profile_id', row.id);
            rowHasIssue = true;
        }
        if (providerProfileId && !providerFromProfile) {
            bump(issues, 'orphan_provider_profile_id', row.id);
            rowHasIssue = true;
        }

        const delta = isCredit ? magnitude : -magnitude;
        if (authUserId) {
            ledgerByAuthUser.set(authUserId, (ledgerByAuthUser.get(authUserId) ?? 0) + delta);
        }

        if (!rowHasIssue) cleanRowIds.push(row.id);
    }

    const walletMismatches: Array<{ authUserId: string; email: string; role: string; stored: number; ledger: number; delta: number }> = [];
    for (const [authUserId, ledger] of ledgerByAuthUser) {
        const customer = customerByAuth.get(authUserId.toLowerCase());
        const provider = providerByAuth.get(authUserId.toLowerCase());
        const stored = customer
            ? Number(customer.wallet_amount ?? 0)
            : provider
              ? Number(provider.walletAmount ?? 0)
              : null;
        if (stored === null) continue;
        const roundedLedger = Math.round(ledger * 100) / 100;
        const delta = Math.round((stored - roundedLedger) * 100) / 100;
        if (Math.abs(delta) > 0.01) {
            walletMismatches.push({
                authUserId,
                email: String(customer?.email ?? provider?.email ?? ''),
                role: customer ? 'customer' : 'provider',
                stored,
                ledger: roundedLedger,
                delta,
            });
        }
    }

    walletMismatches.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const credits = rows.filter((r) => r.isCredit === true);
    const debits = rows.filter((r) => r.isCredit !== true);
    const totalCredit = credits.reduce((s, r) => s + walletTransactionMagnitude(r.amount), 0);
    const totalDebit = debits.reduce((s, r) => s + walletTransactionMagnitude(r.amount), 0);

    console.log(JSON.stringify({
        summary: {
            totalRows: rows.length,
            credits: credits.length,
            debits: debits.length,
            totalCreditGross: Math.round(totalCredit * 100) / 100,
            totalDebitGross: Math.round(totalDebit * 100) / 100,
            withCustomerProfileId: withCustomerProfile,
            withProviderProfileId: withProviderProfile,
            profileIdEqualsAuthUserId: sharedProfileAuthId,
            structurallyCleanRows: cleanRowIds.length,
            structurallyIssueRows: rows.length - cleanRowIds.length,
            walletBalanceMismatches: walletMismatches.length,
        },
        issues: [...issues.entries()]
            .sort((a, b) => b[1].count - a[1].count)
            .map(([key, value]) => ({ issue: key, ...value })),
        walletMismatches: walletMismatches.slice(0, 15),
        notes: [
            'structurallyCleanRows = no profile/auth/amount flags in enriched audit',
            'walletBalanceMismatches compares ledger sum (by auth user) vs customer.wallet_amount / provider.walletAmount',
            'sharedProfileAuthId is expected when profile.id === user_id in your DB',
        ],
    }, null, 2));
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
