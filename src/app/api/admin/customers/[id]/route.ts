import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { buildChangeMetadata } from '@/lib/activity-log-changes';

export const runtime = 'nodejs';

const ARCHIVE_COLUMN_SQL =
    'ALTER TABLE customer ADD COLUMN IF NOT EXISTS archived_at timestamptz; ALTER TABLE provider ADD COLUMN IF NOT EXISTS archived_at timestamptz;';

type RouteParams = { id: string };

async function getIdFromParams(params: Promise<RouteParams> | RouteParams): Promise<string | null> {
    const resolved = await Promise.resolve(params);
    const id = resolved?.id?.trim();
    return id && id.length > 0 ? id : null;
}

interface PatchBody {
    action?: 'archive' | 'restore';
    admin_note?: string | null;
}

function columnHintMessage(raw: string): string {
    if (raw.includes('admin_note'))
        return `${raw} Run scripts/sql/add-provider-customer-admin-note.sql`;
    if (raw.includes('archived_at') || raw.includes('column') || raw.includes('schema'))
        return `${raw} Run in SQL editor: ${ARCHIVE_COLUMN_SQL}`;
    return raw;
}

function parseBookingAmount(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function isPaidBooking(row: Record<string, unknown>): boolean {
    if (row.paymentCompleted === true) return true;
    const paymentStatus = String(row.payment_status ?? '').toLowerCase();
    return ['completed', 'paid', 'success', 'successful'].includes(paymentStatus);
}

export async function GET(request: Request, context: { params: Promise<RouteParams> }) {
    const auth = await requireAdminPermission(request, 'customers:read');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const id = await getIdFromParams(context.params);
        if (!id) return NextResponse.json({ error: 'Invalid customer id' }, { status: 400 });

        const { data: customer, error: customerError } = await supabaseAdmin
            .from('customer')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (customerError) return NextResponse.json({ error: customerError.message }, { status: 500 });
        if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

        const customerRecord = customer as Record<string, unknown>;
        const refIds = [id];
        const externalId = customerRecord.customer_id;
        if (typeof externalId === 'string' && externalId.trim()) refIds.push(externalId.trim());
        const uniqueRefIds = [...new Set(refIds)];

        const { data: providerRow } = await supabaseAdmin
            .from('provider')
            .select('id')
            .eq('id', id)
            .maybeSingle();

        const { data: bookings, error: bookingsError } = await supabaseAdmin
            .from('booked_service')
            .select('id, totalAmount, price, paymentCompleted, payment_status, createdAt')
            .eq('customer_id', id);

        if (bookingsError) return NextResponse.json({ error: bookingsError.message }, { status: 500 });

        const bookingRows = (bookings ?? []) as Record<string, unknown>[];
        let totalSpent = 0;
        let lastBookingAt: string | null = null;

        for (const row of bookingRows) {
            if (!isPaidBooking(row)) continue;
            totalSpent += parseBookingAmount(
                (row.totalAmount as string | number | null | undefined) ?? (row.price as string | number | null | undefined)
            );
            const createdAt = typeof row.createdAt === 'string' ? row.createdAt : null;
            if (createdAt && (!lastBookingAt || new Date(createdAt) > new Date(lastBookingAt))) {
                lastBookingAt = createdAt;
            }
        }

        const jobRequestFilters = uniqueRefIds.map((refId) => `customerId.eq.${refId}`).join(',');
        const { data: jobRequests, error: jobRequestsError } = await supabaseAdmin
            .from('job_request')
            .select('id')
            .or(jobRequestFilters);

        if (jobRequestsError) return NextResponse.json({ error: jobRequestsError.message }, { status: 500 });

        const walletAmount = Number(customerRecord.wallet_amount ?? 0);

        return NextResponse.json({
            customer: {
                ...customerRecord,
                provider_id: providerRow?.id ?? null,
                wallet_amount: Number.isFinite(walletAmount) ? walletAmount : 0,
            },
            stats: {
                bookingCount: bookingRows.length,
                totalSpent: Math.round(totalSpent * 100) / 100,
                jobRequestCount: (jobRequests ?? []).length,
                lastBookingAt,
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: { params: Promise<RouteParams> }) {
    const auth = await requireAdminPermission(request, 'customers:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const id = await getIdFromParams(context.params);
        if (!id) return NextResponse.json({ error: 'Invalid customer id' }, { status: 400 });

        const body = (await request.json()) as PatchBody;

        if (typeof body.admin_note === 'string' || body.admin_note === null) {
            const { data: existing, error: existingError } = await supabaseAdmin
                .from('customer')
                .select('id, first_name, last_name, user_name, admin_note')
                .eq('id', id)
                .maybeSingle();

            if (existingError) {
                return NextResponse.json(
                    { error: columnHintMessage(existingError.message) },
                    { status: 500 }
                );
            }
            if (!existing) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

            const nextNote = body.admin_note === null ? null : body.admin_note;
            const { data: updated, error: noteError } = await supabaseAdmin
                .from('customer')
                .update({ admin_note: nextNote })
                .eq('id', id)
                .select('id, admin_note')
                .single();

            if (noteError) {
                return NextResponse.json({ error: columnHintMessage(noteError.message) }, { status: 500 });
            }

            const customerName =
                [existing.first_name, existing.last_name].filter(Boolean).join(' ').trim()
                || (existing.user_name as string | undefined)?.trim()
                || id;

            await logAdminActivity({
                request,
                action: 'update',
                resource_type: 'customer',
                resource_id: id,
                summary: `Updated admin note for customer ${customerName}`,
                metadata: buildChangeMetadata(
                    existing as Record<string, unknown>,
                    { ...existing, admin_note: nextNote } as Record<string, unknown>,
                    ['admin_note']
                ),
            });

            return NextResponse.json({ ok: true, customer: updated });
        }

        const action = body.action;
        if (action !== 'archive' && action !== 'restore')
            return NextResponse.json({ error: 'action must be archive or restore' }, { status: 400 });

        const archived_at = action === 'archive' ? new Date().toISOString() : null;

        const { data: customerRow, error: customerFetchError } = await supabaseAdmin
            .from('customer')
            .select('id, first_name, last_name, user_name, archived_at')
            .eq('id', id)
            .maybeSingle();

        if (customerFetchError) return NextResponse.json({ error: customerFetchError.message }, { status: 500 });
        if (!customerRow) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

        const customerName =
            [customerRow.first_name, customerRow.last_name].filter(Boolean).join(' ').trim()
            || (customerRow.user_name as string | undefined)?.trim()
            || id;

        const { error } = await supabaseAdmin.from('customer').update({ archived_at }).eq('id', id);
        if (error) return NextResponse.json({ error: columnHintMessage(error.message) }, { status: 500 });

        await logAdminActivity({
            request,
            action: action,
            resource_type: 'customer',
            resource_id: id,
            summary: `${action === 'archive' ? 'Archived' : 'Restored'} customer ${customerName}`,
            metadata: buildChangeMetadata(
                customerRow as Record<string, unknown>,
                { ...customerRow, archived_at } as Record<string, unknown>,
                ['archived_at']
            ),
        });

        return NextResponse.json({ ok: true, archived_at });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: Promise<RouteParams> }) {
    const auth = await requireAdminPermission(request, 'customers:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const id = await getIdFromParams(context.params);
        if (!id) return NextResponse.json({ error: 'Invalid customer id' }, { status: 400 });

        const { data: customerRow, error: customerFetchError } = await supabaseAdmin
            .from('customer')
            .select('customer_id, first_name, last_name, user_name')
            .eq('id', id)
            .maybeSingle();

        if (customerFetchError) return NextResponse.json({ error: customerFetchError.message }, { status: 500 });
        if (!customerRow) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

        const customerName =
            [customerRow.first_name, customerRow.last_name].filter(Boolean).join(' ').trim()
            || (customerRow.user_name as string | undefined)?.trim()
            || id;

        const refIds = [id];
        const externalId = customerRow?.customer_id;
        if (typeof externalId === 'string' && externalId.trim().length > 0) refIds.push(externalId.trim());
        const uniqueRefIds = [...new Set(refIds)];

        for (const refId of uniqueRefIds) {
            const { error: jobRequestError } = await supabaseAdmin
                .from('job_request')
                .delete()
                .eq('customerId', refId);
            if (jobRequestError) return NextResponse.json({ error: jobRequestError.message }, { status: 500 });
        }

        const { error } = await supabaseAdmin.from('customer').delete().eq('id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await logAdminActivity({
            request,
            action: 'delete',
            resource_type: 'customer',
            resource_id: id,
            summary: `Deleted customer ${customerName}`,
        });

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
