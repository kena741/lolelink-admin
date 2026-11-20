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
    subTotal?: string | number | null;
    price?: string | number | null;
    createdAt?: string | null;
    bookingDate?: string | null;
    provider_id?: string | null;
    description?: string | null;
    admin_note?: string | null;
    handyman_id?: string | null;
    providerMySelf?: boolean | null;
}

interface CreatePastHireBody {
    provider_id?: string;
    service_id?: string;
    bookingDate?: string;
    amount?: number | string;
    note?: string;
    admin_note?: string;
    handyman_id?: string | null;
}

interface UpdateBookingBody {
    booking_id?: string;
    admin_note?: string | null;
    handyman_id?: string | null;
}

function providerDisplayName(
    providerId: string,
    providerNameById: Record<string, string>
): string {
    return providerNameById[providerId] || providerId || 'Provider';
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

function readProviderDisplayName(provider: Record<string, unknown>): string {
    const first = typeof provider.firstName === 'string' ? provider.firstName.trim() : '';
    const last = typeof provider.lastName === 'string' ? provider.lastName.trim() : '';
    const full = [first, last].filter(Boolean).join(' ').trim();
    if (full) return full;
    if (typeof provider.userName === 'string' && provider.userName.trim()) return provider.userName.trim();
    return '';
}

const PROVIDER_NAME_SELECT = 'id, user_id, firstName, lastName, userName';
const HANDYMAN_NAME_SELECT = 'id, provider_id, firstName, lastName, phoneNumber';

function readHandymanDisplayName(row: Record<string, unknown>): string {
    const first = typeof row.firstName === 'string' ? row.firstName.trim() : '';
    const last = typeof row.lastName === 'string' ? row.lastName.trim() : '';
    const full = [first, last].filter(Boolean).join(' ').trim();
    if (full) return full;
    if (typeof row.phoneNumber === 'string' && row.phoneNumber.trim()) return row.phoneNumber.trim();
    return '';
}

async function loadHandymanNames(
    supabaseAdmin: ReturnType<typeof getSupabaseAdminFromRequest>,
    handymanIds: string[]
): Promise<Record<string, string>> {
    const byId: Record<string, string> = {};
    if (handymanIds.length === 0) return byId;
    const { data } = await supabaseAdmin
        .from('handyman')
        .select(HANDYMAN_NAME_SELECT)
        .in('id', handymanIds);
    for (const row of (data ?? []) as Record<string, unknown>[]) {
        const id = typeof row.id === 'string' ? row.id : '';
        if (!id) continue;
        const label = readHandymanDisplayName(row);
        if (label) byId[id] = label;
    }
    return byId;
}

async function assertHandymanBelongsToProvider(
    supabaseAdmin: ReturnType<typeof getSupabaseAdminFromRequest>,
    handymanId: string,
    providerId: string
): Promise<string | null> {
    const { data, error } = await supabaseAdmin
        .from('handyman')
        .select('id, provider_id')
        .eq('id', handymanId)
        .maybeSingle();
    if (error) return error.message;
    if (!data) return 'Handyman not found';
    const owner = typeof data.provider_id === 'string' ? data.provider_id.trim() : '';
    if (owner !== providerId) return 'Handyman does not belong to this provider';
    return null;
}

async function loadProviderNames(
    supabaseAdmin: ReturnType<typeof getSupabaseAdminFromRequest>,
    providerIds: string[]
): Promise<Record<string, string>> {
    const providerNameById: Record<string, string> = {};
    if (providerIds.length === 0) return providerNameById;

    // provider has camelCase columns only — bad column names 400 the whole .in() query
    const { data: providers } = await supabaseAdmin
        .from('provider')
        .select(PROVIDER_NAME_SELECT)
        .in('id', providerIds);

    const foundIds = new Set<string>();
    for (const provider of (providers ?? []) as Record<string, unknown>[]) {
        const providerId = typeof provider.id === 'string' ? provider.id : '';
        if (!providerId) continue;
        foundIds.add(providerId);
        const label = readProviderDisplayName(provider);
        if (label) providerNameById[providerId] = label;
    }

    const missing = providerIds.filter((id) => !foundIds.has(id));
    if (missing.length === 0) return providerNameById;

    // Some bookings store auth user_id on provider_id
    const { data: byUser } = await supabaseAdmin
        .from('provider')
        .select(PROVIDER_NAME_SELECT)
        .in('user_id', missing);

    for (const provider of (byUser ?? []) as Record<string, unknown>[]) {
        const userId = typeof provider.user_id === 'string' ? provider.user_id : '';
        const providerId = typeof provider.id === 'string' ? provider.id : '';
        const label = readProviderDisplayName(provider);
        if (!label) continue;
        if (userId) providerNameById[userId] = label;
        if (providerId) providerNameById[providerId] = label;
    }
    return providerNameById;
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

        const bookingSelect =
            'id, serviceName, status, payment_status, paymentCompleted, totalAmount, subTotal, price, createdAt, bookingDate, provider_id, description, admin_note, handyman_id, providerMySelf';
        let bookingsQuery: { data: unknown; error: { message?: string } | null } = await supabaseAdmin
            .from('booked_service')
            .select(bookingSelect)
            .eq('customer_id', customerId)
            .or('is_archived.is.null,is_archived.eq.false')
            .order('createdAt', { ascending: false });

        if (
            bookingsQuery.error?.message?.includes('admin_note') ||
            bookingsQuery.error?.message?.includes('handyman_id') ||
            bookingsQuery.error?.message?.includes('providerMySelf')
        ) {
            bookingsQuery = await supabaseAdmin
                .from('booked_service')
                .select(
                    'id, serviceName, status, payment_status, paymentCompleted, totalAmount, subTotal, price, createdAt, bookingDate, provider_id, description, admin_note'
                )
                .eq('customer_id', customerId)
                .or('is_archived.is.null,is_archived.eq.false')
                .order('createdAt', { ascending: false });
        }

        const { data: bookings, error } = bookingsQuery;
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const rows = (bookings ?? []) as BookingRow[];
        const providerIds = [
            ...new Set(
                rows.map((row) => (row.provider_id ?? '').trim()).filter(Boolean)
            ),
        ];
        const handymanIds = [
            ...new Set(
                rows.map((row) => (row.handyman_id ?? '').trim()).filter(Boolean)
            ),
        ];
        const providerNameById = await loadProviderNames(supabaseAdmin, providerIds);
        const handymanNameById = await loadHandymanNames(supabaseAdmin, handymanIds);

        // Reuse hired-before math with provider as the "peer" key (same booking rows as provider history).
        const annotated = annotateHiredBefore(
            rows.map((row) => ({
                id: row.id,
                customerId: (row.provider_id ?? '').trim(),
                status: (row.status ?? '').trim(),
                createdAt: row.createdAt ?? row.bookingDate ?? '',
                amount: parseBookingAmount(row.totalAmount ?? row.price) ?? 0,
            }))
        );
        const annotatedById = new Map(annotated.map((item) => [item.id, item]));
        const { stats, repeatCustomers } = summarizeServiceHistory(annotated);

        const data = rows.map((row) => {
            const meta = annotatedById.get(row.id);
            const providerId = (row.provider_id ?? '').trim();
            const handymanId = (row.handyman_id ?? '').trim();
            const description = row.description ?? '';
            return {
                id: row.id,
                serviceName: row.serviceName ?? '',
                status: row.status ?? '',
                paymentStatus: row.payment_status ?? '',
                paymentCompleted: row.paymentCompleted === true,
                totalAmount: row.totalAmount ?? null,
                subTotal: row.subTotal ?? null,
                price: row.price ?? null,
                amount: (meta?.amount ?? 0).toFixed(2),
                createdAt: row.createdAt ?? row.bookingDate ?? '',
                bookingDate: row.bookingDate ?? '',
                providerId,
                providerName: providerDisplayName(providerId, providerNameById),
                handymanId: handymanId || null,
                handymanName: handymanId ? handymanNameById[handymanId] ?? null : null,
                providerMySelf: row.providerMySelf !== false && !handymanId,
                hiredBefore: meta?.hiredBefore === true,
                priorCompletedCount: meta?.priorCompletedCount ?? 0,
                isPastHire: isPastHireDescription(description),
                note: description,
                followUp: row.admin_note ?? '',
            };
        });

        return NextResponse.json({
            data,
            stats,
            repeatProviders: repeatCustomers.map((provider) => ({
                providerId: provider.customerId,
                providerName: providerNameById[provider.customerId] ?? provider.customerId,
                completedCount: provider.completedCount,
                bookingCount: provider.bookingCount,
                totalSpent: provider.totalSpent,
                firstBookingAt: provider.firstBookingAt,
                lastBookingAt: provider.lastBookingAt,
            })),
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch customer bookings';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/** Same past-hire path as provider history — creates the shared booked_service row. */
export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminPermission(request, 'bookings:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const customerId = id.trim();
    if (!customerId) {
        return NextResponse.json({ error: 'Customer id is required' }, { status: 400 });
    }

    try {
        const body = (await request.json()) as CreatePastHireBody;
        const providerId = (body.provider_id ?? '').trim();
        const serviceId = (body.service_id ?? '').trim();
        const handymanId =
            typeof body.handyman_id === 'string' ? body.handyman_id.trim() : '';
        const note = typeof body.note === 'string' ? body.note : '';
        const followUp =
            typeof body.admin_note === 'string' ? body.admin_note.trim() : note.trim();
        const pastAt = resolvePastHireTimestamp(body.bookingDate ?? '');

        if (!providerId) return NextResponse.json({ error: 'provider_id is required' }, { status: 400 });
        if (!serviceId) return NextResponse.json({ error: 'service_id is required' }, { status: 400 });
        if (!pastAt) return NextResponse.json({ error: 'bookingDate is required' }, { status: 400 });
        if (Date.parse(pastAt) > Date.now() + 60_000) {
            return NextResponse.json({ error: 'Past hire date cannot be in the future' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdminFromRequest(request);

        const { data: customerRow, error: customerError } = await supabaseAdmin
            .from('customer')
            .select('id')
            .eq('id', customerId)
            .maybeSingle();
        if (customerError) {
            return NextResponse.json({ error: customerError.message }, { status: 500 });
        }
        if (!customerRow) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        if (handymanId) {
            const handymanError = await assertHandymanBelongsToProvider(
                supabaseAdmin,
                handymanId,
                providerId
            );
            if (handymanError) {
                return NextResponse.json({ error: handymanError }, { status: 400 });
            }
        }

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
        if (followUp) row.admin_note = followUp;
        // ponytail: optional worker on agency past-hire; null = provider self
        row.handyman_id = handymanId || null;
        row.providerMySelf = !handymanId;
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
            action: 'customer.past_hire.create',
            resource_type: 'booked_service',
            resource_id: bookingId,
            summary: `Logged past hire for customer ${customerId}`,
            metadata: {
                providerId,
                customerId,
                serviceId,
                handymanId: handymanId || null,
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

/** Same admin_note / handyman_id as provider history — edits sync both sides. */
export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminPermission(request, 'bookings:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const customerId = id.trim();
    if (!customerId) {
        return NextResponse.json({ error: 'Customer id is required' }, { status: 400 });
    }

    try {
        const body = (await request.json()) as UpdateBookingBody;
        const bookingId = (body.booking_id ?? '').trim();
        if (!bookingId) {
            return NextResponse.json({ error: 'booking_id is required' }, { status: 400 });
        }

        const hasNote = typeof body.admin_note === 'string' || body.admin_note === null;
        const hasHandyman = Object.prototype.hasOwnProperty.call(body, 'handyman_id');
        if (!hasNote && !hasHandyman) {
            return NextResponse.json(
                { error: 'admin_note or handyman_id is required' },
                { status: 400 }
            );
        }

        const supabaseAdmin = getSupabaseAdminFromRequest(request);

        const { data: existing, error: existingError } = await supabaseAdmin
            .from('booked_service')
            .select('id, customer_id, provider_id, admin_note, handyman_id, providerMySelf')
            .eq('id', bookingId)
            .eq('customer_id', customerId)
            .maybeSingle();

        if (existingError) {
            const missingColumn =
                existingError.message.includes('admin_note') ||
                existingError.message.includes('handyman_id') ||
                existingError.message.includes('providerMySelf');
            return NextResponse.json(
                {
                    error: missingColumn
                        ? 'Booking update needs DB columns admin_note / handyman_id / providerMySelf'
                        : existingError.message,
                },
                { status: missingColumn ? 503 : 500 }
            );
        }
        if (!existing) {
            return NextResponse.json({ error: 'Booking not found for this customer' }, { status: 404 });
        }

        const patch: Record<string, unknown> = {};
        let nextNote: string | null | undefined;
        if (hasNote) {
            nextNote = body.admin_note === null ? null : body.admin_note.trim() || null;
            patch.admin_note = nextNote;
        }

        let nextHandymanId: string | null | undefined;
        if (hasHandyman) {
            nextHandymanId =
                body.handyman_id === null || body.handyman_id === undefined
                    ? null
                    : String(body.handyman_id).trim() || null;
            const providerId =
                typeof existing.provider_id === 'string' ? existing.provider_id.trim() : '';
            if (nextHandymanId) {
                if (!providerId) {
                    return NextResponse.json(
                        { error: 'Booking has no provider to attach handyman' },
                        { status: 400 }
                    );
                }
                const handymanError = await assertHandymanBelongsToProvider(
                    supabaseAdmin,
                    nextHandymanId,
                    providerId
                );
                if (handymanError) {
                    return NextResponse.json({ error: handymanError }, { status: 400 });
                }
            }
            patch.handyman_id = nextHandymanId;
            patch.providerMySelf = !nextHandymanId;
        }

        const { data: updated, error: updateError } = await supabaseAdmin
            .from('booked_service')
            .update(patch)
            .eq('id', bookingId)
            .eq('customer_id', customerId)
            .select('id, admin_note, handyman_id, providerMySelf')
            .single();

        if (updateError) {
            const missingColumn =
                updateError.message.includes('admin_note') ||
                updateError.message.includes('handyman_id') ||
                updateError.message.includes('providerMySelf');
            return NextResponse.json(
                {
                    error: missingColumn
                        ? 'Booking update needs DB columns admin_note / handyman_id / providerMySelf'
                        : updateError.message,
                },
                { status: missingColumn ? 503 : 500 }
            );
        }

        const handymanNameById = await loadHandymanNames(
            supabaseAdmin,
            updated.handyman_id ? [String(updated.handyman_id)] : []
        );

        await logAdminActivity({
            request,
            action: 'customer.hire_history.update',
            resource_type: 'booked_service',
            resource_id: bookingId,
            summary: `Updated hire history for customer ${customerId}`,
            metadata: {
                customerId,
                bookingId,
                admin_note: nextNote,
                handyman_id: nextHandymanId,
            },
        });

        const handymanId =
            typeof updated.handyman_id === 'string' ? updated.handyman_id.trim() : '';
        return NextResponse.json({
            data: {
                id: updated.id,
                followUp: updated.admin_note ?? '',
                handymanId: handymanId || null,
                handymanName: handymanId ? handymanNameById[handymanId] ?? null : null,
                providerMySelf: updated.providerMySelf !== false && !handymanId,
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update booking';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
