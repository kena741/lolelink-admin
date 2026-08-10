import { NextResponse } from 'next/server';
import { loadChapaSecretKey } from '@/lib/chapa-config';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// ponytail: temporary public charge page; remove when app flow is fixed
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 500_000;

interface PayBody {
    amount?: number | string;
    email?: string;
    first_name?: string;
    last_name?: string;
    phone_number?: string;
}

function parseAmount(value: number | string | undefined): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const n = Number.parseFloat(value.trim());
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

function normalizeChapaPhone(raw: string | null | undefined): string | null {
    const digits = (raw ?? '').replace(/\D/g, '');
    if (digits.length === 10 && (digits.startsWith('09') || digits.startsWith('07'))) return digits;
    if (digits.length === 9 && (digits.startsWith('9') || digits.startsWith('7'))) return `0${digits}`;
    if (digits.length === 12 && digits.startsWith('251') && (digits[3] === '9' || digits[3] === '7')) {
        return `0${digits.slice(3)}`;
    }
    return null;
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as PayBody;
        const amount = parseAmount(body.amount);
        if (amount == null || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
            return NextResponse.json(
                { error: `Amount must be between ETB ${MIN_AMOUNT} and ${MAX_AMOUNT.toLocaleString()}` },
                { status: 400 }
            );
        }

        const admin = getSupabaseAdminFromRequest(request);
        const chapaSecretKey = await loadChapaSecretKey(admin);
        if (!chapaSecretKey) {
            return NextResponse.json({ error: 'Missing Chapa secret key' }, { status: 500 });
        }

        const origin = new URL(request.url).origin;
        const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || origin).trim();
        const txRef = `direct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.slice(0, 50);
        const email = (body.email ?? '').trim() || 'payments@zemen.app';
        const firstName = (body.first_name ?? '').trim() || 'Customer';
        const lastName = (body.last_name ?? '').trim() || '';
        const phoneNumber = normalizeChapaPhone(body.phone_number);

        const chapaPayload: Record<string, string> = {
            amount: amount.toFixed(2),
            currency: 'ETB',
            email,
            first_name: firstName,
            last_name: lastName,
            tx_ref: txRef,
            return_url: `${appBaseUrl}/pay/done?tx_ref=${encodeURIComponent(txRef)}`,
            'customization[title]': 'Payment',
            'customization[description]': `Direct payment ETB ${amount.toFixed(2)}`,
        };
        if (phoneNumber) chapaPayload.phone_number = phoneNumber;

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

        if (!chapaResponse.ok || chapaData.status !== 'success' || !chapaData.data?.checkout_url) {
            return NextResponse.json(
                { error: chapaData.message || 'Failed to initialize Chapa checkout', details: chapaData },
                { status: 400 }
            );
        }

        return NextResponse.json({
            status: 'success',
            checkout_url: chapaData.data.checkout_url,
            tx_ref: txRef,
            amount: amount.toFixed(2),
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
