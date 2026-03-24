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

interface ProviderRow {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
}

interface BankDetailsRow {
    providerID: string;
    bankName?: string | null;
    accountNumber?: string | null;
    holderName?: string | null;
    swiftCode?: string | null;
    branchCity?: string | null;
    branchCountry?: string | null;
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
        const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '';

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

        const { data: providerData } = await supabaseAdmin
            .from('provider')
            .select('id, firstName, lastName, email')
            .eq('id', withdrawal.providerId)
            .maybeSingle();

        const provider = providerData as ProviderRow | null;

        const { data: bankData } = await supabaseAdmin
            .from('bank_details')
            .select('providerID, bankName, accountNumber, holderName, swiftCode, branchCity, branchCountry')
            .eq('providerID', withdrawal.providerId)
            .maybeSingle();

        const bank = bankData as BankDetailsRow | null;
        if (!bank?.accountNumber || !bank?.bankName || !bank?.holderName)
            return NextResponse.json(
                { error: 'Provider bank details are incomplete' },
                { status: 400 }
            );

        const txRef = buildTxRef(withdrawal.id);
        const callbackUrl = appBaseUrl ? `${appBaseUrl}/api/payout/chapa-callback` : undefined;

        const payload = {
            amount: withdrawal.amount,
            currency: 'ETB',
            email: provider?.email || 'payout@zemenservice.com',
            first_name: provider?.firstName || bank.holderName || 'Provider',
            last_name: provider?.lastName || '',
            tx_ref: txRef,
            callback_url: callbackUrl,
            customization: {
                title: 'Withdrawal',
                description: `Payout ${withdrawal.id}`.slice(0, 50),
            },
            meta: {
                withdrawal_id: withdrawal.id,
                provider_id: withdrawal.providerId,
                bank_name: bank.bankName,
                account_number: bank.accountNumber,
                account_name: bank.holderName,
                swift_code: bank.swiftCode || '',
                branch_city: bank.branchCity || '',
                branch_country: bank.branchCountry || '',
            },
        };

        const chapaResponse = await fetch('https://api.chapa.co/v1/transaction/initialize', {
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
            data?: { checkout_url?: string };
        };

        if (!chapaResponse.ok || chapaData.status !== 'success') {
            const message = toErrorMessage(chapaData.message, 'Failed to initialize Chapa transfer');
            return NextResponse.json(
                { error: message, details: chapaData },
                { status: 400 }
            );
        }

        const notePart = `Chapa initialized. tx_ref=${txRef}`;
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

        return NextResponse.json({
            status: 'success',
            tx_ref: txRef,
            checkout_url: chapaData.data?.checkout_url || null,
            message: 'Chapa payout initialized',
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected payout error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

