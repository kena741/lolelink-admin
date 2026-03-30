import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

interface ChapaBank {
    id: number;
    slug?: string;
    swift?: string;
    name?: string;
    acct_length?: number;
    currency?: string;
    active?: number;
    is_active?: number;
    is_mobilemoney?: number | null;
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

function normalizeBankLabel(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isNumericText(value: string): boolean {
    return /^\d+$/.test(value.trim());
}

function pickPreferredBank(candidates: ChapaBank[]): ChapaBank | null {
    if (candidates.length === 0) return null;
    const sorted = [...candidates].sort((a, b) => {
        const aMobile = (a.is_mobilemoney ?? 0) ? 1 : 0;
        const bMobile = (b.is_mobilemoney ?? 0) ? 1 : 0;
        return aMobile - bMobile;
    });
    return sorted[0];
}

async function fetchChapaBanks(chapaSecretKey: string): Promise<ChapaBank[]> {
    const response = await fetch('https://api.chapa.co/v1/banks', {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${chapaSecretKey}`,
        },
    });
    const payload = (await response.json()) as {
        data?: ChapaBank[];
        message?: unknown;
    };
    if (!response.ok)
        throw new Error(toErrorMessage(payload.message, 'Failed to fetch Chapa banks'));
    return payload.data || [];
}

async function resolveNumericBankCode(params: {
    chapaSecretKey: string;
    storedBankCode: string;
    swiftCode: string;
    bankName: string;
}): Promise<{ bankCode: string; bank: ChapaBank | null }> {
    const { chapaSecretKey, storedBankCode, swiftCode, bankName } = params;
    if (storedBankCode && isNumericText(storedBankCode))
        return { bankCode: storedBankCode, bank: null };

    const banks = await fetchChapaBanks(chapaSecretKey);
    const etbBanks = banks.filter((bank) => {
        const isActive = bank.active === 1 || bank.is_active === 1;
        return (bank.currency || '').toUpperCase() === 'ETB' && isActive;
    });

    const normalizedStoredCode = normalizeBankLabel(storedBankCode);
    const normalizedSwift = normalizeBankLabel(swiftCode);
    const normalizedBankName = normalizeBankLabel(bankName);

    const bySlug = normalizedStoredCode
        ? etbBanks.filter((bank) => normalizeBankLabel(bank.slug || '') === normalizedStoredCode)
        : [];
    const preferredBySlug = pickPreferredBank(bySlug);
    if (preferredBySlug)
        return { bankCode: String(preferredBySlug.id), bank: preferredBySlug };

    const bySwift = normalizedSwift
        ? etbBanks.filter((bank) => normalizeBankLabel(bank.swift || '') === normalizedSwift)
        : [];
    const preferredBySwift = pickPreferredBank(bySwift);
    if (preferredBySwift)
        return { bankCode: String(preferredBySwift.id), bank: preferredBySwift };

    const byName = normalizedBankName
        ? etbBanks.filter((bank) => {
            const bankLabel = normalizeBankLabel(bank.name || '');
            return bankLabel === normalizedBankName || bankLabel.includes(normalizedBankName) || normalizedBankName.includes(bankLabel);
        })
        : [];
    const preferredByName = pickPreferredBank(byName);
    if (preferredByName)
        return { bankCode: String(preferredByName.id), bank: preferredByName };

    throw new Error(`Unable to resolve numeric bank code for bank "${bankName}"`);
}

function normalizeAccountNumber(value: string): string {
    return value.replace(/\s+/g, '');
}

function isDigitsOnly(value: string): boolean {
    return /^\d+$/.test(value);
}

async function getProviderDefaultPaymentMethod(providerId: string): Promise<ProviderPaymentMethodRow | null> {
    const normalizedProviderId = normalizeText(providerId);
    if (!normalizedProviderId) return null;

    const { data: defaultActive, error: defaultActiveError } = await supabaseAdmin
        .from('provider_payment_methods')
        .select('*')
        .eq('providerID', normalizedProviderId)
        .eq('is_active', true)
        .eq('is_default', true)
        .order('updated_at', { ascending: false })
        .maybeSingle();
    if (!defaultActiveError && defaultActive)
        return defaultActive as ProviderPaymentMethodRow;

    const { data: anyActive, error: anyActiveError } = await supabaseAdmin
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

        const paymentMethod = await getProviderDefaultPaymentMethod(withdrawal.providerId);
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
        const resolvedBank = await resolveNumericBankCode({
            chapaSecretKey,
            storedBankCode,
            swiftCode,
            bankName: normalizedBankName,
        });
        const bankCode = resolvedBank.bankCode;
        const chapaBank = resolvedBank.bank;
        if (!isDigitsOnly(normalizedAccountNumber))
            return NextResponse.json(
                { error: 'Account number must contain only digits for bank transfer.' },
                { status: 400 }
            );
        if (typeof chapaBank?.acct_length === 'number' && chapaBank.acct_length > 0 && normalizedAccountNumber.length !== chapaBank.acct_length)
            return NextResponse.json(
                {
                    error: `Invalid account number length for ${chapaBank.name || normalizedBankName}. Expected ${chapaBank.acct_length} digits, got ${normalizedAccountNumber.length}.`,
                },
                { status: 400 }
            );

        const payload = {
            account_name: normalizedHolderName,
            account_number: normalizedAccountNumber,
            bank_code: bankCode,
            amount: withdrawal.amount,
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
        const notePart = `Chapa transfer sent. reference=${transferReference}${transferId ? ` transfer_id=${transferId}` : ''}`;
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

        await supabaseAdmin.from('notification').insert({
            title: 'Payout transfer initiated',
            description: `Transfer initiated for withdrawal ${withdrawal.id}. reference=${transferReference}`,
            type: 'payout_transfer_initiated',
            provider_id: withdrawal.providerId,
            action_url: '/admin/finance/payout-request',
            is_read: false,
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
                bank_name: normalizedBankName,
                account_number: normalizedAccountNumber,
            },
            amount: withdrawal.amount,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected payout error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

