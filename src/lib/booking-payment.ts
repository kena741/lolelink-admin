import type { SupabaseClient } from '@supabase/supabase-js';
import {
    providerBookingNotificationExists,
    sendBookingPaymentConfirmedNotifications,
    sendProviderNewBookingNotification,
} from '@/lib/booking-notifications';
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

const PAID_AWAITING_PROVIDER_STATUS = 'paid_for_service_booked';
export const BOOKING_PAYMENT_STATUS_COMPLETED = 'payment_completed';

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
        (booking.payment_status ?? '') !== BOOKING_PAYMENT_STATUS_COMPLETED ||
        booking.paymentCompleted !== true ||
        (booking.status ?? '').trim() !== PAID_AWAITING_PROVIDER_STATUS;

    if (!needsUpdate && !extra) return;

    await supabaseAdmin
        .from('booked_service')
        .update({
            payment_status: BOOKING_PAYMENT_STATUS_COMPLETED,
            paymentCompleted: true,
            status: PAID_AWAITING_PROVIDER_STATUS,
            ...extra,
        })
        .eq('id', booking.id);
}

export async function markBookingPaymentCompleted(
    supabaseAdmin: SupabaseClient,
    bookingId: string,
    txRef: string,
    chapaReference?: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
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
    const storedRef = (booking.payment_id ?? '').trim();
    if (storedRef && storedRef !== txRef) {
        return { ok: false, error: 'Transaction reference does not match booking', status: 400 };
    }

    if (booking.paymentCompleted || (booking.payment_status ?? '') === BOOKING_PAYMENT_STATUS_COMPLETED) {
        await applyPaidBookingState(supabaseAdmin, booking);
        await notifyProviderAboutBooking(supabaseAdmin, booking);
        return { ok: true };
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
        .from('booked_service')
        .update({
            payment_status: BOOKING_PAYMENT_STATUS_COMPLETED,
            paymentCompleted: true,
            payment_id: txRef,
            paid_at: now,
            paymentType: 'chapa',
            status: PAID_AWAITING_PROVIDER_STATUS,
        })
        .eq('id', bookingId);

    if (updateError) {
        return { ok: false, error: updateError.message, status: 500 };
    }

    await upsertBookingPaymentRecord(supabaseAdmin, booking, {
        providerRef: chapaReference || txRef,
        paymentMethod: 'chapa',
        provider: 'chapa',
        status: 'payment_completed',
    });

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
        .from('booked_service')
        .select('id')
        .eq('payment_id', txRef)
        .maybeSingle();

    const id = (data as { id?: string } | null)?.id;
    return typeof id === 'string' && id.trim() ? id.trim() : null;
}
