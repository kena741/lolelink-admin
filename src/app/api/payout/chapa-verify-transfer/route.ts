import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdminPermission } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { deductProviderWalletForWithdrawal } from '@/lib/withdrawal-wallet-side-effects';
import { logAdminActivity } from '@/lib/admin-activity-log';
import {
    buildPayoutActivityMetadata,
    buildPayoutActivitySummary,
    loadWithdrawalActivityContext,
} from '@/lib/payout-activity-log';

export const runtime = 'nodejs';

interface RequestBody {
    withdrawalId: string;
}

interface AppSettingsRow {
    id: string;
    data: unknown;
}

interface ChapaConfig {
    enable?: boolean;
    isActive?: boolean | number;
    secretKey?: string;
}

function normalizeBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    return false;
}

function parseSettingsData(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value) as Record<string, unknown>;
            return parsed ?? {};
        } catch {
            return {};
        }
    }
    if (typeof value === 'object') return value as Record<string, unknown>;
    return {};
}

function resolveChapaConfig(settingsData: unknown): ChapaConfig {
    const root = parseSettingsData(settingsData);
    const maybeChapa = root.chapa;
    if (!maybeChapa || typeof maybeChapa !== 'object') return {};
    return maybeChapa as ChapaConfig;
}

function normalizeText(value: string | null | undefined): string {
    return (value || '').trim();
}

function toErrorMessage(value: unknown, fallback: string): string {
    if (typeof value === 'string' && value.trim())
        return value;
    if (value && typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return fallback;
        }
    }
    return fallback;
}

function extractReference(adminNote: string): string {
    const text = adminNote || '';
    const match = text.match(/reference=([A-Za-z0-9\-_]+)/);
    return match?.[1] || '';
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
    const auth = await requireAdminPermission(request, 'finance:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const { data: paymentSettingsData } = await supabaseAdmin
            .from('app_settings')
            .select('id, data')
            .eq('id', 'payment')
            .maybeSingle();

        const paymentSettings = paymentSettingsData as AppSettingsRow | null;
        const chapaConfig = resolveChapaConfig(paymentSettings?.data);
        const isChapaEnabled =
            normalizeBoolean(chapaConfig.enable) && normalizeBoolean(chapaConfig.isActive ?? true);

        const chapaSecretKey = (chapaConfig.secretKey || process.env.CHAPA_SECRET_KEY || '').trim();
        if (!isChapaEnabled)
            return NextResponse.json({ error: 'Chapa is disabled in app settings' }, { status: 400 });
        if (!chapaSecretKey)
            return NextResponse.json({ error: 'Missing CHAPA_SECRET_KEY' }, { status: 500 });

        const body = (await request.json()) as RequestBody;
        const withdrawalId = normalizeText(body.withdrawalId);
        if (!withdrawalId)
            return NextResponse.json({ error: 'withdrawalId is required' }, { status: 400 });

        const { data: withdrawal, error: withdrawalError } = await supabaseAdmin
            .from('withdrawal_history')
            .select('id, providerId, amount, adminNote, paymentStatus')
            .eq('id', withdrawalId)
            .maybeSingle();
        if (withdrawalError || !withdrawal)
            return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 });

        const adminNote = normalizeText((withdrawal as { adminNote?: string | null }).adminNote || '');
        const reference = extractReference(adminNote);
        if (!reference)
            return NextResponse.json({ error: 'Transfer reference not found on this withdrawal' }, { status: 400 });

        const verifyResponse = await fetch(`https://api.chapa.co/v1/transfers/verify/${reference}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${chapaSecretKey}`,
            },
        });

        const verifyPayload = (await verifyResponse.json()) as {
            status?: string;
            message?: unknown;
            data?: unknown;
        };

        if (!verifyResponse.ok)
            return NextResponse.json(
                { error: toErrorMessage(verifyPayload.message, 'Failed to verify Chapa transfer'), details: verifyPayload },
                { status: 400 }
            );

        const verifyStatus = normalizeText(verifyPayload.status).toLowerCase();
        const isSuccess = verifyStatus === 'success';

        const noteLine = `Chapa verify checked. reference=${reference} status=${verifyStatus || 'unknown'}`;
        const updatedAdminNote = [adminNote, noteLine].filter(Boolean).join('\n');

        if (isSuccess) {
            const { error: updateError } = await supabaseAdmin
                .from('withdrawal_history')
                .update({
                    paymentStatus: 'completed',
                    paymentDate: new Date().toISOString(),
                    adminNote: updatedAdminNote,
                })
                .eq('id', withdrawalId);
            if (updateError)
                return NextResponse.json({ error: 'Failed to update withdrawal status' }, { status: 500 });

            const walletResult = await deductProviderWalletForWithdrawal(supabaseAdmin, withdrawalId);
            if (!walletResult.ok) {
                return NextResponse.json(
                    { error: `Withdrawal completed but wallet deduction failed: ${walletResult.error}` },
                    { status: 500 }
                );
            }

            await insertNotificationIfMissing(supabaseAdmin, {
                title: 'Payout completed',
                description: `Transfer verified as completed. reference=${reference}`,
                type: 'payout_completed',
                action_url: '/admin/finance/payout-request',
            });

            try {
                const { notifyProviderPayoutStatus } = await import('@/lib/push/payoutNotify');
                const providerId = (withdrawal as { providerId?: string }).providerId;
                const amountRaw = (withdrawal as { amount?: string | number }).amount;
                if (providerId) {
                    await notifyProviderPayoutStatus(supabaseAdmin, {
                        providerId,
                        event: 'completed',
                        amount: typeof amountRaw === 'number' ? amountRaw : Number(amountRaw) || 0,
                    });
                }
            } catch (pushError) {
                console.error('Payout verify push failed:', pushError);
            }
        } else {
            const { error: updateError } = await supabaseAdmin
                .from('withdrawal_history')
                .update({
                    adminNote: updatedAdminNote,
                })
                .eq('id', withdrawalId);
            if (updateError)
                return NextResponse.json({ error: 'Failed to update withdrawal note' }, { status: 500 });
        }

        const payoutContext = await loadWithdrawalActivityContext(supabaseAdmin, withdrawalId);

        await logAdminActivity({
            request,
            action: isSuccess ? 'complete' : 'verify',
            resource_type: 'payout',
            resource_id: withdrawalId,
            summary: payoutContext
                ? buildPayoutActivitySummary(
                      isSuccess ? 'Verified Chapa transfer' : 'Checked Chapa transfer',
                      payoutContext,
                      isSuccess ? `ref ${reference}` : `ref ${reference}, status ${verifyStatus || 'unknown'}`
                  )
                : isSuccess
                  ? `Verified Chapa transfer ${reference} as completed`
                  : `Checked Chapa transfer ${reference} (status: ${verifyStatus || 'unknown'})`,
            metadata: payoutContext
                ? buildPayoutActivityMetadata(payoutContext, {
                      reference,
                      verify_status: verifyStatus,
                      source: isSuccess ? 'admin_verify' : 'admin_verify_pending',
                  })
                : {
                      reference,
                      verify_status: verifyStatus,
                      source: isSuccess ? 'admin_verify' : 'admin_verify_pending',
                  },
        });

        return NextResponse.json({
            status: 'ok',
            reference,
            verify: verifyPayload,
            updatedPaymentStatus: isSuccess ? 'completed' : (withdrawal as { paymentStatus?: string }).paymentStatus || 'approved',
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected verify error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

