import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface RequestBody {
    id?: string;
    providerID: string;
    method_type: string;
    method_code?: string | null;
    method_name?: string | null;
    holderName: string;
    accountNumber: string;
    swiftCode?: string | null;
    bankName?: string | null;
    branchCity?: string | null;
    branchCountry?: string | null;
    is_active?: boolean;
    is_default?: boolean;
    currency?: string | null;
    metadata?: Record<string, unknown> | null;
}

function normalizeText(value: string | null | undefined): string {
    return (value || '').trim();
}

function isNumericText(value: string): boolean {
    return /^\d+$/.test(value.trim());
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as RequestBody;
        const providerID = normalizeText(body.providerID);
        const methodType = normalizeText(body.method_type).toLowerCase();
        const holderName = normalizeText(body.holderName);
        const accountNumber = normalizeText(body.accountNumber).replace(/\s+/g, '');
        const methodCode = normalizeText(body.method_code);
        const bankName = normalizeText(body.bankName || body.method_name);

        if (!providerID)
            return NextResponse.json({ error: 'providerID is required' }, { status: 400 });
        if (!methodType)
            return NextResponse.json({ error: 'method_type is required' }, { status: 400 });
        if (!holderName)
            return NextResponse.json({ error: 'holderName is required' }, { status: 400 });
        if (!accountNumber)
            return NextResponse.json({ error: 'accountNumber is required' }, { status: 400 });
        if (!/^\d+$/.test(accountNumber))
            return NextResponse.json({ error: 'accountNumber must contain digits only' }, { status: 400 });

        if (methodType === 'bank') {
            if (!bankName)
                return NextResponse.json({ error: 'bankName or method_name is required for bank method' }, { status: 400 });
            if (!methodCode || !isNumericText(methodCode))
                return NextResponse.json({ error: 'method_code must be a numeric Chapa bank id for bank method' }, { status: 400 });
        }

        const isActive = body.is_active ?? true;
        const isDefault = body.is_default ?? false;
        const row = {
            providerID,
            method_type: methodType,
            method_code: methodCode || null,
            method_name: normalizeText(body.method_name) || null,
            holderName,
            accountNumber,
            swiftCode: normalizeText(body.swiftCode) || null,
            bankName: bankName || null,
            branchCity: normalizeText(body.branchCity) || null,
            branchCountry: normalizeText(body.branchCountry) || null,
            is_active: isActive,
            is_default: isDefault,
            currency: normalizeText(body.currency || 'ETB') || 'ETB',
            metadata: body.metadata || {},
            updated_at: new Date().toISOString(),
        };

        let upsertedId = normalizeText(body.id);
        if (upsertedId) {
            const { error } = await supabaseAdmin
                .from('provider_payment_methods')
                .update(row)
                .eq('id', upsertedId)
                .eq('providerID', providerID);
            if (error)
                return NextResponse.json({ error: error.message || 'Failed to update payment method' }, { status: 500 });
        } else {
            const { data, error } = await supabaseAdmin
                .from('provider_payment_methods')
                .insert({
                    ...row,
                    created_at: new Date().toISOString(),
                })
                .select('id')
                .single();
            if (error)
                return NextResponse.json({ error: error.message || 'Failed to create payment method' }, { status: 500 });
            upsertedId = (data as { id: string }).id;
        }

        if (isActive && isDefault) {
            await supabaseAdmin
                .from('provider_payment_methods')
                .update({ is_default: false, updated_at: new Date().toISOString() })
                .eq('providerID', providerID)
                .neq('id', upsertedId)
                .eq('is_default', true);
        }

        return NextResponse.json({ status: 'ok', id: upsertedId });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

