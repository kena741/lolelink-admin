import { NextResponse } from 'next/server';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { requireAdminPermission } from '@/lib/admin-auth';
import {
    clawbackProviderCompletionPayout,
    creditProviderForCompletedBooking,
} from '@/lib/booking-completion-payout';
import { refundCustomerForRejectedBooking } from '@/lib/booking-payment-side-effects';
import { sendBookingStatusUpdatedNotifications } from '@/lib/booking-notifications';
import { formatBookingJobStatusLabel, isBookedServiceStatus } from '@/lib/booking-status';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

type RouteParams = { id: string };

async function getIdFromParams(params: Promise<RouteParams> | RouteParams): Promise<string | null> {
    const resolved = await Promise.resolve(params);
    const id = resolved?.id?.trim();
    return id && id.length > 0 ? id : null;
}

export async function PATCH(request: Request, context: { params: Promise<RouteParams> }) {
    const auth = await requireAdminPermission(request, 'bookings:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);

    try {
        const id = await getIdFromParams(context.params);
        if (!id) {
            return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
        }

        const body = (await request.json()) as {
            status?: string;
            notifyProvider?: boolean;
            notifyCustomer?: boolean;
            /** When completing: deduct platform commission from provider credit. Default false (full service). */
            apply_commission?: boolean;
        };
        const nextStatus = (body.status ?? '').trim();
        if (!isBookedServiceStatus(nextStatus)) {
            return NextResponse.json({ error: 'Invalid job status' }, { status: 400 });
        }
        // Admin complete defaults to full service total; opt-in to deduct commission.
        const applyCommission = body.apply_commission === true;

        const { data: bookingRaw, error: bookingError } = await supabaseAdmin
            .from('booked_service')
            .select('id, status, serviceName, firstName, lastName, provider_id, customer_id')
            .eq('id', id)
            .maybeSingle();

        if (bookingError) {
            return NextResponse.json({ error: bookingError.message }, { status: 500 });
        }
        if (!bookingRaw) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        const booking = bookingRaw as {
            id: string;
            status?: string | null;
            serviceName?: string | null;
            firstName?: string | null;
            lastName?: string | null;
            provider_id?: string | null;
            customer_id?: string | null;
        };

        const previousStatus = booking.status ?? '';
        const statusUnchanged = previousStatus === nextStatus;

        let payout:
            | { skipped: true; reason: string }
            | { skipped: false; amount: number; walletAmount: number }
            | null = null;

        let clawback:
            | { skipped: true; reason: string }
            | { skipped: false; amount: number; walletAmount: number }
            | null = null;

        let customerRefund:
            | { skipped: true; reason: string }
            | { skipped: false; amount: number; walletAmount: number }
            | null = null;

        if (previousStatus === 'completed' && nextStatus !== 'completed') {
            const reverse = await clawbackProviderCompletionPayout(supabaseAdmin, id);
            if (!reverse.ok) {
                return NextResponse.json({ error: reverse.error }, { status: reverse.status });
            }
            clawback = reverse.skipped
                ? { skipped: true, reason: reverse.reason }
                : { skipped: false, amount: reverse.amount, walletAmount: reverse.walletAmount };
        }

        if (nextStatus === 'rejected' && !statusUnchanged) {
            const refund = await refundCustomerForRejectedBooking(supabaseAdmin, id);
            if (!refund.ok) {
                return NextResponse.json({ error: refund.error }, { status: refund.status });
            }
            customerRefund = refund.skipped
                ? { skipped: true, reason: refund.reason }
                : { skipped: false, amount: refund.amount, walletAmount: refund.walletAmount };
        }

        if (nextStatus === 'completed') {
            const credit = await creditProviderForCompletedBooking(supabaseAdmin, id, {
                applyCommission,
            });
            if (!credit.ok) {
                return NextResponse.json({ error: credit.error }, { status: credit.status });
            }
            // Unpaid: still allow job status change; wallet credit only when actually paid.
            if (credit.skipped && credit.reason === 'customer_refunded') {
                return NextResponse.json(
                    {
                        error:
                            'Cannot complete: customer was refunded for this booking. Re-collect payment in booking detail first.',
                    },
                    { status: 400 }
                );
            }
            payout = credit.skipped
                ? { skipped: true, reason: credit.reason }
                : { skipped: false, amount: credit.amount, walletAmount: credit.walletAmount };
        }

        if (!statusUnchanged) {
            const { error: updateError } = await supabaseAdmin
                .from('booked_service')
                .update({ status: nextStatus })
                .eq('id', id);

            if (updateError) {
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }
        }

        const customerName = [booking.firstName, booking.lastName].filter(Boolean).join(' ').trim() || 'Customer';
        const serviceName = (booking.serviceName ?? '').trim() || 'Service';

        if (!statusUnchanged) {
            await sendBookingStatusUpdatedNotifications(supabaseAdmin, {
                bookingId: id,
                providerId: booking.provider_id,
                customerId: booking.customer_id,
                serviceName,
                status: nextStatus,
                payoutAmount: payout && payout.skipped === false ? payout.amount : undefined,
                notifyProvider: body.notifyProvider,
                notifyCustomer: body.notifyCustomer,
            });

            await logAdminActivity({
                request,
                action: 'update',
                resource_type: 'booking',
                resource_id: id,
                summary: `Updated booking status for ${customerName} (${serviceName}) to ${formatBookingJobStatusLabel(nextStatus)}`,
                metadata: {
                    from_status: previousStatus || null,
                    to_status: nextStatus,
                    provider_payout: payout,
                    provider_clawback: clawback,
                    customer_refund: customerRefund,
                },
            });
        }

        return NextResponse.json({
            ok: true,
            status: nextStatus,
            unchanged: statusUnchanged,
            provider_payout: payout,
            provider_clawback: clawback,
            customer_refund: customerRefund,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: Promise<RouteParams> }) {
    const auth = await requireAdminPermission(request, 'bookings:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);

    try {
        const id = await getIdFromParams(context.params);
        if (!id) {
            return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
        }

        const { data: bookingRaw, error: bookingError } = await supabaseAdmin
            .from('booked_service')
            .select('id, serviceName, firstName, lastName, customer_id, provider_id')
            .eq('id', id)
            .maybeSingle();

        if (bookingError) {
            return NextResponse.json({ error: bookingError.message }, { status: 500 });
        }
        if (!bookingRaw) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        const booking = bookingRaw as {
            id: string;
            serviceName?: string | null;
            firstName?: string | null;
            lastName?: string | null;
        };

        const { error: notificationError } = await supabaseAdmin
            .from('notification')
            .delete()
            .eq('booking_id', id);

        if (notificationError) {
            return NextResponse.json({ error: notificationError.message }, { status: 500 });
        }

        const { error: paymentError } = await supabaseAdmin
            .from('payments')
            .delete()
            .eq('booking_id', id);

        if (paymentError) {
            return NextResponse.json({ error: paymentError.message }, { status: 500 });
        }

        const { error: deleteError } = await supabaseAdmin
            .from('booked_service')
            .delete()
            .eq('id', id);

        if (deleteError) {
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        const customerName = [booking.firstName, booking.lastName].filter(Boolean).join(' ').trim() || 'Customer';
        const serviceName = (booking.serviceName ?? '').trim() || 'Service';

        await logAdminActivity({
            request,
            action: 'delete',
            resource_type: 'booking',
            resource_id: id,
            summary: `Deleted booking for ${customerName} (${serviceName})`,
        });

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
