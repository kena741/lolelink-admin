import type { SupabaseClient } from '@supabase/supabase-js';
import { sendBookingPaymentConfirmedNotifications } from '@/lib/booking-notifications';

interface BookingRow {
    id: string;
    provider_id: string;
    customer_id?: string | null;
    serviceName?: string | null;
    totalAmount?: number | null;
    price?: number | null;
    payment_status?: string | null;
    paymentCompleted?: boolean | null;
    payment_id?: string | null;
}

function bookingAmount(booking: BookingRow): number {
    const total = Number(booking.totalAmount ?? 0);
    if (Number.isFinite(total) && total > 0) return total;
    const price = Number(booking.price ?? 0);
    return Number.isFinite(price) && price > 0 ? price : 0;
}

export async function markBookingPaymentCompleted(
    supabaseAdmin: SupabaseClient,
    bookingId: string,
    txRef: string
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

    if (booking.paymentCompleted || (booking.payment_status ?? '') === 'payment_completed') {
        return { ok: true };
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
        .from('booked_service')
        .update({
            payment_status: 'payment_completed',
            paymentCompleted: true,
            payment_id: txRef,
            paid_at: now,
            paymentType: 'chapa',
        })
        .eq('id', bookingId);

    if (updateError) {
        return { ok: false, error: updateError.message, status: 500 };
    }

    if (booking.customer_id && booking.provider_id) {
        await sendBookingPaymentConfirmedNotifications(supabaseAdmin, {
            bookingId,
            providerId: booking.provider_id,
            customerId: booking.customer_id,
            serviceName: (booking.serviceName ?? '').trim() || 'Service',
            amount: bookingAmount(booking),
        });
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
