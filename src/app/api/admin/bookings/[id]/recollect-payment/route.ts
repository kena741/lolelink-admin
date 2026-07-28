import { NextResponse } from 'next/server';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { requireAdminPermission } from '@/lib/admin-auth';
import { recollectBookingPayment } from '@/lib/booking-payment-side-effects';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

type RouteParams = { id: string };

async function getIdFromParams(params: Promise<RouteParams> | RouteParams): Promise<string | null> {
    const resolved = await Promise.resolve(params);
    const id = resolved?.id?.trim();
    return id && id.length > 0 ? id : null;
}

export async function POST(request: Request, context: { params: Promise<RouteParams> }) {
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

        const body = (await request.json().catch(() => ({}))) as { mode?: string };
        const mode = body.mode === 'mark_paid' ? 'mark_paid' : 'wallet';

        const result = await recollectBookingPayment(supabaseAdmin, id, mode);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        await logAdminActivity({
            request,
            action: 'update',
            resource_type: 'booking',
            resource_id: id,
            summary: `Re-collected booking payment (${result.mode}) ETB ${result.amount.toFixed(2)}`,
            metadata: {
                recollect_mode: result.mode,
                amount: result.amount,
            },
        });

        return NextResponse.json({
            ok: true,
            mode: result.mode,
            amount: result.amount,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
