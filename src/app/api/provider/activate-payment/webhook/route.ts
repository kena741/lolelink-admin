import { NextResponse } from 'next/server';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface ChapaWebhookPayload {
    event?: string;
    tx_ref?: string;
    status?: string;
    amount?: number | string;
    currency?: string;
    reference?: string;
    first_name?: string;
    last_name?: string;
}

function isSuccessStatus(status: string | undefined): boolean {
    const normalized = (status || '').toLowerCase().trim();
    return ['success', 'successful', 'completed', 'paid'].includes(normalized);
}

export async function POST(request: Request) {
        const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as ChapaWebhookPayload;
        const txRef = body.tx_ref || '';

        if (!txRef.startsWith('act-')) {
            return NextResponse.json({ status: 'ignored', reason: 'Not an activation transaction' });
        }

        if (!isSuccessStatus(body.status)) {
            return NextResponse.json({ status: 'ignored', reason: `Non-success status: ${body.status}` });
        }

        const { data: providerRaw } = await supabaseAdmin
            .from('provider')
            .select('*')
            .eq('activation_tx_ref', txRef)
            .maybeSingle();

        const provider = providerRaw as { id: string; activation_paid?: boolean; activation_tx_ref?: string } | null;

        if (!provider) {
            return NextResponse.json({ status: 'error', reason: 'Provider not found for tx_ref' }, { status: 404 });
        }

        if (provider.activation_paid) {
            return NextResponse.json({ status: 'already_processed' });
        }

        const now = new Date().toISOString();

        const { error: updateError } = await supabaseAdmin
            .from('provider')
            .update({
                activation_paid: true,
                activation_paid_at: now,
            })
            .eq('id', provider.id);

        if (updateError) {
            return NextResponse.json({ status: 'error', reason: 'Failed to update provider' }, { status: 500 });
        }

        const { data: constantRow } = await supabaseAdmin
            .from('app_settings')
            .select('id, data')
            .eq('id', 'constant')
            .maybeSingle();

        let feeAmount = '0';
        if (constantRow && typeof constantRow === 'object' && 'data' in constantRow) {
            const data = constantRow.data as Record<string, unknown> | null;
            if (data && typeof data.provider_activation_account_activation_fee_amount === 'string') {
                feeAmount = data.provider_activation_account_activation_fee_amount;
            }
        }

        const { data: existing } = await supabaseAdmin
            .from('notification')
            .select('id')
            .eq('type', 'activation_payment_confirmed')
            .eq('provider_id', provider.id)
            .limit(1)
            .maybeSingle();

        if (!existing) {
            await supabaseAdmin.from('notification').insert({
                title: 'Account Activated',
                description: `Your activation fee of ETB ${feeAmount} has been confirmed. Your account is now active.`,
                type: 'activation_payment_confirmed',
                provider_id: provider.id,
                is_read: false,
            });
        }

        return NextResponse.json({ status: 'success', provider_id: provider.id });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Webhook processing error';
        return NextResponse.json({ status: 'error', reason: message }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ status: 'ok', message: 'Activation webhook endpoint' });
}
