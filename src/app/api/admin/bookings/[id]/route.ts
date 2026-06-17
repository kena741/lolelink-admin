import { NextResponse } from 'next/server';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { requireAdminPermission } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

type RouteParams = { id: string };

async function getIdFromParams(params: Promise<RouteParams> | RouteParams): Promise<string | null> {
    const resolved = await Promise.resolve(params);
    const id = resolved?.id?.trim();
    return id && id.length > 0 ? id : null;
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
