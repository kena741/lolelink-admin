import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import { fetchChapaEtbBalance, isChapaSuccessStatus, loadChapaSecretKey } from '../src/lib/chapa-config';
import {
    computeWalletMetrics,
    sumChapaNetFlow,
    sumNetFlow,
    sumNonChapaNetFlow,
} from '../src/lib/wallet-transaction-metrics';

interface BackfillTarget {
    bookingId: string;
    providerRef: string;
    chapaAmount: number;
    createdAt: string;
    customerId: string;
    skip?: boolean;
    skipReason?: string;
}

function fmt(n: number): string {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function verifyChapaAmount(secretKey: string, txRef: string): Promise<{ ok: true; amount: number } | { ok: false; error: string }> {
    const response = await fetch(`https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(txRef)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${secretKey}` },
    });

    const payload = (await response.json()) as {
        status?: string;
        message?: string;
        data?: { status?: string; amount?: number };
    };

    if (!response.ok) {
        return { ok: false, error: payload.message || 'Chapa verify failed' };
    }

    const txStatus = String(payload.data?.status ?? '').toLowerCase();
    if (!isChapaSuccessStatus(txStatus)) {
        return { ok: false, error: `Chapa status is ${txStatus || 'unknown'}` };
    }

    const amount = Number(payload.data?.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, error: 'Chapa amount missing or invalid' };
    }

    return { ok: true, amount };
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
    const secretKey = await loadChapaSecretKey(admin);
    if (!secretKey) {
        console.error('Missing Chapa secret key');
        process.exit(1);
    }

    const targets: BackfillTarget[] = [
        {
            bookingId: 'f8dcec42-fec2-4810-864b-cd194a716d43',
            providerRef: 'bkg-f8dcec42fec2-1781773186560',
            chapaAmount: 27.8,
            createdAt: '2026-06-18T08:59:47.786Z',
            customerId: 'e626b0bc-d085-4038-aa41-7ebf4de63019',
        },
        {
            bookingId: 'e1ae80a7-2bbd-437d-8811-b18ccb4627f3',
            providerRef: 'bkg-e1ae80a72bbd-1781774598994',
            chapaAmount: 27.8,
            createdAt: '2026-06-18T09:23:20.49Z',
            customerId: 'e626b0bc-d085-4038-aa41-7ebf4de63019',
        },
        {
            bookingId: 'a21a90ef-c8ba-4bfb-8c6b-52afead6eddf',
            providerRef: 'svc_a21a90efc8_1781775264064_APJ7ZD',
            chapaAmount: 374.05,
            createdAt: '2026-06-18T09:35:06.405197Z',
            customerId: '8a8f7b79-d371-4a7e-b140-162da35cc5cc',
        },
    ];

    const { data: walletBefore } = await admin.from('wallet_transaction').select('*');
    const walletRowsBefore = walletBefore ?? [];

    console.log(dryRun ? '\nDRY RUN — pass --apply to insert rows\n' : '\nAPPLYING backfill\n');

    let insertCount = 0;
    let insertTotal = 0;

    for (const target of targets) {
        const { data: existing } = await admin
            .from('wallet_transaction')
            .select('id, amount, note')
            .eq('transactionId', target.providerRef)
            .maybeSingle();

        if (existing) {
            console.log(`SKIP ${target.bookingId.slice(0, 8)}… — wallet row exists for ${target.providerRef}`);
            target.skip = true;
            target.skipReason = 'existing_wallet_transaction';
            continue;
        }

        const verified = await verifyChapaAmount(secretKey, target.providerRef);
        if (!verified.ok) {
            console.log(`SKIP ${target.bookingId.slice(0, 8)}… — ${verified.error}`);
            target.skip = true;
            target.skipReason = verified.error;
            continue;
        }

        const { data: customerRow } = await admin
            .from('customer')
            .select('user_id')
            .eq('id', target.customerId)
            .maybeSingle();
        const customerAuthUserId =
            typeof (customerRow as { user_id?: string } | null)?.user_id === 'string'
                ? (customerRow as { user_id: string }).user_id.trim()
                : '';
        if (!customerAuthUserId) {
            console.log(`SKIP ${target.bookingId.slice(0, 8)}… — customer has no auth user_id`);
            target.skip = true;
            target.skipReason = 'missing_customer_auth_user_id';
            continue;
        }

        const amount = verified.amount.toFixed(2);
        const note = `Booking payment (Chapa backfill) ${target.bookingId}`;

        console.log(
            `${dryRun ? 'WOULD INSERT' : 'INSERT'} | booking ${target.bookingId.slice(0, 8)}… | ETB ${amount} | ref ${target.providerRef}`
        );

        if (!dryRun) {
            const { error } = await admin.from('wallet_transaction').insert({
                amount,
                createdDate: target.createdAt,
                isCredit: true,
                note,
                paymentType: 'chapa',
                transactionId: target.providerRef,
                type: 'customer',
                userId: customerAuthUserId,
            });

            if (error) {
                console.error(`FAILED ${target.bookingId}: ${error.message}`);
                process.exit(1);
            }
        }

        insertCount += 1;
        insertTotal += verified.amount;
    }

    console.log(`\n${dryRun ? 'Planned' : 'Inserted'}: ${insertCount} row(s), ETB ${fmt(insertTotal)}`);

    if (dryRun) {
        console.log('\nRe-run with --apply to write rows.');
        return;
    }

    const { data: walletAfter } = await admin.from('wallet_transaction').select('*');
    const walletRows = walletAfter ?? [];
    const metrics = computeWalletMetrics(walletRows);
    const chapaBalance = await fetchChapaEtbBalance(secretKey);

    console.log('\nPOST-BACKFILL SUMMARY');
    console.log('────────────────────────────────────────');
    console.log(`  Wallet rows              ${walletRows.length} (was ${walletRowsBefore.length})`);
    console.log(`  Net Flow                 ETB ${fmt(sumNetFlow(walletRows, { adjusted: true }))}`);
    console.log(`  App wallet Chapa net     ETB ${fmt(sumChapaNetFlow(walletRows))}`);
    console.log(`  Non-Chapa net            ETB ${fmt(sumNonChapaNetFlow(walletRows))}`);
    console.log(`  Chapa available (live)   ETB ${fmt(chapaBalance.availableBalance)}`);
    console.log(`  Chapa avail − App Chapa  ETB ${fmt(chapaBalance.availableBalance - sumChapaNetFlow(walletRows))}`);
    console.log(`  Chapa avail − Net Flow   ETB ${fmt(chapaBalance.availableBalance - sumNetFlow(walletRows, { adjusted: true }))}`);
    console.log(`  Activation fee           ETB ${fmt(metrics.totalActivationFeeAdjusted)}`);
    console.log(`  Customer top up          ETB ${fmt(metrics.totalCustomerTopUpAdjusted)}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
