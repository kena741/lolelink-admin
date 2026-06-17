import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { isChapaSuccessStatus, loadChapaSecretKey } from '@/lib/chapa-config';
import { markBookingPaymentCompleted } from '@/lib/booking-payment';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface VerifyBody {
    bookingId?: string;
}

interface BookingRow {
    id: string;
    payment_id?: string | null;
    paymentCompleted?: boolean | null;
    payment_status?: string | null;
    totalAmount?: number | null;
    price?: number | null;
}

export async function POST(request: Request) {
    const auth = await requireAdminPermission(request, 'bookings:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);

    try {
        const body = (await request.json()) as VerifyBody;
        const bookingId = (body.bookingId ?? '').trim();
        if (!bookingId) {
            return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
        }

        const { data: bookingRaw, error: bookingError } = await supabaseAdmin
            .from('booked_service')
            .select('*')
            .eq('id', bookingId)
            .maybeSingle();

        if (bookingError) {
            return NextResponse.json({ error: bookingError.message }, { status: 500 });
        }
        if (!bookingRaw) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        const booking = bookingRaw as BookingRow;
        const txRef = (booking.payment_id ?? '').trim();

        if (!txRef) {
            return NextResponse.json({ error: 'No payment has been initiated for this booking' }, { status: 400 });
        }

        if (booking.paymentCompleted || (booking.payment_status ?? '') === 'payment_completed') {
            return NextResponse.json({
                status: 'success',
                already_paid: true,
                booking_id: bookingId,
            });
        }

        const chapaSecretKey = await loadChapaSecretKey(supabaseAdmin);
        if (!chapaSecretKey) {
            return NextResponse.json({ error: 'Missing Chapa secret key' }, { status: 500 });
        }

        const verifyResponse = await fetch(`https://api.chapa.co/v1/transaction/verify/${txRef}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${chapaSecretKey}` },
        });

        const verifyData = (await verifyResponse.json()) as {
            status?: string;
            message?: string;
            data?: {
                status?: string;
                reference?: string;
                amount?: number;
            };
        };

        if (!verifyResponse.ok) {
            return NextResponse.json({
                error: verifyData.message || 'Failed to verify with Chapa',
                details: verifyData,
            }, { status: 400 });
        }

        const txStatus = (verifyData.data?.status ?? '').toLowerCase();
        if (!isChapaSuccessStatus(txStatus)) {
            return NextResponse.json({
                status: 'pending',
                chapa_status: txStatus || 'unknown',
                message: `Payment not yet confirmed. Chapa status: ${txStatus || 'unknown'}`,
                booking_id: bookingId,
            });
        }

        const result = await markBookingPaymentCompleted(supabaseAdmin, bookingId, txRef);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        const amount = Number(booking.totalAmount ?? booking.price ?? verifyData.data?.amount ?? 0);

        return NextResponse.json({
            status: 'success',
            booking_id: bookingId,
            tx_ref: txRef,
            amount,
            chapa_reference: verifyData.data?.reference,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected verify error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
