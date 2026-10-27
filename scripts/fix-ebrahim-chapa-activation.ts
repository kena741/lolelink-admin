import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import {
    fetchChapaTransactionsPage,
    loadChapaSecretKey,
    resolveChapaSettlementAmount,
    verifyChapaTransaction,
} from '../src/lib/chapa-config';
import { resolveServicePostingTierByPrice, DEFAULT_SERVICE_POSTING_TIERS } from '../src/lib/service-posting-tiers';
import { walletTransactionProfileColumns } from '../src/lib/wallet-transaction-profile';

const EMAIL = 'ibro25623@gmail.com';
const CANDIDATE_REFS = ['DJR2CU06OA'];
const FALLBACK_PAID_AT = '2026-10-27T07:08:16.000Z'; // receipt 27/10/2026 10:08:16 EAT
const EXPECTED_GROSS = 99;

async function findChapaTx(secretKey: string) {
    for (const ref of CANDIDATE_REFS) {
        const verified = await verifyChapaTransaction(secretKey, ref);
        if (verified.ok) {
            return { source: `verify:${ref}`, data: verified.data };
        }
        console.log(`verify ${ref}:`, verified.ok === false ? verified.error : 'ok');
    }

    for (let page = 1; page <= 20; page++) {
        const { transactions, pagination } = await fetchChapaTransactionsPage(secretKey, page);
        const hit = transactions.find((tx) => {
            const email = String(tx.email ?? '').toLowerCase();
            const refId = String(tx.ref_id ?? '');
            const transId = String(tx.trans_id ?? '');
            const amount = Number(tx.amount ?? 0);
            const created = String(tx.created_at ?? '');
            return (
                email === EMAIL.toLowerCase() ||
                refId === 'DJR2CU06OA' ||
                transId === 'DJR2CU06OA' ||
                refId.includes('DJR2CU06OA') ||
                transId.includes('DJR2CU06OA') ||
                (Math.abs(amount - EXPECTED_GROSS) < 0.01 && created.startsWith('2026-10-27'))
            );
        });
        if (hit) {
            const txRef = String(hit.ref_id || hit.trans_id || '');
            const verified = txRef ? await verifyChapaTransaction(secretKey, txRef) : null;
            if (verified?.ok) return { source: `list:page${page}`, data: verified.data, list: hit };
            return { source: `list:page${page}:unverified`, data: hit as Record<string, unknown>, list: hit };
        }
        if (!pagination.next_page_url) break;
    }

    return null;
}

