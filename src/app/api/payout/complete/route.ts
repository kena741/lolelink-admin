import { NextResponse } from 'next/server';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { deductProviderWalletForWithdrawal } from '@/lib/withdrawal-wallet-side-effects';
import {
    buildPayoutActivityMetadata,
    buildPayoutActivitySummary,
    loadWithdrawalActivityContext,
} from '@/lib/payout-activity-log';

export const runtime = 'nodejs';

interface CompleteWithdrawalBody {
    withdrawalId: string;
    adminNote?: string;
}

export async function POST(request: Request) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as CompleteWithdrawalBody;
        const withdrawalId = (body.withdrawalId ?? '').trim();
        if (!withdrawalId) {
            return NextResponse.json({ error: 'withdrawalId is required' }, { status: 400 });
        }

        const updateData: {
            paymentStatus: string;
            paymentDate: string;
            adminNote?: string;
        } = {
            paymentStatus: 'completed',
            paymentDate: new Date().toISOString(),
        };

        if (body.adminNote?.trim()) {
            updateData.adminNote = body.adminNote.trim();
        }

        const { data, error } = await supabaseAdmin
            .from('withdrawal_history')
            .update(updateData)
            .eq('id', withdrawalId)
            .select('id, providerId, amount, paymentStatus, adminNote, createdDate, paymentDate, note')
            .single();

        if (error || !data) {
            return NextResponse.json(
                { error: error?.message || 'Failed to complete withdrawal request' },
                { status: 500 }
            );
        }

        const walletResult = await deductProviderWalletForWithdrawal(supabaseAdmin, withdrawalId);
        if (!walletResult.ok) {
            return NextResponse.json(
                {
                    error: `Withdrawal marked completed but wallet deduction failed: ${walletResult.error}`,
                    withdrawal: data,
                },
                { status: 500 }
            );
        }

        const payoutContext = await loadWithdrawalActivityContext(supabaseAdmin, withdrawalId);

        await logAdminActivity({
            request,
            action: 'transfer',
            resource_type: 'withdrawal',
            resource_id: withdrawalId,
            summary: payoutContext
                ? buildPayoutActivitySummary('Marked withdrawal as completed', payoutContext)
                : `Marked withdrawal ${withdrawalId} as completed`,
            metadata: payoutContext
                ? buildPayoutActivityMetadata(payoutContext, {
                      wallet_deducted: !walletResult.skipped,
                      wallet_skipped_reason: walletResult.skipped ? walletResult.reason : null,
                  })
                : {
                      provider_id: (data as { providerId?: string }).providerId,
                      amount: (data as { amount?: string | number }).amount,
                      wallet_deducted: !walletResult.skipped,
                      wallet_skipped_reason: walletResult.skipped ? walletResult.reason : null,
                  },
        });

        return NextResponse.json({
            status: 'success',
            data,
            wallet: walletResult,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
