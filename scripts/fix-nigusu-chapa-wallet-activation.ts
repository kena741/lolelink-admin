import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import {
    loadChapaSecretKey,
    resolveChapaWalletCreditAmount,
    verifyChapaTransaction,
} from '../src/lib/chapa-config';
import { walletTransactionMagnitude } from '../src/lib/wallet-transaction-metrics';

const WALLET_TX_ID = '0497d3ef-cd79-4a7c-9437-03fe2d7c0a5e';
const TX_REF = 'wallet_1779743509856';
const PROVIDER_ID = '4953f2ea-b484-4a03-aac0-b953f6e75a03';

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

    const admin = createClient(url, key);
    const secretKey = await loadChapaSecretKey(admin);
    if (!secretKey) {
        console.error('Missing Chapa secret key');
        process.exit(1);
    }

    const verified = await verifyChapaTransaction(secretKey, TX_REF);
    if (!verified.ok) {
        console.error('Chapa verify failed:', verified.error);
        process.exit(1);
    }

    const creditAmount = resolveChapaWalletCreditAmount(verified.data, '499');
    const chapaGross = Number(verified.data.amount ?? 0);
    const chapaCharge = Number(verified.data.charge ?? 0);

    const { data: row, error: rowError } = await admin
        .from('wallet_transaction')
        .select('id, amount, paymentType, note, userId')
        .eq('id', WALLET_TX_ID)
        .maybeSingle();

    if (rowError || !row) {
        console.error('Wallet row not found:', rowError?.message);
        process.exit(1);
    }

    const { data: provider, error: providerError } = await admin
        .from('provider')
        .select('id, email, walletAmount')
        .eq('id', PROVIDER_ID)
        .maybeSingle();

    if (providerError || !provider) {
        console.error('Provider not found:', providerError?.message);
        process.exit(1);
    }

    const currentWallet = Number(provider.walletAmount ?? 0);
    const oldAmount = walletTransactionMagnitude(row.amount);
    const nextWallet = Math.round((currentWallet - oldAmount + Number(creditAmount)) * 100) / 100;

    console.log('Chapa verify:', {
        tx_ref: TX_REF,
        gross: chapaGross,
        charge: chapaCharge,
        wallet_credit: creditAmount,
        status: verified.data.status,
    });
    console.log('Wallet row:', {
        id: row.id,
        from: { amount: row.amount, paymentType: row.paymentType },
        to: { amount: creditAmount, paymentType: 'chapa' },
    });
    console.log(`Provider ${provider.email} wallet: ${currentWallet.toFixed(2)} → ${nextWallet.toFixed(2)}`);

    if (dryRun || !apply) {
        console.log(dryRun ? '\nDry run.' : '\nPass --apply to execute.');
        return;
    }

    const { error: updateTxError } = await admin
        .from('wallet_transaction')
        .update({
            amount: creditAmount,
            paymentType: 'chapa',
            note: 'Activation payment top up (Chapa) - Paid on customer wallet, and transferred by admin to provider account',
        })
        .eq('id', WALLET_TX_ID);

    if (updateTxError) {
        console.error('Failed to update wallet_transaction:', updateTxError.message);
        process.exit(1);
    }

    const { error: updateProviderError } = await admin
        .from('provider')
        .update({ walletAmount: nextWallet.toFixed(2) })
        .eq('id', PROVIDER_ID);

    if (updateProviderError) {
        console.error('Failed to update provider wallet:', updateProviderError.message);
        process.exit(1);
    }

    console.log('\nDone. Reclassified as Chapa and set amount to verified wallet credit.');
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
