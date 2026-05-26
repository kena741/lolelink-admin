import { NextResponse } from 'next/server';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface WalletTransactionRow {
    userId?: string | null;
    type?: string | null;
}

function isCustomerTransactionType(type: string | undefined | null): boolean {
    return typeof type === 'string' && type.trim().toLowerCase() === 'customer';
}

function providerDisplayName(raw: Record<string, unknown>): string {
    const first =
        (typeof raw.firstName === 'string' && raw.firstName) ||
        (typeof raw.first_name === 'string' && raw.first_name) ||
        '';
    const last =
        (typeof raw.lastName === 'string' && raw.lastName) ||
        (typeof raw.last_name === 'string' && raw.last_name) ||
        '';
    return [first, last].filter(Boolean).join(' ');
}

function providerDisplayPhone(raw: Record<string, unknown>): string {
    if (typeof raw.phoneNumber === 'string' && raw.phoneNumber) return raw.phoneNumber;
    if (typeof raw.phone === 'string' && raw.phone) return raw.phone;
    return '';
}

function customerDisplayName(raw: Record<string, unknown>): string {
    const first =
        (typeof raw.first_name === 'string' && raw.first_name) ||
        (typeof raw.firstName === 'string' && raw.firstName) ||
        '';
    const last =
        (typeof raw.last_name === 'string' && raw.last_name) ||
        (typeof raw.lastName === 'string' && raw.lastName) ||
        '';
    return [first, last].filter(Boolean).join(' ');
}

function customerDisplayPhone(raw: Record<string, unknown>): string {
    const candidates = [raw.phoneNumber, raw.phone, raw.mobile_number, raw.mobileNumber];
    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
}

export async function GET(request: Request) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const { data, error } = await supabaseAdmin
            .from('wallet_transaction')
            .select('*')
            .order('createdDate', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const rows = (data ?? []) as WalletTransactionRow[];

        const providerIds = [
            ...new Set(
                rows
                    .filter((row) => !isCustomerTransactionType(row.type))
                    .map((row) => row.userId)
                    .filter((id): id is string => Boolean(id))
            ),
        ];
        const customerIds = [
            ...new Set(
                rows
                    .filter((row) => isCustomerTransactionType(row.type))
                    .map((row) => row.userId)
                    .filter((id): id is string => Boolean(id))
            ),
        ];

        const providerById: Record<string, { name: string; phone: string }> = {};
        if (providerIds.length > 0) {
            const { data: providers, error: providerError } = await supabaseAdmin
                .from('provider')
                .select('*')
                .in('id', providerIds);

            if (providerError) {
                return NextResponse.json({ error: providerError.message }, { status: 500 });
            }

            (providers as Record<string, unknown>[] | null)?.forEach((provider) => {
                const id = typeof provider.id === 'string' ? provider.id : '';
                if (!id) return;
                providerById[id] = {
                    name: providerDisplayName(provider),
                    phone: providerDisplayPhone(provider),
                };
            });
        }

        const customerById: Record<string, { name: string; phone: string }> = {};
        if (customerIds.length > 0) {
            const { data: customers, error: customerError } = await supabaseAdmin
                .from('customer')
                .select('*')
                .in('id', customerIds);

            if (customerError) {
                return NextResponse.json({ error: customerError.message }, { status: 500 });
            }

            (customers as Record<string, unknown>[] | null)?.forEach((customer) => {
                const id = typeof customer.id === 'string' ? customer.id : '';
                if (!id) return;
                customerById[id] = {
                    name: customerDisplayName(customer),
                    phone: customerDisplayPhone(customer),
                };
            });
        }

        const enriched = rows.map((row) => {
            const lookupMap = isCustomerTransactionType(row.type) ? customerById : providerById;
            const lookup = row.userId ? lookupMap[row.userId] : undefined;
            return {
                ...row,
                providerName: lookup?.name ?? '',
                providerPhone: lookup?.phone ?? '',
            };
        });

        return NextResponse.json({ data: enriched });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch wallet transactions';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
