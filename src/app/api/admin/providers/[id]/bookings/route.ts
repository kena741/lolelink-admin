import { NextResponse } from 'next/server';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { requireAdminPermission } from '@/lib/admin-auth';
import { parseBookingAmount } from '@/lib/booking-display';
import { buildBookingPayload } from '@/lib/booking-payload';
import { upsertBookingPaymentRecord } from '@/lib/booking-payment-side-effects';
import { BOOKING_PAYMENT_STATUS } from '@/lib/booking-status';
import {
    annotateHiredBefore,
    buildPastHireDescription,
    isPastHireDescription,
    summarizeServiceHistory,
} from '@/lib/provider-service-history';
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
    bookingDate?: string | null;
    customer_id?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    description?: string | null;
}

interface CreatePastHireBody {
    customer_id?: string;
    service_id?: string;
    bookingDate?: string;
    amount?: number | string;
    note?: string;
}

function customerDisplayName(
    row: BookingRow,
    customerNameById: Record<string, string>
): string {
    const fromBooking = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
    if (fromBooking) return fromBooking;
    const customerId = (row.customer_id ?? '').trim();
    if (customerId && customerNameById[customerId]) return customerNameById[customerId];
    return customerId || 'Customer';
}

/** Accept YYYY-MM-DD or ISO; store noon UTC for date-only so chronology is stable. */
function resolvePastHireTimestamp(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const iso = `${trimmed}T12:00:00.000Z`;
        return Number.isFinite(Date.parse(iso)) ? iso : null;
    }
    const ms = Date.parse(trimmed);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminPermission(request, 'providers:read');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const providerId = id.trim();
    if (!providerId) {
        return NextResponse.json({ error: 'Provider id is required' }, { status: 400 });
    }

    try {
        const supabaseAdmin = getSupabaseAdminFromRequest(request);

        const { data: bookings, error } = await supabaseAdmin
            .from('booked_service')
            .select(
                'id, serviceName, status, payment_status, paymentCompleted, totalAmount, price, createdAt, bookingDate, customer_id, firstName, lastName, description'
            )
            .eq('provider_id', providerId)
            .or('is_archived.is.null,is_archived.eq.false')
            .order('createdAt', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const rows = (bookings ?? []) as BookingRow[];
        const customerIds = [
            ...new Set(
                rows
                    .map((row) => (row.customer_id ?? '').trim())
                    .filter(Boolean)
            ),
        ];

        const customerNameById: Record<string, string> = {};
        if (customerIds.length > 0) {
            const { data: customers } = await supabaseAdmin
                .from('customer')
                .select('id, firstName, lastName, first_name, last_name, name, userName')
                .in('id', customerIds);

            for (const customer of (customers ?? []) as Record<string, unknown>[]) {
                const customerId = typeof customer.id === 'string' ? customer.id : '';
                if (!customerId) continue;
                const first =
                    (typeof customer.firstName === 'string' ? customer.firstName : null)
                    ?? (typeof customer.first_name === 'string' ? customer.first_name : null)
                    ?? '';
                const last =
                    (typeof customer.lastName === 'string' ? customer.lastName : null)
                    ?? (typeof customer.last_name === 'string' ? customer.last_name : null)
                    ?? '';
                const full = [first, last].filter(Boolean).join(' ').trim();
                customerNameById[customerId] =
                    full
                    || (typeof customer.name === 'string' ? customer.name : '')
                    || (typeof customer.userName === 'string' ? customer.userName : '')
                    || customerId;
            }
        }

        const annotated = annotateHiredBefore(
            rows.map((row) => ({
                id: row.id,
                customerId: (row.customer_id ?? '').trim(),
                status: (row.status ?? '').trim(),
                createdAt: row.createdAt ?? row.bookingDate ?? '',
                amount: parseBookingAmount(row.totalAmount ?? row.price) ?? 0,
            }))
        );

        const annotatedById = new Map(annotated.map((item) => [item.id, item]));
        const { stats, repeatCustomers } = summarizeServiceHistory(annotated);

        const data = rows.map((row) => {
            const meta = annotatedById.get(row.id);
            const customerId = (row.customer_id ?? '').trim();
            const description = row.description ?? '';
            return {
                id: row.id,
                serviceName: row.serviceName ?? '',
                status: row.status ?? '',
                paymentStatus: row.payment_status ?? '',
                paymentCompleted: row.paymentCompleted === true,
                amount: (meta?.amount ?? 0).toFixed(2),
                createdAt: row.createdAt ?? row.bookingDate ?? '',
                bookingDate: row.bookingDate ?? '',
                customerId,
                customerName: customerDisplayName(row, customerNameById),
                hiredBefore: meta?.hiredBefore === true,
                priorCompletedCount: meta?.priorCompletedCount ?? 0,
                isPastHire: isPastHireDescription(description),
                note: description,
            };
        });

        return NextResponse.json({
            data,
            stats,
            repeatCustomers: repeatCustomers.map((customer) => ({
                ...customer,
                customerName: customerNameById[customer.customerId] ?? customer.customerId,
            })),
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch provider bookings';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/** Admin-only past hire log: completed booking with no wallet credit / SMS / push. */
export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminPermission(request, 'bookings:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const providerId = id.trim();
    if (!providerId) {
        return NextResponse.json({ error: 'Provider id is required' }, { status: 400 });
    }

    try {
        const body = (await request.json()) as CreatePastHireBody;
        const customerId = (body.customer_id ?? '').trim();
        const serviceId = (body.service_id ?? '').trim();
        const note = typeof body.note === 'string' ? body.note : '';
        const pastAt = resolvePastHireTimestamp(body.bookingDate ?? '');

        if (!customerId) return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });
        if (!serviceId) return NextResponse.json({ error: 'service_id is required' }, { status: 400 });
        if (!pastAt) return NextResponse.json({ error: 'bookingDate is required' }, { status: 400 });
        if (Date.parse(pastAt) > Date.now() + 60_000) {
            return NextResponse.json({ error: 'Past hire date cannot be in the future' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdminFromRequest(request);

        const { row, totalAmountNumber } = await buildBookingPayload(supabaseAdmin, {
            customerId,
            serviceId,
            providerId,
            bookingDate: pastAt,
            description: buildPastHireDescription(note),
            paymentMode: 'mark_paid',
            unitPrice: body.amount,
        });

        row.status = 'completed';
        row.paymentCompleted = true;
        row.payment_status = BOOKING_PAYMENT_STATUS.COMPLETED;
        row.paymentType = 'admin';
        row.createdAt = pastAt;
        row.bookingDate = pastAt;
        delete row.payment_id;

        const { data: created, error: insertError } = await supabaseAdmin
            .from('booked_service')
            .upsert(row, { onConflict: 'id' })
            .select('id, serviceName, customer_id, totalAmount, price')
            .single();

        if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        const bookingId = String((created as { id: string }).id);
        try {
            const paymentId = await upsertBookingPaymentRecord(
                supabaseAdmin,
                {
                    id: bookingId,
                    customer_id: customerId,
                    totalAmount: (created as { totalAmount?: string | number }).totalAmount,
                    price: (created as { price?: string | number }).price,
                },
                {
                    providerRef: `past-hire-${bookingId}`,
                    paymentMethod: 'admin',
                    provider: 'admin',
                    status: BOOKING_PAYMENT_STATUS.COMPLETED,
                }
            );
            await supabaseAdmin
                .from('booked_service')
                .update({ payment_id: paymentId })
                .eq('id', bookingId);
        } catch (paymentError: unknown) {
            await supabaseAdmin.from('booked_service').delete().eq('id', bookingId);
            const message =
                paymentError instanceof Error ? paymentError.message : 'Failed to attach payment record';
            return NextResponse.json({ error: message }, { status: 500 });
        }

        await logAdminActivity({
            request,
            action: 'provider.past_hire.create',
            resource_type: 'booked_service',
            resource_id: bookingId,
            summary: `Logged past hire for provider ${providerId}`,
            metadata: {
                providerId,
                customerId,
                serviceId,
                amount: totalAmountNumber,
                bookingDate: pastAt,
            },
        });

        return NextResponse.json({
            data: {
                id: bookingId,
                amount: totalAmountNumber,
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to log past hire';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
