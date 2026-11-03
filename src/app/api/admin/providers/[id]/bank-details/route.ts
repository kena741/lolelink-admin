import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { hasPermission } from '@/lib/admin-permissions';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface BankMethodRow {
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

interface UpsertBody {
    id?: string;
    holderName?: string;
    accountNumber?: string;
    bankName?: string;
    swiftCode?: string;
    branchCity?: string;
    branchCountry?: string;
    /** Chapa bank id when picked from the bank list (preferred for payouts). */
    method_code?: string;
}

function normalizeText(value: string | null | undefined): string {
    return (value || '').trim();
}

function slugifyBankCode(bankName: string): string {
    return bankName.toLowerCase().replace(/\s+/g, '_');
}

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminSession(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const perms = auth.context.permissions;
    if (!(hasPermission(perms, 'providers:read') || hasPermission(perms, 'finance:read'))) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await context.params;
    const providerId = normalizeText(id);
    if (!providerId) {
        return NextResponse.json({ error: 'Provider id is required' }, { status: 400 });
    }

    try {
        const supabaseAdmin = getSupabaseAdminFromRequest(request);
        const { data, error } = await supabaseAdmin
            .from('provider_payment_methods')
            .select(
                'id, providerID, method_type, method_code, method_name, holderName, accountNumber, swiftCode, bankName, branchCity, branchCountry, is_active, is_default, currency, updated_at'
            )
            .eq('providerID', providerId)
            .eq('method_type', 'bank')
            .order('is_default', { ascending: false })
            .order('updated_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message || 'Failed to load bank details' }, { status: 500 });
        }

        const methods = (data || []) as BankMethodRow[];
        const preferred = methods.find((m) => m.is_active !== false) || methods[0] || null;

        return NextResponse.json({ data: preferred, methods });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminSession(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const perms = auth.context.permissions;
    // ponytail: providers:write covers profile edits; finance:write covers payout ops
    if (!(hasPermission(perms, 'providers:write') || hasPermission(perms, 'finance:write'))) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await context.params;
    const providerId = normalizeText(id);
    if (!providerId) {
        return NextResponse.json({ error: 'Provider id is required' }, { status: 400 });
    }

    try {
        const body = (await request.json()) as UpsertBody;
        const holderName = normalizeText(body.holderName);
        const accountNumber = normalizeText(body.accountNumber).replace(/\s+/g, '');
        const bankName = normalizeText(body.bankName);
        const swiftCode = normalizeText(body.swiftCode);
        const branchCity = normalizeText(body.branchCity);
        const branchCountry = normalizeText(body.branchCountry);
        const existingId = normalizeText(body.id);
        const providedCode = normalizeText(body.method_code);

        if (!holderName) {
            return NextResponse.json({ error: 'Account holder name is required' }, { status: 400 });
        }
        if (!accountNumber) {
            return NextResponse.json({ error: 'Account number is required' }, { status: 400 });
        }
        if (!/^\d+$/.test(accountNumber)) {
            return NextResponse.json({ error: 'Account number must contain digits only' }, { status: 400 });
        }
        if (!bankName) {
            return NextResponse.json({ error: 'Bank name is required' }, { status: 400 });
        }
        if (!swiftCode) {
            return NextResponse.json({ error: 'SWIFT code is required' }, { status: 400 });
        }

        // Match mobile: slug from bank name; prefer numeric Chapa id when admin picks a bank.
        const methodCode = /^\d+$/.test(providedCode) ? providedCode : slugifyBankCode(bankName);

        const supabaseAdmin = getSupabaseAdminFromRequest(request);

        await supabaseAdmin
            .from('provider_payment_methods')
            .update({ is_default: false, updated_at: new Date().toISOString() })
            .eq('providerID', providerId)
            .eq('is_default', true);

        const row = {
            providerID: providerId,
            method_type: 'bank',
            method_code: methodCode,
            method_name: bankName,
            holderName,
            accountNumber,
            swiftCode,
            bankName,
            branchCity: branchCity || null,
            branchCountry: branchCountry || null,
            is_active: true,
            is_default: true,
            currency: 'ETB',
            metadata: {},
            updated_at: new Date().toISOString(),
        };

        let savedId = existingId;

        if (savedId) {
            const { error } = await supabaseAdmin
                .from('provider_payment_methods')
                .update(row)
                .eq('id', savedId)
                .eq('providerID', providerId);
            if (error) {
                return NextResponse.json({ error: error.message || 'Failed to update bank details' }, { status: 500 });
            }
        } else {
            const { data: existing, error: findError } = await supabaseAdmin
                .from('provider_payment_methods')
                .select('id')
                .eq('providerID', providerId)
                .eq('method_type', 'bank')
                .eq('accountNumber', accountNumber)
                .maybeSingle();
            if (findError) {
                return NextResponse.json({ error: findError.message || 'Failed to look up bank details' }, { status: 500 });
            }

            if (existing?.id) {
                savedId = String(existing.id);
                const { error } = await supabaseAdmin
                    .from('provider_payment_methods')
                    .update(row)
                    .eq('id', savedId);
                if (error) {
                    return NextResponse.json({ error: error.message || 'Failed to update bank details' }, { status: 500 });
                }
            } else {
                const { data, error } = await supabaseAdmin
                    .from('provider_payment_methods')
                    .insert({ ...row, created_at: new Date().toISOString() })
                    .select('id')
                    .single();
                if (error) {
                    return NextResponse.json({ error: error.message || 'Failed to create bank details' }, { status: 500 });
                }
                savedId = (data as { id: string }).id;
            }
        }

        return NextResponse.json({ status: 'ok', id: savedId });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
