import type { SupabaseClient } from '@supabase/supabase-js';
import {
    providerBookingNotificationExists,
    sendBookingPaymentConfirmedNotifications,
    sendProviderNewBookingNotification,
} from '@/lib/booking-notifications';
import { BOOKING_PAYMENT_STATUS } from '@/lib/booking-status';
import {
    bookingTotalAmount,
    sendBookingProviderSms,
    upsertBookingPaymentRecord,
} from '@/lib/booking-payment-side-effects';

interface BookingRow {
    id: string;
    provider_id: string;
    customer_id?: string | null;
    serviceName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    totalAmount?: string | number | null;
    price?: string | number | null;
    payment_status?: string | null;
    paymentCompleted?: boolean | null;
    payment_id?: string | null;
    status?: string | null;
    paymentType?: string | null;
}

function readCustomerName(booking: BookingRow): string {
    const first = (booking.firstName ?? '').trim();
    const last = (booking.lastName ?? '').trim();
    return [first, last].filter(Boolean).join(' ').trim() || 'Customer';
}

async function notifyProviderAboutBooking(
    supabaseAdmin: SupabaseClient,
    booking: BookingRow
): Promise<void> {
    if (!booking.customer_id || !booking.provider_id) return;

    const alreadyNotified = await providerBookingNotificationExists(
        supabaseAdmin,
        booking.id,
        booking.provider_id
    );
    if (alreadyNotified) return;

    const customerName = readCustomerName(booking);
    const serviceName = (booking.serviceName ?? '').trim() || 'Service';

    await sendProviderNewBookingNotification(supabaseAdmin, {
        bookingId: booking.id,
        providerId: booking.provider_id,
        serviceName,
        customerName,
    });

    await sendBookingProviderSms(supabaseAdmin, {
        providerId: booking.provider_id,
        serviceName,
        customerName,
    });
}

async function applyPaidBookingState(
    supabaseAdmin: SupabaseClient,
    booking: BookingRow,
    extra?: Record<string, unknown>
): Promise<void> {
    const needsUpdate =
        (booking.payment_status ?? '') !== BOOKING_PAYMENT_STATUS.COMPLETED ||
        booking.paymentCompleted !== true;

    if (!needsUpdate && !extra) return;

    await supabaseAdmin
        .from('booked_service')
        .update({
            payment_status: BOOKING_PAYMENT_STATUS.COMPLETED,
            paymentCompleted: true,
            ...extra,
        })
        .eq('id', booking.id);
}

export async function markBookingPaymentCompleted(
    supabaseAdmin: SupabaseClient,
    bookingId: string,
    txRef: string,
    _chapaReference?: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
    void _chapaReference;
    const { data: bookingRaw, error: bookingError } = await supabaseAdmin
        .from('booked_service')
        .select('*')
        .eq('id', bookingId)
        .maybeSingle();

    if (bookingError) {
        return { ok: false, error: bookingError.message, status: 500 };
    }
    if (!bookingRaw) {
        return { ok: false, error: 'Booking not found', status: 404 };
    }

    const booking = bookingRaw as BookingRow;

    const { data: paymentRow } = await supabaseAdmin
        .from('payments')
        .select('provider_ref')
        .eq('booking_id', bookingId)
        .maybeSingle();

    const storedRef = ((paymentRow as { provider_ref?: string } | null)?.provider_ref ?? '').trim();
    if (storedRef && storedRef !== txRef) {
        return { ok: false, error: 'Transaction reference does not match booking', status: 400 };
    }

    if (booking.paymentCompleted || (booking.payment_status ?? '') === BOOKING_PAYMENT_STATUS.COMPLETED) {
        await applyPaidBookingState(supabaseAdmin, booking);
        await notifyProviderAboutBooking(supabaseAdmin, booking);
        return { ok: true };
    }

    const paymentId = (booking.payment_id ?? '').trim() || crypto.randomUUID();

    try {
        const attachedPaymentId = await upsertBookingPaymentRecord(supabaseAdmin, booking, {
            paymentId,
            providerRef: txRef,
            paymentMethod: 'chapa',
            provider: 'chapa',
            status: BOOKING_PAYMENT_STATUS.COMPLETED,
        });

        const { error: updateError } = await supabaseAdmin
            .from('booked_service')
            .update({
                payment_status: BOOKING_PAYMENT_STATUS.COMPLETED,
                paymentCompleted: true,
                payment_id: attachedPaymentId,
                paymentType: 'chapa',
            })
            .eq('id', bookingId);

        if (updateError) {
            return { ok: false, error: updateError.message, status: 500 };
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to record booking payment';
        return { ok: false, error: message, status: 500 };
    }

    if (booking.customer_id && booking.provider_id) {
        await sendBookingPaymentConfirmedNotifications(supabaseAdmin, {
            bookingId,
            providerId: booking.provider_id,
            customerId: booking.customer_id,
            serviceName: (booking.serviceName ?? '').trim() || 'Service',
            amount: bookingTotalAmount(booking),
        });

        await notifyProviderAboutBooking(supabaseAdmin, booking);
    }

    return { ok: true };
}

export async function resolveBookingIdByTxRef(
    supabaseAdmin: SupabaseClient,
    txRef: string
): Promise<string | null> {
    const { data } = await supabaseAdmin
        .from('payments')
        .select('booking_id')
        .eq('provider_ref', txRef)
        .maybeSingle();

    const id = (data as { booking_id?: string } | null)?.booking_id;
    return typeof id === 'string' && id.trim() ? id.trim() : null;
}