async function main(): Promise<void> {
    loadEnvLocal();
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

    const { data: provider, error: providerError } = await admin
        .from('provider')
        .select(
            'id, user_id, email, firstName, lastName, phoneNumber, walletAmount, active, activation_paid, activation_paid_at, activation_tx_ref, service_tier_max, service_tier_tx_ref'
        )
        .ilike('email', EMAIL)
        .maybeSingle();

    if (providerError || !provider) {
        console.error('Provider not found:', providerError?.message);
        process.exit(1);
    }

    const providerId = String(provider.id);
    console.log('Provider before:', provider);

    const found = await findChapaTx(secretKey);
    if (!found) {
        console.error('Could not find matching Chapa transaction for DJR2CU06OA /', EMAIL);
        process.exit(1);
    }

    console.log('Chapa match source:', found.source);
    console.log('Chapa data:', JSON.stringify(found.data, null, 2));
    if ('list' in found) console.log('List row:', JSON.stringify(found.list, null, 2));

    const chapa = found.data as {
        status?: string;
        amount?: number | string;
        charge?: number | string;
        tx_ref?: string;
        reference?: string;
        email?: string;
        created_at?: string;
    };

    const status = String(chapa.status ?? '').toLowerCase();
    if (status && status !== 'success' && status !== 'successful') {
        console.error('Chapa status is not success:', chapa.status);
        process.exit(1);
    }

    const gross = Number(chapa.amount ?? EXPECTED_GROSS);
    const charge = Number(chapa.charge ?? 0);
    const settlement = resolveChapaSettlementAmount({
        amount: gross,
        charge,
    });
    const feeAmount =
        settlement != null && settlement >= 50
            ? settlement.toFixed(2)
            : Math.abs(gross - EXPECTED_GROSS) < 0.01
              ? '96.52'
              : gross.toFixed(2);

    const tier =
        resolveServicePostingTierByPrice(DEFAULT_SERVICE_POSTING_TIERS, EXPECTED_GROSS) ??
        DEFAULT_SERVICE_POSTING_TIERS[0];

    const txRef =
        String(chapa.tx_ref || '').trim() ||
        String(chapa.reference || '').trim() ||
        'DJR2CU06OA';

    const paidAt =
        typeof chapa.created_at === 'string' && chapa.created_at
            ? chapa.created_at
            : FALLBACK_PAID_AT;
    const authUserId = String(provider.user_id || provider.id);

    const nextWallet =
        Math.round((Number(provider.walletAmount ?? 0) + Number(feeAmount)) * 100) / 100;

    const plan = {
        provider_id: providerId,
        email: provider.email,
        activation_paid: true,
        activation_paid_at: paidAt,
        activation_tx_ref: txRef,
        active: true,
        service_tier_max: tier.max_services,
        service_tier_tx_ref: txRef,
        service_tier_paid_at: paidAt,
        walletAmount: nextWallet.toFixed(2),
        wallet_credit: feeAmount,
        tier_amount: tier.total_price,
        chapa_reference: chapa.reference ?? null,
        gross,
        charge,
    };

    console.log('\nPlan:', JSON.stringify(plan, null, 2));

    if (!apply) {
        console.log('\nPass --apply to execute.');
        return;
    }

    if (provider.activation_paid === true) {
        console.error('Provider already activation_paid; aborting to avoid double credit.');
        process.exit(1);
    }

    const { data: existingWallet } = await admin
        .from('wallet_transaction')
        .select('id')
        .eq('transactionId', txRef)
        .maybeSingle();

    if (existingWallet) {
        console.error('Wallet tx already exists for txRef', txRef, existingWallet.id);
        process.exit(1);
    }

    const { error: updateError } = await admin
        .from('provider')
        .update({
            activation_paid: true,
            activation_paid_at: paidAt,
            activation_tx_ref: txRef,
            active: true,
            service_tier_max: tier.max_services,
            service_tier_tx_ref: txRef,
            service_tier_paid_at: paidAt,
            walletAmount: nextWallet.toFixed(2),
        })
        .eq('id', providerId);

    if (updateError) {
        console.error('Provider update failed:', updateError.message);
        process.exit(1);
    }

    const { error: walletError } = await admin.from('wallet_transaction').insert({
        amount: feeAmount,
        createdDate: paidAt,
        isCredit: true,
        note: `Activation payment top up (Chapa, net after fee) - manual reconcile ref ${chapa.reference ?? 'DJR2CU06OA'}`,
        paymentType: 'chapa',
        transactionId: txRef,
        type: 'provider',
        ...walletTransactionProfileColumns({
            type: 'provider',
            authUserId,
            providerId,
        }),
    });

    if (walletError) {
        console.error('Wallet insert failed:', walletError.message);
        process.exit(1);
    }

    const { error: tierError } = await admin.from('service_tier_payment').insert({
        provider_id: providerId,
        user_id: authUserId,
        from_tier_max: 0,
        to_tier_max: tier.max_services,
        amount: tier.total_price,
        tx_ref: txRef,
        chapa_status: 'success',
        created_at: paidAt,
    });

    if (tierError) {
        console.error('service_tier_payment insert failed:', tierError.message);
        process.exit(1);
    }

    const { data: existingNotif } = await admin
        .from('notification')
        .select('id')
        .eq('type', 'activation_payment_confirmed')
        .eq('provider_id', providerId)
        .limit(1)
        .maybeSingle();

    if (!existingNotif) {
        await admin.from('notification').insert({
            title: 'Account Activated',
            description: `Your activation fee of ETB ${tier.total_price.toFixed(2)} has been confirmed. Your account is now active.`,
            type: 'activation_payment_confirmed',
            provider_id: providerId,
            is_read: false,
        });
    }

    const { data: after } = await admin
        .from('provider')
        .select(
            'id, email, walletAmount, active, activation_paid, activation_paid_at, activation_tx_ref, service_tier_max, service_tier_tx_ref, service_tier_paid_at'
        )
        .eq('id', providerId)
        .maybeSingle();

    console.log('\nDone. Provider after:', after);
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
