import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

function readJobRequestCustomerRef(row: Record<string, unknown>): string | null {
    const candidates = [row.customerId, row.customer_id, row.userId, row.user_id];
    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
}

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminPermission(request, 'customers:read');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const customerId = id.trim();
    if (!customerId) {
        return NextResponse.json({ error: 'Customer id is required' }, { status: 400 });
    }

    try {
        const supabaseAdmin = getSupabaseAdminFromRequest(request);

        const { data: customer, error: customerError } = await supabaseAdmin
            .from('customer')
            .select('id, customer_id')
            .eq('id', customerId)
            .maybeSingle();

        if (customerError) {
            return NextResponse.json({ error: customerError.message }, { status: 500 });
        }
        if (!customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        const refIds = [customerId];
        const externalId = (customer as { customer_id?: string | null }).customer_id;
        if (typeof externalId === 'string' && externalId.trim()) refIds.push(externalId.trim());
        const uniqueRefIds = [...new Set(refIds)];

        const { data, error } = await supabaseAdmin
            .from('job_request')
            .select('*')
            .or(uniqueRefIds.map((refId) => `customerId.eq.${refId}`).join(','))
            .order('createdAt', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const rows = ((data ?? []) as Record<string, unknown>[]).filter((row) => {
            const ref = readJobRequestCustomerRef(row);
            return ref ? uniqueRefIds.includes(ref) : false;
        });

        const normalized = rows.map((row) => {
            const serviceModels = Array.isArray(row.serviceModelList) ? row.serviceModelList : [];
            const firstService = serviceModels[0] as { serviceName?: string | null } | undefined;
            const bidList = Array.isArray(row.bidList) ? row.bidList : [];

            return {
                id: String(row.id ?? ''),
                createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
                title: typeof row.title === 'string' ? row.title : '',
                description: typeof row.description === 'string' ? row.description : '',
                status: typeof row.status === 'string' ? row.status : '',
                accepted: row.accepted === true,
                isPaid: row.is_paid === true,
                price: typeof row.price === 'string' || typeof row.price === 'number' ? String(row.price) : '',
                serviceName:
                    (typeof firstService?.serviceName === 'string' ? firstService.serviceName : '')
                    || (typeof row.serviceName === 'string' ? row.serviceName : ''),
                bidCount: bidList.length,
            };
        });

        return NextResponse.json({ data: normalized });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch customer job requests';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
