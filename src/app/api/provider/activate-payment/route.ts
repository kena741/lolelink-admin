import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { logAdminActivity } from '@/lib/admin-activity-log';
import {
    loadChapaSecretKey,
    resolveChapaSettlementAmount,
    resolveChapaWalletCreditAmount,
    verifyChapaTransaction,
} from '@/lib/chapa-config';
import { findPriorCustomerWalletTopUp } from '@/lib/wallet-transaction-activation';
import { hasCustomerWalletTopUpTransactionId } from '@/lib/wallet-transaction-metrics';

export const runtime = 'nodejs';

interface ActivatePaymentBody {
    providerId: string;
    mode: 'chapa' | 'manual';
    txRef?: string;
    note?: string;
}

interface ProviderRow {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    activation_paid?: boolean;
    activation_paid_at?: string;
    activation_tx_ref?: string;
}

interface AppSettingsRow {
    id: string;
    data: unknown;
}

interface ChapaConfig {
    enable?: boolean;
    isActive?: boolean | number;
    isSandbox?: boolean;
    publicKey?: string;
    secretKey?: string;
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

function resolveChapaConfig(settingsData: unknown): ChapaConfig {
    const root = parseObjectValue(settingsData);
    const maybeChapa = root.chapa;
    if (!maybeChapa || typeof maybeChapa !== 'object') return {};
    return maybeChapa as ChapaConfig;
}

function normalizeBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    return false;
}

async function insertNotification(
    admin: SupabaseClient,
    params: {
    title: string;
    description: string;
    type: string;
    provider_id: string;
}
): Promise<void> {
    const { title, description, type, provider_id } = params;
    const { data: existing } = await admin
        .from('notification')
        .select('id')
        .eq('type', type)
        .eq('provider_id', provider_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (existing) return;
    await admin.from('notification').insert({
        title,
        description,
        type,
        provider_id,
        is_read: false,
    });
}

async function loadProviderAndFee(admin: SupabaseClient, providerId: string) {
    const { data: providerData, error: providerError } = await admin
        .from('provider')
        .select('*')
        .eq('id', providerId)
        .single();

    if (providerError || !providerData) {
        return {
            error: providerError?.message || 'Provider not found',
            status: 404,
        } as const;
    }

    const raw = providerData as Record<string, unknown>;
    const provider: ProviderRow = {
        id: raw.id as string,
        email: (raw.email as string) || undefined,
        firstName: (raw.firstName as string) || (raw.first_name as string) || undefined,
        lastName: (raw.lastName as string) || (raw.last_name as string) || undefined,
        name: (raw.name as string) || undefined,
        activation_paid: (raw.activation_paid as boolean) || false,
        activation_paid_at: (raw.activation_paid_at as string) || undefined,
        activation_tx_ref: (raw.activation_tx_ref as string) || undefined,
    };

    if (provider.activation_paid) {
        return { error: 'Activation fee already paid', status: 409, activation_paid_at: provider.activation_paid_at } as const;
    }

    const { data: constantRow } = await admin
        .from('app_settings')
        .select('id, data')
        .eq('id', 'constant')
        .maybeSingle();

    const constants = parseObjectValue((constantRow as AppSettingsRow | null)?.data);
    const feeAmount = typeof constants.provider_activation_account_activation_fee_amount === 'string'
        ? constants.provider_activation_account_activation_fee_amount
        : '0';

    const providerName = [provider.firstName, provider.lastName].filter(Boolean).join(' ') || provider.name || 'Provider';

    return { provider, feeAmount, providerName } as const;
}

async function handleChapaCheckout(
    admin: SupabaseClient,
    provider: ProviderRow,
    feeAmount: string,
    providerName: string,
    request: Request
) {
    const { data: paymentRow } = await admin
        .from('app_settings')
        .select('id, data')
        .eq('id', 'payment')
        .maybeSingle();

    const chapaConfig = resolveChapaConfig((paymentRow as AppSettingsRow | null)?.data);
    const isChapaEnabled = normalizeBoolean(chapaConfig.enable) && normalizeBoolean(chapaConfig.isActive ?? true);

    if (!isChapaEnabled) {
        return NextResponse.json({ error: 'Chapa is disabled in app settings' }, { status: 400 });
    }

    const chapaSecretKey = (chapaConfig.secretKey || process.env.CHAPA_SECRET_KEY || '').trim();
    if (!chapaSecretKey) {
        return NextResponse.json({ error: 'Missing Chapa secret key' }, { status: 500 });
    }

    const origin = new URL(request.url).origin;
    const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || origin).trim();
    const txRef = `act-${provider.id.replace(/-/g, '').slice(0, 12)}-${Date.now()}`.slice(0, 50);

    const numericAmount = parseFloat(feeAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
        return NextResponse.json({ error: 'Invalid activation fee amount configured' }, { status: 400 });
    }

    const chapaPayload = {
        amount: numericAmount.toString(),
        currency: 'ETB',
        email: provider.email || 'admin@platform.com',
        first_name: provider.firstName || providerName,
        last_name: provider.lastName || '',
        tx_ref: txRef,
        callback_url: `${appBaseUrl}/api/provider/activate-payment/webhook`,
        return_url: `${appBaseUrl}/admin/providers/${provider.id}`,
        'customization[title]': 'Provider Activation Fee',
        'customization[description]': `Activation fee for ${providerName}`,
    };

    const chapaResponse = await fetch('https://api.chapa.co/v1/transaction/initialize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${chapaSecretKey}`,
        },
        body: JSON.stringify(chapaPayload),
    });

    const chapaData = (await chapaResponse.json()) as {
        status?: string;
        message?: string;
        data?: { checkout_url?: string };
    };

    if (!chapaResponse.ok || chapaData.status !== 'success') {
        return NextResponse.json(
            { error: chapaData.message || 'Failed to initialize Chapa checkout', details: chapaData },
            { status: 400 }
        );
    }

    await admin
        .from('provider')
        .update({ activation_tx_ref: txRef })
        .eq('id', provider.id);

    await logAdminActivity({
        request,
        action: 'initiate',
        resource_type: 'provider_activation',
        resource_id: provider.id,
        summary: `Initiated Chapa activation payment for ${providerName}`,
        metadata: {
            tx_ref: txRef,
            fee_amount: feeAmount,
            mode: 'chapa',
            source: 'admin',
        },
    });

    return NextResponse.json({
        status: 'success',
        mode: 'chapa',
        checkout_url: chapaData.data?.checkout_url,
        tx_ref: txRef,
        provider_id: provider.id,
        provider_name: providerName,
        fee_amount: feeAmount,
    });
}

