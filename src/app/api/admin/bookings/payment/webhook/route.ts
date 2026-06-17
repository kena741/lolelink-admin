import { NextResponse } from 'next/server';
import { isChapaSuccessStatus } from '@/lib/chapa-config';
import { markBookingPaymentCompleted, resolveBookingIdByTxRef } from '@/lib/booking-payment';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface ChapaWebhookPayload {
    event?: string;
    tx_ref?: string;
    status?: string;
    reference?: string;
}

export async function POST(request: Request) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);

    try {
        const body = (await request.json()) as ChapaWebhookPayload;
        const txRef = (body.tx_ref ?? '').trim();

        if (!txRef.startsWith('bkg-')) {
            return NextResponse.json({ status: 'ignored', reason: 'Not a booking transaction' });
        }

        if (!isChapaSuccessStatus(body.status)) {
            return NextResponse.json({ status: 'ignored', reason: `Non-success status: ${body.status}` });
        }

        const bookingId = await resolveBookingIdByTxRef(supabaseAdmin, txRef);
        if (!bookingId) {
            return NextResponse.json({ status: 'error', reason: 'Booking not found for tx_ref' }, { status: 404 });
        }

        const result = await markBookingPaymentCompleted(supabaseAdmin, bookingId, txRef);
        if (!result.ok) {
            return NextResponse.json({ status: 'error', reason: result.error }, { status: result.status });
        }

        return NextResponse.json({ status: 'success', booking_id: bookingId });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Webhook processing error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
