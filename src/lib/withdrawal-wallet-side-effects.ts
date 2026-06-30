import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveProviderAuthUserId } from '@/lib/wallet-transaction-user';
import { walletTransactionProfileColumns } from '@/lib/wallet-transaction-profile';
import {
    calculateWithdrawalPayoutBreakdown,
    formatWithdrawalPayoutBreakdownNote,
    parseWithdrawalAmount,
} from '@/lib/withdrawal-payout';

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
        .select('id, providerId, amount, paymentStatus, paymentDate')
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
        paymentDate?: string | null;
    };

    const paymentStatus = (withdrawal.paymentStatus ?? '').toString().trim().toLowerCase();
    if (paymentStatus !== 'completed') {
        return { ok: false, error: `Withdrawal status is "${withdrawal.paymentStatus ?? 'unknown'}", not completed` };
    }

    const amount = parseWithdrawalAmount(withdrawal.amount);
    if (amount <= 0) {
        return { ok: true, skipped: true, reason: 'zero_amount' };
    }

    const payoutBreakdown = calculateWithdrawalPayoutBreakdown(amount);
    const ledgerDebitAmount = payoutBreakdown.grossAmount;
    const paymentDate =
        typeof withdrawal.paymentDate === 'string' && withdrawal.paymentDate.trim()
            ? withdrawal.paymentDate.trim()
            : new Date().toISOString();

    const providerId = (withdrawal.providerId ?? '').trim();
    if (!providerId) {
        return { ok: false, error: 'Provider is missing on withdrawal request' };
    }

    const authUser = await resolveProviderAuthUserId(admin, providerId);
    if (!authUser.ok) {
        return { ok: false, error: authUser.error };
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
    const nextWallet = Math.round((currentWallet - ledgerDebitAmount) * 100) / 100;

    const { error: walletTxError } = await admin.from('wallet_transaction').insert({
        amount: ledgerDebitAmount.toFixed(2),
        createdDate: paymentDate,
        isCredit: false,
        note: `Withdrawal payout ${normalizedWithdrawalId} (${formatWithdrawalPayoutBreakdownNote(payoutBreakdown)})`,
        paymentType: 'wallet',
        transactionId,
        type: 'provider',
        ...walletTransactionProfileColumns({
            type: 'provider',
            authUserId: authUser.authUserId,
            providerId,
        }),
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

    return { ok: true, skipped: false, amount: ledgerDebitAmount, walletAmount: nextWallet };
}
