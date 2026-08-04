import { NextResponse } from 'next/server';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { logAdminActivity } from '@/lib/admin-activity-log';
import {
    parseServicePostingTiers,
    resolveServicePostingTierByPrice,
} from '@/lib/service-posting-tiers';
import { verifyChapaWebhookSignature } from '@/lib/chapa-config';

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

function parseObjectValue(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'string') {
        try {
            return (JSON.parse(value) as Record<string, unknown>) ?? {};
        } catch {
            return {};
        }
    }
    if (typeof value === 'object') return value as Record<string, unknown>;
    return {};
}

export async function POST(request: Request) {
        const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const rawBody = await request.text();
        if (!verifyChapaWebhookSignature(rawBody, request.headers)) {
            return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
        }
        const body = (rawBody ? JSON.parse(rawBody) : {}) as ChapaWebhookPayload;
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

        const provider = providerRaw as {
            id: string;
            user_id?: string;
            activation_paid?: boolean;
            activation_tx_ref?: string;
        } | null;

        if (!provider) {
            return NextResponse.json({ status: 'error', reason: 'Provider not found for tx_ref' }, { status: 404 });
        }

        if (provider.activation_paid) {
            if ((provider as { active?: boolean }).active !== true) {
                await supabaseAdmin.from('provider').update({ active: true }).eq('id', provider.id);
            }
            return NextResponse.json({ status: 'already_processed' });
        }

        const { data: constantRow } = await supabaseAdmin
            .from('app_settings')
            .select('id, data')
            .eq('id', 'constant')
            .maybeSingle();

        const constants = parseObjectValue((constantRow as { data: unknown } | null)?.data);
        const tiers = parseServicePostingTiers(constants.service_posting_tiers);
        const paidRaw = body.amount;
        const paidAmount =
            typeof paidRaw === 'number'
                ? paidRaw
                : typeof paidRaw === 'string'
                    ? Number.parseFloat(paidRaw)
                    : NaN;
        const tier = Number.isFinite(paidAmount)
            ? resolveServicePostingTierByPrice(tiers, paidAmount)
            : null;

        const feeAmount = tier
            ? tier.total_price.toFixed(2)
            : typeof constants.provider_activation_account_activation_fee_amount === 'string'
                ? constants.provider_activation_account_activation_fee_amount
                : '0';

        const now = new Date().toISOString();

        const { error: updateError } = await supabaseAdmin
            .from('provider')
            .update({
                activation_paid: true,
                activation_paid_at: now,
                active: true,
                ...(tier ? { service_tier_max: tier.max_services } : {}),
            })
            .eq('id', provider.id);

        if (updateError) {
            return NextResponse.json({ status: 'error', reason: 'Failed to update provider' }, { status: 500 });
        }

        if (tier && provider.user_id) {
            const { error: tierPaymentError } = await supabaseAdmin.from('service_tier_payment').insert({
                provider_id: provider.id,
                user_id: provider.user_id,
                from_tier_max: 0,
                to_tier_max: tier.max_services,
                amount: tier.total_price,
                tx_ref: txRef,
                chapa_status: 'success',
            });
            if (
                tierPaymentError &&
                !tierPaymentError.message.toLowerCase().includes('duplicate') &&
                tierPaymentError.code !== '23505'
            ) {
                console.error('service_tier_payment insert failed:', tierPaymentError.message);
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
            try {
                const { sendProviderPush } = await import('@/lib/push/sendProviderPush');
                await sendProviderPush({
                    serviceClient: supabaseAdmin,
                    providerId: provider.id,
                    input: {
                        title: 'Account Activated',
                        body: `Your activation fee of ETB ${feeAmount} has been confirmed. Your account is now active.`,
                        route: '/profile',
                        type: 'account',
                    },
                });
            } catch (pushError) {
                console.error('Activation webhook push failed:', pushError);
            }
        }

        await logAdminActivity({
            request,
            action: 'activate',
            resource_type: 'provider_activation',
            resource_id: provider.id,
            summary: `Chapa webhook activated provider ${provider.id}`,
            metadata: {
                tx_ref: txRef,
                fee_amount: feeAmount,
                service_tier_max: tier?.max_services ?? null,
                source: 'chapa_webhook',
            },
        });

        return NextResponse.json({ status: 'success', provider_id: provider.id });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Webhook processing error';
        return NextResponse.json({ status: 'error', reason: message }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ status: 'ok', message: 'Activation webhook endpoint' });
}
