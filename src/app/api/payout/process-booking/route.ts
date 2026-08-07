import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { isBookingActuallyPaid, isPaymentRecordSettled } from '@/lib/booking-status';
import { resolveProviderAuthUserId } from '@/lib/wallet-transaction-user';
import { walletTransactionProfileColumns } from '@/lib/wallet-transaction-profile';

export const runtime = 'nodejs';

interface RequestBody {
    bookingId?: string;
}

interface BookingPaymentRow {
    id: string;
    provider_id?: string | null;
    totalAmount?: string | number | null;
    price?: string | number | null;
    paymentCompleted?: boolean | null;
    payment_status?: string | null;
    status?: string | null;
}

export async function POST(request: Request) {
    const auth = await requireAdminPermission(request, 'finance:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);

    try {
        const body = (await request.json()) as RequestBody;
        const bookingId = (body.bookingId || '').trim();
        if (!bookingId) {
            return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
        }

        const { data: bookingData, error: bookingError } = await supabaseAdmin
            .from('booked_service')
            .select('id, provider_id, totalAmount, price, paymentCompleted, payment_status, status')
            .eq('id', bookingId)
            .single();

        if (bookingError) {
            return NextResponse.json({ error: bookingError.message }, { status: 500 });
        }

        const booking = bookingData as BookingPaymentRow;
        const normalizedBookingStatus = (booking.status ?? '').toString().trim().toLowerCase();
        const isCompleted =
            normalizedBookingStatus === 'completed' ||
            normalizedBookingStatus === 'service_completion_approved_by_customer';
        if (!isCompleted) {
            return NextResponse.json({ error: 'Booking is not completed yet' }, { status: 400 });
        }

        // Actual customer/admin payment only — never treat job status as paid.
        let paid = isBookingActuallyPaid(booking.payment_status, booking.paymentCompleted);
        if (!paid) {
            const { data: payRow } = await supabaseAdmin
                .from('payments')
                .select('status')
                .eq('booking_id', bookingId)
                .maybeSingle();
            paid = isPaymentRecordSettled((payRow as { status?: string } | null)?.status);
        }
        if (!paid) {
            return NextResponse.json(
                {
                    error: 'Customer/admin payment is not completed yet — provider payout requires payment',
                },
                { status: 400 }
            );
        }

        if (!booking.provider_id) {
            return NextResponse.json({ error: 'Provider is missing for this booking' }, { status: 400 });
        }

        const authUser = await resolveProviderAuthUserId(supabaseAdmin, booking.provider_id);
        if (!authUser.ok) {
            return NextResponse.json({ error: authUser.error }, { status: 400 });
        }

        const transactionId = `provider-payout:${bookingId}`;
        const { data: existing, error: existingError } = await supabaseAdmin
            .from('wallet_transaction')
            .select('id')
            .eq('transactionId', transactionId)
            .eq('type', 'provider_payout')
            .maybeSingle();

        if (existingError) {
            return NextResponse.json({ error: existingError.message }, { status: 500 });
        }

        if (existing?.id) {
            await logAdminActivity({
                request,
                action: 'transfer',
                resource_type: 'booking',
                resource_id: bookingId,
                summary: `Booking payout already processed for ${bookingId}`,
            });
            return NextResponse.json({ bookingId, processed: true, alreadyProcessed: true });
        }

        const payoutAmount = Number(booking.totalAmount ?? booking.price ?? 0);
        if (payoutAmount <= 0) {
            return NextResponse.json({ error: 'Invalid payout amount' }, { status: 400 });
        }

        const { error: insertError } = await supabaseAdmin.from('wallet_transaction').insert({
            amount: payoutAmount.toFixed(2),
            createdDate: new Date().toISOString(),
            isCredit: true,
            note: `Payout for booking ${bookingId}`,
            paymentType: 'wallet_topup',
            transactionId,
            type: 'provider_payout',
            ...walletTransactionProfileColumns({
                type: 'provider_payout',
                authUserId: authUser.authUserId,
                providerId: booking.provider_id,
            }),
        });

        if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        await logAdminActivity({
            request,
            action: 'transfer',
            resource_type: 'booking',
            resource_id: bookingId,
            summary: `Processed provider payout for booking ${bookingId}`,
            metadata: { amount: payoutAmount, provider_id: booking.provider_id },
        });

        return NextResponse.json({ bookingId, processed: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to process booking payout';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
