import type { SupabaseClient } from '@supabase/supabase-js';

function parseAmount(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function withdrawalWalletTransactionId(withdrawalId: string): string {
    return `withdrawal:${withdrawalId}`;
}

export async function deductProviderWalletForWithdrawal(
    admin: SupabaseClient,
    withdrawalId: string
): Promise<
    | { ok: true; skipped: true; reason: 'already_deducted' | 'zero_amount' }
    | { ok: true; skipped: false; amount: number; walletAmount: number }
    | { ok: false; error: string }
> {
    const normalizedWithdrawalId = withdrawalId.trim();
    if (!normalizedWithdrawalId) {
        return { ok: false, error: 'withdrawalId is required' };
    }

    const transactionId = withdrawalWalletTransactionId(normalizedWithdrawalId);

    const { data: existingTx, error: existingTxError } = await admin
        .from('wallet_transaction')
        .select('id')
        .eq('transactionId', transactionId)
        .eq('isCredit', false)
        .maybeSingle();

    if (existingTxError) {
        return { ok: false, error: existingTxError.message };
    }
    if (existingTx) {
        return { ok: true, skipped: true, reason: 'already_deducted' };
    }

    const { data: withdrawalRaw, error: withdrawalError } = await admin
        .from('withdrawal_history')
        .select('id, providerId, amount, paymentStatus')
        .eq('id', normalizedWithdrawalId)
        .maybeSingle();

    if (withdrawalError) {
        return { ok: false, error: withdrawalError.message };
    }
    if (!withdrawalRaw) {
        return { ok: false, error: 'Withdrawal request not found' };
    }

    const withdrawal = withdrawalRaw as {
        id: string;
        providerId: string;
        amount: string | number;
        paymentStatus?: string | null;
    };

    const paymentStatus = (withdrawal.paymentStatus ?? '').toString().trim().toLowerCase();
    if (paymentStatus !== 'completed') {
        return { ok: false, error: `Withdrawal status is "${withdrawal.paymentStatus ?? 'unknown'}", not completed` };
    }

    const amount = parseAmount(withdrawal.amount);
    if (amount <= 0) {
        return { ok: true, skipped: true, reason: 'zero_amount' };
    }

    const providerId = (withdrawal.providerId ?? '').trim();
    if (!providerId) {
        return { ok: false, error: 'Provider is missing on withdrawal request' };
    }

    const { data: providerRaw, error: providerError } = await admin
        .from('provider')
        .select('id, walletAmount')
        .eq('id', providerId)
        .maybeSingle();

    if (providerError) {
        return { ok: false, error: providerError.message };
    }
    if (!providerRaw) {
        return { ok: false, error: 'Provider not found' };
    }

    const currentWallet = parseAmount((providerRaw as { walletAmount?: string | number }).walletAmount);
    const nextWallet = Math.round((currentWallet - amount) * 100) / 100;
    const now = new Date().toISOString();

    const { error: walletTxError } = await admin.from('wallet_transaction').insert({
        amount: amount.toFixed(2),
        createdDate: now,
        isCredit: false,
        note: `Withdrawal payout ${normalizedWithdrawalId}`,
        paymentType: 'wallet',
        transactionId,
        type: 'provider',
        userId: providerId,
    });

    if (walletTxError) {
        return { ok: false, error: walletTxError.message };
    }

    const { error: walletUpdateError } = await admin
        .from('provider')
        .update({ walletAmount: nextWallet.toFixed(2) })
        .eq('id', providerId);

    if (walletUpdateError) {
        return { ok: false, error: walletUpdateError.message };
    }

    return { ok: true, skipped: false, amount, walletAmount: nextWallet };
}
