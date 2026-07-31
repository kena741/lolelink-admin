import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import {
    buildPayoutActivityMetadata,
    buildPayoutActivitySummary,
    loadWithdrawalActivityContext,
} from '@/lib/payout-activity-log';

export const runtime = 'nodejs';

interface ReviewWithdrawalBody {
    withdrawalId: string;
    action: 'approve' | 'reject';
    adminNote?: string;
    rejectionReason?: string;
}

export async function POST(request: Request) {
    const auth = await requireAdminPermission(request, 'finance:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);

    try {
        const body = (await request.json()) as ReviewWithdrawalBody;
        const withdrawalId = (body.withdrawalId ?? '').trim();
        const action = body.action;

        if (!withdrawalId) {
            return NextResponse.json({ error: 'withdrawalId is required' }, { status: 400 });
        }
        if (action !== 'approve' && action !== 'reject') {
            return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
        }

        const updateData: {
            paymentStatus: string;
            adminNote?: string;
            rejectionReason?: string;
        } = {
            paymentStatus: action === 'approve' ? 'approved' : 'rejected',
        };

        if (action === 'approve' && body.adminNote?.trim()) {
            updateData.adminNote = body.adminNote.trim();
        }

        if (action === 'reject') {
            const rejectionReason = (body.rejectionReason ?? '').trim();
            if (!rejectionReason) {
                return NextResponse.json({ error: 'rejectionReason is required' }, { status: 400 });
            }
            updateData.rejectionReason = rejectionReason;
        }

        const { data, error } = await supabaseAdmin
            .from('withdrawal_history')
            .update(updateData)
            .eq('id', withdrawalId)
            .eq('paymentStatus', 'pending')
            .select()
            .single();

        if (error || !data) {
            return NextResponse.json(
                { error: error?.message || 'Failed to update withdrawal request' },
                { status: error ? 500 : 404 }
            );
        }

        const payoutContext = await loadWithdrawalActivityContext(supabaseAdmin, withdrawalId);
        const actionVerb = action === 'approve' ? 'Approved' : 'Rejected';

        await logAdminActivity({
            request,
            action: action === 'approve' ? 'approve' : 'reject',
            resource_type: 'withdrawal',
            resource_id: withdrawalId,
            summary: payoutContext
                ? buildPayoutActivitySummary(`${actionVerb} withdrawal`, payoutContext)
                : `${actionVerb} withdrawal ${withdrawalId}`,
            metadata: payoutContext
                ? buildPayoutActivityMetadata(payoutContext, {
                      rejection_reason: action === 'reject' ? updateData.rejectionReason : null,
                  })
                : {
                      provider_id: (data as { providerId?: string }).providerId,
                      amount: (data as { amount?: string | number }).amount,
                      rejection_reason: action === 'reject' ? updateData.rejectionReason : null,
                  },
        });

        return NextResponse.json({ status: 'success', data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
