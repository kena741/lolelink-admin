import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import {
    loadChapaSecretKey,
    normalizeBoolean,
    resolveChapaConfig,
} from '@/lib/chapa-config';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { BOOKING_PAYMENT_STATUS } from '@/lib/booking-status';
import { upsertBookingPaymentRecord } from '@/lib/booking-payment-side-effects';

export const runtime = 'nodejs';

interface InitPaymentBody {
    bookingId?: string;
}

interface BookingRow {
    id: string;
    totalAmount?: number | null;
    price?: number | null;
    payment_status?: string | null;
    paymentCompleted?: boolean | null;
    payment_id?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    serviceName?: string | null;
}

interface AppSettingsRow {
    data: unknown;
}

function bookingAmount(booking: BookingRow): number {
    const total = Number(booking.totalAmount ?? 0);
    if (Number.isFinite(total) && total > 0) return total;
    const price = Number(booking.price ?? 0);
    return Number.isFinite(price) && price > 0 ? price : 0;
}

export async function POST(request: Request) {
    const auth = await requireAdminPermission(request, 'bookings:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);

    try {
        const body = (await request.json()) as InitPaymentBody;
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
        const currentPaymentStatus = (booking.payment_status ?? '').toLowerCase();
        if (booking.paymentCompleted || currentPaymentStatus === 'payment_completed') {
            return NextResponse.json({ error: 'Booking is already paid' }, { status: 409 });
        }

        const amount = bookingAmount(booking);
        if (amount <= 0) {
            return NextResponse.json({ error: 'Booking amount is invalid' }, { status: 400 });
        }

        const { data: paymentRow } = await supabaseAdmin
            .from('app_settings')
            .select('id, data')
            .eq('id', 'payment')
            .maybeSingle();

        const chapaConfig = resolveChapaConfig((paymentRow as AppSettingsRow | null)?.data);
        const isChapaEnabled = normalizeBoolean(chapaConfig.enable) && normalizeBoolean(chapaConfig.isActive ?? true);
        if (!isChapaEnabled) {
            return NextResponse.json({ error: 'Chapa is disabled in app settings' }, { status: 400 });
        }

        const chapaSecretKey = await loadChapaSecretKey(supabaseAdmin);
        if (!chapaSecretKey) {
            return NextResponse.json({ error: 'Missing Chapa secret key' }, { status: 500 });
        }

        const origin = new URL(request.url).origin;
        const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || origin).trim();
        const paymentId = crypto.randomUUID();
        const txRef = `bkg-${booking.id.replace(/-/g, '').slice(0, 12)}-${Date.now()}`.slice(0, 50);
        const customerEmail = (booking.email ?? '').trim() || 'customer@platform.com';
        const firstName = (booking.firstName ?? '').trim() || 'Customer';
        const lastName = (booking.lastName ?? '').trim() || '';
        const serviceName = (booking.serviceName ?? '').trim() || 'Service booking';

        const chapaPayload = {
            amount: amount.toString(),
            currency: 'ETB',
            email: customerEmail,
            first_name: firstName,
            last_name: lastName,
            tx_ref: txRef,
            callback_url: `${appBaseUrl}/api/admin/bookings/payment/webhook`,
            return_url: `${appBaseUrl}/admin/bookings`,
            'customization[title]': 'Service Booking Payment',
            'customization[description]': `Payment for ${serviceName}`,
        };

        const chapaResponse = await fetch('https://api.chapa.co/v1/transaction/initialize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${chapaSecretKey}`,
            },
            body: JSON.stringify(chapaPayload),
        });

        const chapaData = (await chapaResponse.json()) as {
            status?: string;
            message?: string;
            data?: { checkout_url?: string };
        };

        if (!chapaResponse.ok || chapaData.status !== 'success') {
            return NextResponse.json(
                { error: chapaData.message || 'Failed to initialize Chapa checkout', details: chapaData },
                { status: 400 }
            );
        }

        await supabaseAdmin
            .from('booked_service')
            .update({
                payment_id: paymentId,
                paymentType: 'chapa',
            })
            .eq('id', bookingId);

        await upsertBookingPaymentRecord(
            supabaseAdmin,
            booking as { id: string; customer_id?: string; totalAmount?: number; price?: number },
            {
                paymentId,
                providerRef: txRef,
                paymentMethod: 'chapa',
                provider: 'chapa',
                status: BOOKING_PAYMENT_STATUS.PENDING,
            }
        );

        const customerName = [booking.firstName, booking.lastName].filter(Boolean).join(' ').trim() || 'Customer';
        await logAdminActivity({
            request,
            action: 'transfer',
            resource_type: 'booking',
            resource_id: bookingId,
            summary: `Initiated Chapa payment for ${customerName} (${amount.toFixed(2)} ETB)`,
            metadata: { tx_ref: txRef, amount },
        });

        return NextResponse.json({
            status: 'success',
            checkout_url: chapaData.data?.checkout_url,
            tx_ref: txRef,
            booking_id: bookingId,
            amount,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
