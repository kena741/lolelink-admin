import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminActivity } from '@/lib/admin-activity-log';
import {
    resolveChapaBankForPayoutFromApi,
    validateResolvedBankAccountLength,
} from '@/lib/chapa-bank-resolution';
import {
    buildPayoutActivityMetadata,
    buildPayoutActivitySummary,
    loadWithdrawalActivityContext,
} from '@/lib/payout-activity-log';
import {
    calculateWithdrawalPayoutBreakdown,
    formatWithdrawalPayoutBreakdownNote,
} from '@/lib/withdrawal-payout';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface TransferRequestBody {
    withdrawalId: string;
}

interface WithdrawalRow {
    id: string;
    providerId: string;
    amount: string;
    paymentStatus?: string;
    adminNote?: string | null;
}

interface ProviderPaymentMethodRow {
    id: string;
    providerID: string;
    method_type?: string | null;
    method_code?: string | null;
    method_name?: string | null;
    holderName?: string | null;
    accountNumber?: string | null;
    swiftCode?: string | null;
    bankName?: string | null;
    branchCity?: string | null;
    branchCountry?: string | null;
    is_active?: boolean | null;
    is_default?: boolean | null;
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

function buildTxRef(withdrawalId: string): string {
    const shortId = withdrawalId.replace(/-/g, '').slice(0, 12);
    return `wd-${shortId}-${Date.now()}`.slice(0, 50);
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

function normalizeAccountNumber(value: string): string {
    return value.replace(/\s+/g, '');
}

async function insertNotificationIfMissing(
    admin: SupabaseClient,
    params: {
    title: string;
    description: string;
    type: string;
    provider_id?: string;
    action_url?: string;
}
): Promise<void> {
    const { title, description, type, provider_id, action_url } = params;
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
        provider_id: provider_id || null,
        action_url: action_url || null,
        is_read: false,
    });
}

