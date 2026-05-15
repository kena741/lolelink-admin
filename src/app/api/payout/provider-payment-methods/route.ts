import { NextResponse } from 'next/server';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface RequestBody {
    providerIds: string[];
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
    currency?: string | null;
    updated_at?: string | null;
}

interface BankDetailsDto {
    bankName?: string;
    bankCode?: string;
    accountNumber?: string;
    holderName?: string;
    swiftCode?: string;
    branchCity?: string;
    branchCountry?: string;
}

function normalizeText(value: string | undefined | null): string {
    return (value || '').trim();
}

function toBankDetails(method: ProviderPaymentMethodRow): BankDetailsDto {
    return {
        bankName: normalizeText(method.bankName || method.method_name) || undefined,
        bankCode: normalizeText(method.method_code) || undefined,
        accountNumber: normalizeText(method.accountNumber) || undefined,
        holderName: normalizeText(method.holderName) || undefined,
        swiftCode: normalizeText(method.swiftCode) || undefined,
        branchCity: normalizeText(method.branchCity) || undefined,
        branchCountry: normalizeText(method.branchCountry) || undefined,
    };
}

function pickPreferred(methods: ProviderPaymentMethodRow[]): ProviderPaymentMethodRow | null {
    const active = methods.filter((m) => m.is_active === true);
    const sorted = [...active].sort((a, b) => {
        const aDefault = a.is_default === true ? 1 : 0;
        const bDefault = b.is_default === true ? 1 : 0;
        if (aDefault !== bDefault) return bDefault - aDefault;
        const aUpdated = a.updated_at ? Date.parse(a.updated_at) : 0;
        const bUpdated = b.updated_at ? Date.parse(b.updated_at) : 0;
        return bUpdated - aUpdated;
    });
    return sorted[0] || null;
}

export async function POST(request: Request) {
        const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as RequestBody;
        const providerIds = (body.providerIds || []).map(normalizeText).filter(Boolean);
        if (providerIds.length === 0)
            return NextResponse.json({ error: 'providerIds is required' }, { status: 400 });

        const { data, error } = await supabaseAdmin
            .from('provider_payment_methods')
            .select('*')
            .in('providerID', providerIds);
        if (error)
            return NextResponse.json({ error: error.message || 'Failed to fetch provider payment methods' }, { status: 500 });

        const rows = (data || []) as ProviderPaymentMethodRow[];
        const grouped: Record<string, ProviderPaymentMethodRow[]> = {};
        rows.forEach((row) => {
            const key = normalizeText(row.providerID);
            if (!key) return;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(row);
        });

        const result: Record<string, BankDetailsDto | null> = {};
        providerIds.forEach((providerId) => {
            const picked = pickPreferred(grouped[providerId] || []);
            result[providerId] = picked ? toBankDetails(picked) : null;
        });

        return NextResponse.json({ data: result });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

