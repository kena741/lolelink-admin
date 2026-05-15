import { NextResponse } from 'next/server';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface CustomerLookupRow {
    id: string;
    customer_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    phoneNumber?: string | null;
}

function readJobRequestCustomerRef(row: Record<string, unknown>): string | null {
    const candidates = [row.customerId, row.customer_id, row.userId, row.user_id];
    for (const value of candidates) {
        if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    }
    return null;
}

function buildCustomerLookup(rows: CustomerLookupRow[]): Map<string, CustomerLookupRow> {
    const map = new Map<string, CustomerLookupRow>();
    for (const customer of rows) {
        map.set(customer.id, customer);
        const alt = customer.customer_id;
        if (typeof alt === 'string' && alt.trim().length > 0) map.set(alt.trim(), customer);
    }
    return map;
}

function customerDisplayName(customer: CustomerLookupRow | undefined): string {
    if (!customer) return '';
    const record = customer as unknown as Record<string, unknown>;
    const first =
        (typeof customer.first_name === 'string' ? customer.first_name : null)
        ?? (typeof record.firstName === 'string' ? record.firstName : null);
    const last =
        (typeof customer.last_name === 'string' ? customer.last_name : null)
        ?? (typeof record.lastName === 'string' ? record.lastName : null);
    return [first, last].filter((part): part is string => Boolean(part && part.trim())).join(' ').trim();
}

function customerDisplayPhone(customer: CustomerLookupRow | undefined): string {
    if (!customer) return '';
    const record = customer as unknown as Record<string, unknown>;
    const candidates = [
        customer.phoneNumber,
        customer.phone,
        record.phoneNumber,
        record.phone,
        record.mobileNumber,
        record.mobile_number,
    ];
    for (const value of candidates) {
        if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    }
    return '';
}

export async function GET(request: Request) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const { data, error } = await supabaseAdmin
            .from('job_request')
            .select('*')
            .order('createdAt', { ascending: false });

        if (error)
            return NextResponse.json({ error: error.message || 'Failed to fetch job requests' }, { status: 500 });

        const rows = (data ?? []) as Record<string, unknown>[];
        const customerRefs = [
            ...new Set(rows.map(readJobRequestCustomerRef).filter((id): id is string => id !== null)),
        ];

        let customerLookup = new Map<string, CustomerLookupRow>();
        if (customerRefs.length > 0) {
            const { data: byId, error: errById } = await supabaseAdmin
                .from('customer')
                .select('*')
                .in('id', customerRefs);
            if (errById)
                return NextResponse.json({ error: errById.message || 'Failed to fetch customers' }, { status: 500 });
            customerLookup = buildCustomerLookup((byId ?? []) as CustomerLookupRow[]);

            const unresolved = customerRefs.filter((ref) => !customerLookup.has(ref));
            if (unresolved.length > 0) {
                const { data: byCustomerId, error: errByCustomerId } = await supabaseAdmin
                    .from('customer')
                    .select('*')
                    .in('customer_id', unresolved);
                if (errByCustomerId)
                    return NextResponse.json({ error: errByCustomerId.message || 'Failed to fetch customers' }, { status: 500 });
                const extra = buildCustomerLookup((byCustomerId ?? []) as CustomerLookupRow[]);
                for (const [key, value] of extra) {
                    if (!customerLookup.has(key)) customerLookup.set(key, value);
                }
            }
        }

        const enriched = rows.map((row) => {
            const ref = readJobRequestCustomerRef(row);
            const customer = ref ? customerLookup.get(ref) : undefined;
            const displayName = customerDisplayName(customer);
            const displayPhone = customerDisplayPhone(customer);
            return {
                ...row,
                customerDisplayName: displayName || null,
                customerDisplayPhone: displayPhone || null,
            };
        });

        return NextResponse.json({ data: enriched });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

interface UpdateJobRequestBody {
    id?: string;
    action?: 'accept' | 'reject' | 'pending';
}

export async function PATCH(request: Request) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as UpdateJobRequestBody;
        const id = (body.id || '').trim();
        const action = body.action;
        if (!id || !action)
            return NextResponse.json({ error: 'id and action are required' }, { status: 400 });
        const updatePayload = action === 'accept'
            ? { accepted: true, status: 'accepted' }
            : action === 'reject'
                ? { accepted: false, status: 'rejected' }
                : { accepted: false, status: 'pending' };
        const { error } = await supabaseAdmin
            .from('job_request')
            .update(updatePayload)
            .eq('id', id);
        if (error)
            return NextResponse.json({ error: error.message || 'Failed to update job request' }, { status: 500 });
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
