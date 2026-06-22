import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { deductProviderWalletForWithdrawal } from '@/lib/withdrawal-wallet-side-effects';

export const runtime = 'nodejs';

interface ChapaWebhookPayload {
    event?: string;
    status?: string;
    tx_ref?: string;
    reference?: string;
    transfer_id?: string;
    data?: {
        tx_ref?: string;
        reference?: string;
        transfer_id?: string;
        status?: string;
    };
}

function normalizeText(value: string | undefined | null): string {
    return (value || '').trim();
}

function resolveReference(payload: ChapaWebhookPayload): string {
    return normalizeText(
        payload.reference ||
        payload.tx_ref ||
        payload.data?.reference ||
        payload.data?.tx_ref
    );
}

function resolveTransferStatus(payload: ChapaWebhookPayload): string {
    return normalizeText(payload.data?.status || payload.status || payload.event).toLowerCase();
}

function mapWithdrawalStatus(status: string): 'completed' | 'rejected' | 'approved' {
    if (['success', 'successful', 'completed', 'paid'].includes(status)) return 'completed';
    if (['failed', 'failure', 'cancelled', 'canceled', 'error', 'reversed'].includes(status)) return 'rejected';
    return 'approved';
}

async function insertNotificationIfMissing(
    admin: SupabaseClient,
    params: {
    title: string;
    description: string;
    type: string;
    action_url?: string;
}
): Promise<void> {
    const { title, description, type, action_url } = params;
    const { data: existing } = await admin
        .from('notification')
        .select('id')
        .eq('type', type)
        .eq('description', description)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (existing) return;
    await admin.from('notification').insert({
        title,
        description,
        type,
        action_url: action_url || null,
        is_read: false,
    });
}

export async function POST(request: Request) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const payload = (await request.json()) as ChapaWebhookPayload;
        const reference = resolveReference(payload);
        if (!reference)
            return NextResponse.json({ error: 'Missing reference/tx_ref in webhook payload' }, { status: 400 });

        const transferStatus = resolveTransferStatus(payload);
        const nextStatus = mapWithdrawalStatus(transferStatus);

        const { data: withdrawalData, error: lookupError } = await supabaseAdmin
            .from('withdrawal_history')
            .select('id, adminNote')
            .ilike('adminNote', `%reference=${reference}%`)
            .order('createdDate', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (lookupError)
            return NextResponse.json({ error: lookupError.message || 'Failed to match withdrawal by reference' }, { status: 500 });
        if (!withdrawalData)
            return NextResponse.json({ error: `No withdrawal found for reference "${reference}"` }, { status: 404 });

        const existingNote = normalizeText((withdrawalData as { adminNote?: string | null }).adminNote || '');
        const webhookNote = `Chapa webhook update. reference=${reference} status=${transferStatus || 'unknown'}${payload.transfer_id || payload.data?.transfer_id ? ` transfer_id=${payload.transfer_id || payload.data?.transfer_id}` : ''}`;
        const updatedAdminNote = [existingNote, webhookNote].filter(Boolean).join('\n');

        const { error: updateError } = await supabaseAdmin
            .from('withdrawal_history')
            .update({
                paymentStatus: nextStatus,
                paymentDate: nextStatus === 'completed' ? new Date().toISOString() : null,
                adminNote: updatedAdminNote,
            })
            .eq('id', (withdrawalData as { id: string }).id);
        if (updateError)
            return NextResponse.json({ error: updateError.message || 'Failed to update withdrawal status from webhook' }, { status: 500 });

        if (nextStatus === 'completed') {
            const walletResult = await deductProviderWalletForWithdrawal(
                supabaseAdmin,
                (withdrawalData as { id: string }).id
            );
            if (!walletResult.ok) {
                return NextResponse.json(
                    { error: `Withdrawal completed but wallet deduction failed: ${walletResult.error}` },
                    { status: 500 }
                );
            }
        }

        await insertNotificationIfMissing(supabaseAdmin, {
            title: `Payout ${nextStatus}`,
            description: `Chapa transfer ${nextStatus}. reference=${reference}`,
            type: `payout_${nextStatus}`,
            action_url: '/admin/finance/payout-request',
        });

        return NextResponse.json({
            status: 'ok',
            withdrawalId: (withdrawalData as { id: string }).id,
            paymentStatus: nextStatus,
            reference,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected webhook error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