async function handleManualMark(
    admin: SupabaseClient,
    provider: ProviderRow,
    feeAmount: string,
    providerName: string,
    txRef: string | undefined,
    note: string | undefined,
    request: Request
) {
    const now = new Date().toISOString();
    const priorTopUp = await findPriorCustomerWalletTopUp(admin, provider.id);
    const ref = priorTopUp?.transactionId
        ?? ((txRef || '').trim() || `manual-${provider.id.slice(0, 8)}-${Date.now()}`);

    const { error: updateError } = await admin
        .from('provider')
        .update({
            activation_paid: true,
            activation_paid_at: now,
            activation_tx_ref: ref,
        })
        .eq('id', provider.id);

    if (updateError) {
        return NextResponse.json({ error: 'Failed to update provider activation status' }, { status: 500 });
    }

    const walletSkipped = Boolean(priorTopUp);

    if (!walletSkipped) {
        let walletAmount = feeAmount;
        let paymentType = 'manual';
        let walletNote = `Activation payment top up (manual)${note ? ` - ${note}` : ''}`;

        if (hasCustomerWalletTopUpTransactionId(ref)) {
            const chapaSecretKey = await loadChapaSecretKey(admin);
            if (chapaSecretKey) {
                const verified = await verifyChapaTransaction(chapaSecretKey, ref);
                if (verified.ok) {
                    const settlement = resolveChapaSettlementAmount(verified.data);
                    walletAmount = settlement != null
                        ? settlement.toFixed(2)
                        : resolveChapaWalletCreditAmount(verified.data, feeAmount);
                    paymentType = 'chapa';
                    walletNote = `Activation payment top up (Chapa, net after fee)${note ? ` - ${note}` : ''}`;
                }
            }
        }

        const { error: walletError } = await admin.from('wallet_transaction').insert({
            amount: walletAmount,
            createdDate: now,
            isCredit: true,
            note: walletNote,
            paymentType,
            transactionId: ref,
            type: 'provider',
            userId: provider.id,
        });

        if (walletError) {
            return NextResponse.json({
                status: 'partial',
                message: `Provider activated but wallet transaction failed: ${walletError.message}`,
                provider_id: provider.id,
                wallet_error: walletError.message,
            });
        }
    }

    await insertNotification(admin, {
        title: 'Account Activated',
        description: `Your activation fee of ETB ${feeAmount} has been confirmed. Your account is now active.`,
        type: 'activation_payment_confirmed',
        provider_id: provider.id,
    });

    await logAdminActivity({
        request,
        action: 'activate',
        resource_type: 'provider_activation',
        resource_id: provider.id,
        summary: `Manually activated provider ${providerName}`,
        metadata: {
            tx_ref: ref,
            fee_amount: feeAmount,
            mode: 'manual',
            note: note || null,
            wallet_skipped: walletSkipped,
            source: 'admin',
        },
    });

    return NextResponse.json({
        status: 'success',
        mode: 'manual',
        provider_id: provider.id,
        provider_name: providerName,
        activation_paid_at: now,
        tx_ref: ref,
        fee_amount: feeAmount,
        note: note || null,
        wallet_skipped: walletSkipped,
        wallet_skipped_reason: walletSkipped ? 'prior_customer_top_up' : null,
    });
}

export async function POST(request: Request) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as ActivatePaymentBody;

        if (!body.providerId) {
            return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
        }

        const result = await loadProviderAndFee(supabaseAdmin, body.providerId);
        if ('error' in result) {
            return NextResponse.json(
                { error: result.error, ...(result.activation_paid_at ? { activation_paid_at: result.activation_paid_at } : {}) },
                { status: result.status }
            );
        }

        const { provider, feeAmount, providerName } = result;

        if (body.mode === 'chapa') {
            return handleChapaCheckout(supabaseAdmin, provider, feeAmount, providerName, request);
        }

        return handleManualMark(supabaseAdmin, provider, feeAmount, providerName, body.txRef, body.note, request);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