async function getProviderDefaultPaymentMethod(
    admin: SupabaseClient,
    providerId: string
): Promise<ProviderPaymentMethodRow | null> {
    const normalizedProviderId = normalizeText(providerId);
    if (!normalizedProviderId) return null;

    const { data: defaultActive, error: defaultActiveError } = await admin
        .from('provider_payment_methods')
        .select('*')
        .eq('providerID', normalizedProviderId)
        .eq('is_active', true)
        .eq('is_default', true)
        .order('updated_at', { ascending: false })
        .maybeSingle();
    if (!defaultActiveError && defaultActive)
        return defaultActive as ProviderPaymentMethodRow;

    const { data: anyActive, error: anyActiveError } = await admin
        .from('provider_payment_methods')
        .select('*')
        .eq('providerID', normalizedProviderId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('updated_at', { ascending: false })
        .maybeSingle();
    if (!anyActiveError && anyActive)
        return anyActive as ProviderPaymentMethodRow;

    return null;
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
        const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim();
        const webhookUrl = (process.env.CHAPA_TRANSFER_WEBHOOK_URL || `${appBaseUrl}/api/payout/chapa-webhook`).trim();
        if (!isChapaEnabled)
            return NextResponse.json({ error: 'Chapa is disabled in app settings' }, { status: 400 });

        if (!chapaSecretKey)
            return NextResponse.json({ error: 'Missing CHAPA_SECRET_KEY' }, { status: 500 });

        const body = (await request.json()) as TransferRequestBody;
        if (!body.withdrawalId)
            return NextResponse.json({ error: 'withdrawalId is required' }, { status: 400 });

        const { data: withdrawalData, error: withdrawalError } = await supabaseAdmin
            .from('withdrawal_history')
            .select('id, providerId, amount, paymentStatus, adminNote')
            .eq('id', body.withdrawalId)
            .single();

        if (withdrawalError || !withdrawalData)
            return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 });

        const withdrawal = withdrawalData as WithdrawalRow;
        const normalizedStatus = (withdrawal.paymentStatus ?? '').toLowerCase();
        if (!['approved', 'pending'].includes(normalizedStatus))
            return NextResponse.json(
                { error: `Withdrawal status "${withdrawal.paymentStatus}" cannot be sent` },
                { status: 400 }
            );

        const paymentMethod = await getProviderDefaultPaymentMethod(supabaseAdmin, withdrawal.providerId);
        if (!paymentMethod)
            return NextResponse.json(
                {
                    error: `Provider payment method not found for providerId "${normalizeText(withdrawal.providerId)}". Please add a default active payment method first.`,
                },
                { status: 400 }
            );

        const normalizedBankName = normalizeText(paymentMethod.bankName || paymentMethod.method_name);
        const normalizedAccountNumber = normalizeAccountNumber(normalizeText(paymentMethod.accountNumber));
        const normalizedHolderName = normalizeText(paymentMethod.holderName);
        const missingFields = [
            !normalizedBankName ? 'bankName/method_name' : '',
            !normalizedAccountNumber ? 'accountNumber' : '',
            !normalizedHolderName ? 'holderName' : '',
        ].filter(Boolean);
        if (missingFields.length > 0)
            return NextResponse.json(
                { error: `Provider payment method details are incomplete: missing ${missingFields.join(', ')}` },
                { status: 400 }
            );

        const txRef = buildTxRef(withdrawal.id);
        const storedBankCode = normalizeText(paymentMethod.method_code);
        const swiftCode = normalizeText(paymentMethod.swiftCode);
        if (!storedBankCode && !swiftCode)
            return NextResponse.json(
                { error: 'Provider method_code is missing. Store numeric Chapa bank id in method_code (or swiftCode as fallback).' },
                { status: 400 }
            );
        let resolvedBank;
        try {
            resolvedBank = await resolveChapaBankForPayoutFromApi(chapaSecretKey, {
                storedBankCode,
                swiftCode,
                bankName: normalizedBankName,
                accountNumber: normalizedAccountNumber,
            });
            validateResolvedBankAccountLength(
                resolvedBank.bank,
                normalizedAccountNumber,
                resolvedBank.bankName
            );
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Invalid payout bank details';
            return NextResponse.json({ error: message }, { status: 400 });
        }
        const bankCode = resolvedBank.bankCode;
        const payoutBankName = resolvedBank.bankName;

        const payoutBreakdown = calculateWithdrawalPayoutBreakdown(withdrawal.amount);
        if (payoutBreakdown.netTransferAmount <= 0) {
            return NextResponse.json(
                { error: 'Withdrawal amount is too small after the 2.5% Chapa fee' },
                { status: 400 }
            );
        }

        const payload = {
            account_name: normalizedHolderName,
            account_number: normalizedAccountNumber,
            bank_code: bankCode,
            amount: payoutBreakdown.netTransferAmount.toFixed(2),
            currency: 'ETB',
            reference: txRef,
            webhook_url: webhookUrl,
        };

        const chapaResponse = await fetch('https://api.chapa.co/v1/transfers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${chapaSecretKey}`,
            },
            body: JSON.stringify(payload),
        });

        const chapaData = (await chapaResponse.json()) as {
            status?: string;
            message?: string;
            data?: {
                transfer_id?: string;
                reference?: string;
                status?: string;
            };
        };

        if (!chapaResponse.ok || chapaData.status !== 'success') {
            const message = toErrorMessage(chapaData.message, 'Failed to create Chapa transfer');
            return NextResponse.json(
                { error: message, details: chapaData },
                { status: 400 }
            );
        }

        const transferReference = chapaData.data?.reference || txRef;
        const transferId = chapaData.data?.transfer_id || '';
        const correctionPart = resolvedBank.correctedFrom
            ? ` Bank auto-corrected from "${resolvedBank.correctedFrom}" to "${payoutBankName}" based on account number length.`
            : '';
        const notePart = `Chapa transfer sent. ${formatWithdrawalPayoutBreakdownNote(payoutBreakdown)} reference=${transferReference}${transferId ? ` transfer_id=${transferId}` : ''}.${correctionPart}`;
        const updatedAdminNote = withdrawal.adminNote
            ? `${withdrawal.adminNote}\n${notePart}`
            : notePart;

        const { error: updateError } = await supabaseAdmin
            .from('withdrawal_history')
            .update({
                paymentStatus: 'approved',
                adminNote: updatedAdminNote,
            })
            .eq('id', withdrawal.id);

        if (updateError)
            return NextResponse.json({ error: 'Failed to update withdrawal record' }, { status: 500 });

        await insertNotificationIfMissing(supabaseAdmin, {
            title: 'Payout transfer initiated',
            description: `Transfer initiated for withdrawal ${withdrawal.id}. reference=${transferReference}`,
            type: 'payout_transfer_initiated',
            provider_id: withdrawal.providerId,
            action_url: '/admin/finance/payout-request',
        });

        const payoutContext = await loadWithdrawalActivityContext(supabaseAdmin, withdrawal.id);

        await logAdminActivity({
            request,
            action: 'transfer',
            resource_type: 'withdrawal',
            resource_id: withdrawal.id,
            summary: payoutContext
                ? buildPayoutActivitySummary('Initiated Chapa transfer', payoutContext, `ref ${transferReference}`)
                : `Initiated Chapa transfer for withdrawal ${withdrawal.id}`,
            metadata: payoutContext
                ? buildPayoutActivityMetadata(payoutContext, {
                      tx_ref: transferReference,
                      gross_amount: payoutBreakdown.grossAmount,
                      chapa_fee: payoutBreakdown.chapaFee,
                      net_transfer_amount: payoutBreakdown.netTransferAmount,
                  })
                : {
                      tx_ref: transferReference,
                      gross_amount: payoutBreakdown.grossAmount,
                      chapa_fee: payoutBreakdown.chapaFee,
                      net_transfer_amount: payoutBreakdown.netTransferAmount,
                      provider_id: withdrawal.providerId,
                  },
        });

        return NextResponse.json({
            status: 'success',
            tx_ref: transferReference,
            transfer_id: transferId,
            message: 'Chapa payout transfer initiated. Waiting webhook confirmation.',
            source: {
                account: 'Platform Chapa Account',
            },
            destination: {
                provider_name: normalizedHolderName,
                bank_name: payoutBankName,
                account_number: normalizedAccountNumber,
                bank_corrected_from: resolvedBank.correctedFrom,
            },
            amount: payoutBreakdown.grossAmount.toFixed(2),
            chapa_fee: payoutBreakdown.chapaFee.toFixed(2),
            net_transfer_amount: payoutBreakdown.netTransferAmount.toFixed(2),
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected payout error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

