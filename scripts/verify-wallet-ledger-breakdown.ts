import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import { walletTransactionMagnitude } from '../src/lib/wallet-transaction-metrics';

const TARGET_EMAILS = [
    'foziakassa07@gmail.com',
    'foziakassa@gmail.com',
    'meleseayen2016@gmail.com',
    'ggz@gmail.com',
    'foziaka&/ssa@gmail.com',
    'gediyontadese@gmail.com',
    'abebebiruk452@gmail.com',
];

async function main(): Promise<void> {
    loadEnvLocal();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing Supabase env');
        process.exit(1);
    }

    const admin = createClient(url, key);
    const [{ data: customers }, { data: providers }] = await Promise.all([
        admin.from('customer').select('id, user_id, email, wallet_amount'),
        admin.from('provider').select('id, user_id, email, walletAmount'),
    ]);

    for (const email of TARGET_EMAILS) {
        const customer = (customers ?? []).find((row) => row.email === email);
        const provider = (providers ?? []).find((row) => row.email === email);
        const authUserId = customer?.user_id ?? provider?.user_id;
        if (!authUserId) {
            console.log(`\n=== ${email} — not found`);
            continue;
        }

        const { data: rows } = await admin
            .from('wallet_transaction')
            .select('id, createdDate, isCredit, amount, note, transactionId')
            .eq('userId', authUserId)
            .order('createdDate', { ascending: true });

        let runningNet = 0;
        const stored = customer
            ? Number(customer.wallet_amount ?? 0)
            : Number(provider?.walletAmount ?? 0);

        console.log(`\n=== ${email}`);
        console.log(`stored: ${stored.toFixed(2)} | role: ${customer ? 'customer' : 'provider'}`);

        for (const row of rows ?? []) {
            const magnitude = walletTransactionMagnitude(row.amount);
            const delta = row.isCredit === true ? magnitude : -magnitude;
            runningNet += delta;
            const sign = row.isCredit === true ? '+' : '-';
            console.log(
                `  ${sign}${magnitude.toFixed(2)} → ${runningNet.toFixed(2)} | ${(row.note ?? '').slice(0, 60)}`
            );
        }

        const ledger = Math.round(runningNet * 100) / 100;
        const drift = Math.round((stored - ledger) * 100) / 100;
        console.log(`ledger: ${ledger.toFixed(2)} | drift (stored - ledger): ${drift.toFixed(2)}`);
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
