import { NextResponse } from 'next/server';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { requireAdminPermission } from '@/lib/admin-auth';
import { sendBookingCreatedNotifications, sendBookingPaymentConfirmedNotifications } from '@/lib/booking-notifications';
import {
    buildBookingPayload,
    type BookingAddressInput,
    type BookingPaymentMode,
    type CouponInput,
} from '@/lib/booking-payload';
import {
    debitCustomerWalletForBooking,
    sendBookingProviderSms,
    upsertBookingPaymentRecord,
} from '@/lib/booking-payment-side-effects';
import { resolveServiceName } from '@/lib/booking-pricing';
import { BOOKING_PAYMENT_STATUS, BOOKING_STATUS } from '@/lib/booking-status';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface CreateBookingBody {
    provider_id?: string;
    service_id?: string;
    customer_id?: string;
    bookingDate?: string;
    quantity?: string;
    description?: string;
    payment_path?: 'pay_now' | 'pay_later' | 'wallet' | 'mark_paid';
    payment_mode?: BookingPaymentMode | 'pay_now';
    bookingAddress?: BookingAddressInput;
    coupon_id?: number;
    coupon_code?: string;
}

function readCustomerName(row: Record<string, unknown>): string {
    const first = typeof row.firstName === 'string' ? row.firstName : typeof row.first_name === 'string' ? row.first_name : '';
    const last = typeof row.lastName === 'string' ? row.lastName : typeof row.last_name === 'string' ? row.last_name : '';
    return [first, last].filter(Boolean).join(' ').trim() || 'Customer';
}

function resolvePaymentMode(body: CreateBookingBody): BookingPaymentMode {
    const mode = body.payment_mode ?? body.payment_path;
    if (mode === 'pay_now' || mode === 'chapa') return 'chapa';
    if (mode === 'wallet') return 'wallet';
    if (mode === 'mark_paid') return 'mark_paid';
    return 'pay_later';
}

export async function POST(request: Request) {
    const auth = await requireAdminPermission(request, 'bookings:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);

    try {
        const body = (await request.json()) as CreateBookingBody;
        const serviceId = (body.service_id ?? '').trim();
        const customerId = (body.customer_id ?? '').trim();
        const paymentMode = resolvePaymentMode(body);

        if (!serviceId) return NextResponse.json({ error: 'service_id is required' }, { status: 400 });
        if (!customerId) return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });

        let providerId = (body.provider_id ?? '').trim();
        if (!providerId) {
            const { data: serviceRow } = await supabaseAdmin
                .from('service')
                .select('provider_id')
                .eq('id', serviceId)
                .maybeSingle();
            providerId = typeof (serviceRow as { provider_id?: string } | null)?.provider_id === 'string'
                ? (serviceRow as { provider_id: string }).provider_id
                : '';
        }

        if (!providerId) {
            return NextResponse.json({ error: 'provider_id is required' }, { status: 400 });
        }

        const coupon: CouponInput | null =
            body.coupon_id || body.coupon_code
                ? { id: body.coupon_id, code: body.coupon_code }
                : null;

        const { row, totalAmountNumber } = await buildBookingPayload(supabaseAdmin, {
            customerId,
            serviceId,
            providerId,
            bookingDate: body.bookingDate?.trim() || new Date().toISOString(),
            description: body.description,
            quantity: body.quantity,
            bookingAddress: body.bookingAddress,
            coupon,
            paymentMode,
        });

        if (paymentMode === 'wallet') {
            const { data: walletCustomer } = await supabaseAdmin
                .from('customer')
                .select('wallet_amount')
                .eq('id', customerId)
                .maybeSingle();

            const walletAmount = Number((walletCustomer as { wallet_amount?: string | number } | null)?.wallet_amount ?? 0);
            if (!Number.isFinite(walletAmount) || walletAmount < totalAmountNumber) {
                return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 });
            }
        }

        const bookingId = String(row.id);
        const serviceName = resolveServiceName((row.serviceDetails ?? {}) as Record<string, unknown>) || 'Service';

        const { data: created, error: upsertError } = await supabaseAdmin
            .from('booked_service')
            .upsert(row, { onConflict: 'id' })
            .select('*')
            .single();

        if (upsertError) {
            return NextResponse.json({ error: upsertError.message || 'Failed to create booking' }, { status: 500 });
        }

        const customerName = readCustomerName(created as Record<string, unknown>);

        if (paymentMode === 'wallet') {
            const walletResult = await debitCustomerWalletForBooking(
                supabaseAdmin,
                bookingId,
                customerId,
                totalAmountNumber
            );
            if (!walletResult.ok) {
                await supabaseAdmin.from('booked_service').delete().eq('id', bookingId);
                return NextResponse.json({ error: walletResult.error }, { status: walletResult.status });
            }

            await upsertBookingPaymentRecord(
                supabaseAdmin,
                created as { id: string; customer_id?: string; totalAmount?: string; price?: string },
                {
                    paymentId: walletResult.paymentId,
                    providerRef: walletResult.paymentId,
                    paymentMethod: 'wallet',
                    provider: 'wallet',
                    status: BOOKING_PAYMENT_STATUS.COMPLETED,
                }
            );

            await sendBookingPaymentConfirmedNotifications(supabaseAdmin, {
                bookingId,
                providerId,
                customerId,
                serviceName,
                amount: totalAmountNumber,
            });
        }

        if (paymentMode === 'mark_paid') {
            const paymentId = String(row.payment_id ?? crypto.randomUUID());

            await supabaseAdmin
                .from('booked_service')
                .update({
                    payment_status: BOOKING_PAYMENT_STATUS.COMPLETED,
                    paymentCompleted: true,
                    status: BOOKING_STATUS.ADMIN_PAID,
                    payment_id: paymentId,
                })
                .eq('id', bookingId);

            await upsertBookingPaymentRecord(
                supabaseAdmin,
                created as { id: string; customer_id?: string; totalAmount?: string; price?: string },
                {
                    paymentId,
                    providerRef: paymentId,
                    paymentMethod: 'admin',
                    provider: 'admin',
                    status: BOOKING_PAYMENT_STATUS.COMPLETED,
                }
            );

            await sendBookingPaymentConfirmedNotifications(supabaseAdmin, {
                bookingId,
                providerId,
                customerId,
                serviceName,
                amount: totalAmountNumber,
            });
        }

        const notificationPaymentPath =
            paymentMode === 'pay_later' ? 'pay_later' : 'pay_now';
        const notifyProviderOnCreate = paymentMode !== 'chapa';

        await sendBookingCreatedNotifications(supabaseAdmin, {
            bookingId,
            providerId,
            customerId,
            serviceName,
            customerName,
            paymentPath: notificationPaymentPath,
            notifyProvider: notifyProviderOnCreate,
        });

        if (notifyProviderOnCreate) {
            await sendBookingProviderSms(supabaseAdmin, {
                providerId,
                serviceName,
                customerName,
            });
        }

        await logAdminActivity({
            request,
            action: 'create',
            resource_type: 'booking',
            resource_id: bookingId,
            summary: `Created booking for ${customerName} (${paymentMode})`,
            metadata: {
                provider_id: providerId,
                service_id: serviceId,
                customer_id: customerId,
                payment_mode: paymentMode,
                total_amount: totalAmountNumber,
            },
        });

        return NextResponse.json({ data: created });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
