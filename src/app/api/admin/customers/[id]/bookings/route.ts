import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface BookingRow {
    id: string;
    serviceName?: string | null;
    status?: string | null;
    payment_status?: string | null;
    paymentCompleted?: boolean | null;
    totalAmount?: string | number | null;
    price?: string | number | null;
    createdAt?: string | null;
    provider_id?: string | null;
}

function parseAmount(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
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

        const { data: bookings, error } = await supabaseAdmin
            .from('booked_service')
            .select('id, serviceName, status, payment_status, paymentCompleted, totalAmount, price, createdAt, provider_id')
            .eq('customer_id', customerId)
            .or('is_archived.is.null,is_archived.eq.false')
            .order('createdAt', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const rows = (bookings ?? []) as BookingRow[];
        const providerIds = [
            ...new Set(rows.map((row) => row.provider_id).filter((value): value is string => Boolean(value))),
        ];

        const providerNameById: Record<string, string> = {};
        if (providerIds.length > 0) {
            const { data: providers } = await supabaseAdmin
                .from('provider')
                .select('id, firstName, lastName, first_name, last_name, name, userName')
                .in('id', providerIds);

            for (const provider of (providers ?? []) as Record<string, unknown>[]) {
                const providerId = typeof provider.id === 'string' ? provider.id : '';
                if (!providerId) continue;
                const first =
                    (typeof provider.firstName === 'string' ? provider.firstName : null)
                    ?? (typeof provider.first_name === 'string' ? provider.first_name : null)
                    ?? '';
                const last =
                    (typeof provider.lastName === 'string' ? provider.lastName : null)
                    ?? (typeof provider.last_name === 'string' ? provider.last_name : null)
                    ?? '';
                const full = [first, last].filter(Boolean).join(' ').trim();
                providerNameById[providerId] =
                    full
                    || (typeof provider.name === 'string' ? provider.name : '')
                    || (typeof provider.userName === 'string' ? provider.userName : '')
                    || providerId;
            }
        }

        const data = rows.map((row) => ({
            id: row.id,
            serviceName: row.serviceName ?? '',
            status: row.status ?? '',
            paymentStatus: row.payment_status ?? '',
            paymentCompleted: row.paymentCompleted === true,
            amount: parseAmount(row.totalAmount ?? row.price).toFixed(2),
            createdAt: row.createdAt ?? '',
            providerId: row.provider_id ?? '',
            providerName: row.provider_id ? providerNameById[row.provider_id] ?? '' : '',
        }));

        return NextResponse.json({ data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch customer bookings';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
