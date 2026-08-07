import type { SupabaseClient } from '@supabase/supabase-js';
import {
    ensureAdminBookerWalletFloor,
    isAdminBookerBooking,
} from '@/lib/admin-booker-customer';
import { BOOKING_PAYMENT_STATUS } from '@/lib/booking-status';
import {
    customerBookingFundsHeld,
    netCustomerBookingHeldAmount,
} from '@/lib/booking-display';
import { maybeCreditProviderAfterPaymentSettled } from '@/lib/booking-completion-payout';
import { resolveCustomerAuthUserId } from '@/lib/wallet-transaction-user';
import { walletTransactionProfileColumns } from '@/lib/wallet-transaction-profile';

const SMS_UPSTREAM = 'https://betegna-ai.vercel.app/sms/send';

interface BookingRow {
    id: string;
    customer_id?: string | null;
    provider_id?: string | null;
    totalAmount?: string | number | null;
    price?: string | number | null;
    serviceName?: string | null;
}

function parseAmount(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function bookingTotalAmount(booking: BookingRow): number {
    const total = parseAmount(booking.totalAmount);
    if (total > 0) return total;
    return parseAmount(booking.price);
}

export async function resolveChapaTxRefForBooking(
    admin: SupabaseClient,
    bookingId: string
): Promise<string | null> {
    const { data } = await admin
        .from('payments')
        .select('provider_ref')
        .eq('booking_id', bookingId)
        .maybeSingle();

    const ref = (data as { provider_ref?: string } | null)?.provider_ref;
    return typeof ref === 'string' && ref.trim() ? ref.trim() : null;
}

export async function upsertBookingPaymentRecord(
    admin: SupabaseClient,
    booking: BookingRow,
    params: {
        paymentId?: string;
        providerRef: string;
        paymentMethod?: string;
        provider?: string;
        status?: string;
    }
): Promise<string> {
    if (!booking.customer_id) {
        throw new Error('Booking customer_id is required to create a payment record');
    }

    const now = new Date().toISOString();
    const amount = bookingTotalAmount(booking);

    const { data: existing, error: existingError } = await admin
        .from('payments')
        .select('id')
        .eq('booking_id', booking.id)
        .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    const existingId =
        existing && (existing as { id?: string }).id ? (existing as { id: string }).id : null;
    const paymentId = existingId ?? params.paymentId ?? crypto.randomUUID();

    const payload = {
        booking_id: booking.id,
        customer_id: booking.customer_id,
        amount,
        currency: 'ETB',
        status: params.status ?? BOOKING_PAYMENT_STATUS.COMPLETED,
        payment_method: params.paymentMethod ?? 'chapa',
        provider: params.provider ?? 'chapa',
        provider_ref: params.providerRef,
        updated_at: now,
        ...(existingId ? {} : { created_at: now }),
    };

    if (existingId) {
        const { error: updateError } = await admin.from('payments').update(payload).eq('id', existingId);
        if (updateError) throw new Error(updateError.message);
        return existingId;
    }

    const { error: insertError } = await admin.from('payments').insert({
        id: paymentId,
        ...payload,
    });
    if (insertError) throw new Error(insertError.message);

    return paymentId;
}

export async function debitCustomerWalletForBooking(
    admin: SupabaseClient,
    bookingId: string,
    customerId: string,
    amount: number,
    options?: { note?: string; transactionId?: string }
): Promise<{ ok: true; paymentId: string } | { ok: false; error: string; status: number }> {
    const authUser = await resolveCustomerAuthUserId(admin, customerId);
    if (!authUser.ok) {
        return { ok: false, error: authUser.error, status: authUser.status };
    }

    const { data: customerRaw, error: customerError } = await admin
        .from('customer')
        .select('id, wallet_amount')
        .eq('id', customerId)
        .maybeSingle();

    if (customerError) {
        return { ok: false, error: customerError.message, status: 500 };
    }
    if (!customerRaw) {
        return { ok: false, error: 'Customer not found', status: 404 };
    }

    const walletAmount = parseAmount((customerRaw as { wallet_amount?: string | number }).wallet_amount);
    if (walletAmount < amount) {
        return { ok: false, error: 'Insufficient wallet balance', status: 400 };
    }

    const now = new Date().toISOString();
    const txRef = options?.transactionId?.trim() || `wallet-bkg-${bookingId.slice(0, 8)}-${Date.now()}`;
    const paymentId = crypto.randomUUID();

    const { error: walletTxError } = await admin.from('wallet_transaction').insert({
        amount: amount.toFixed(2),
        createdDate: now,
        isCredit: false,
        note: options?.note?.trim() || `Booking payment ${bookingId}`,
        paymentType: 'wallet',
        transactionId: txRef,
        type: 'customer',
        ...walletTransactionProfileColumns({
            type: 'customer',
            authUserId: authUser.authUserId,
            customerId,
        }),
    });

    if (walletTxError) {
        return { ok: false, error: walletTxError.message, status: 500 };
    }

    const { error: updateError } = await admin
        .from('customer')
        .update({ wallet_amount: (walletAmount - amount).toFixed(2) })
        .eq('id', customerId);

    if (updateError) {
        return { ok: false, error: updateError.message, status: 500 };
    }

    const { error: bookingUpdateError } = await admin
        .from('booked_service')
        .update({
            payment_status: BOOKING_PAYMENT_STATUS.COMPLETED,
            paymentCompleted: true,
            paymentType: 'wallet',
        })
        .eq('id', bookingId);

    if (bookingUpdateError) {
        return { ok: false, error: bookingUpdateError.message, status: 500 };
    }

    return { ok: true, paymentId };
}

export async function recollectBookingPayment(
    admin: SupabaseClient,
    bookingId: string,
    mode: 'wallet' | 'mark_paid'
): Promise<
    | { ok: true; mode: 'wallet' | 'mark_paid'; amount: number }
    | { ok: false; error: string; status: number }
> {
    const id = bookingId.trim();
    if (!id) return { ok: false, error: 'bookingId is required', status: 400 };

    const { data: bookingRaw, error: bookingError } = await admin
        .from('booked_service')
        .select(
            'id, customer_id, totalAmount, price, paymentType, payment_status, paymentCompleted, email, firstName, lastName, phoneNumber'
        )
        .eq('id', id)
        .maybeSingle();

    if (bookingError) return { ok: false, error: bookingError.message, status: 500 };
    if (!bookingRaw) return { ok: false, error: 'Booking not found', status: 404 };

    const booking = bookingRaw as BookingRow & {
        paymentType?: string | null;
        payment_status?: string | null;
        paymentCompleted?: boolean | null;
        email?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        phoneNumber?: string | null;
    };
    const customerId = (booking.customer_id ?? '').trim();
    if (!customerId) return { ok: false, error: 'Booking has no customer', status: 400 };

    const amount = bookingTotalAmount(booking);
    if (!(amount > 0)) return { ok: false, error: 'Booking amount must be positive', status: 400 };

    const alreadyPaid =
        booking.paymentCompleted === true ||
        (booking.payment_status ?? '').toLowerCase() === BOOKING_PAYMENT_STATUS.COMPLETED;
    if (alreadyPaid && mode === 'mark_paid') {
        return { ok: false, error: 'Booking is already paid', status: 409 };
    }

    const adminBooked = isAdminBookerBooking(booking);

    // Zemen Admin bookings always debit the float wallet (never ghost payment_id / fake admin pay).
    const useWallet = mode === 'wallet' || adminBooked;

    if (useWallet) {
        if (adminBooked) {
            await ensureAdminBookerWalletFloor(admin, customerId);
        }

        const debit = await debitCustomerWalletForBooking(admin, id, customerId, amount, {
            note: adminBooked ? `Admin float re-collect ${id}` : `Booking re-collection ${id}`,
            transactionId: id,
        });
        if (!debit.ok) return debit;

        const attachedPaymentId = await upsertBookingPaymentRecord(admin, booking, {
            paymentId: debit.paymentId,
            providerRef: debit.paymentId,
            paymentMethod: 'wallet',
            provider: 'wallet',
            status: BOOKING_PAYMENT_STATUS.COMPLETED,
        });

        const { error: linkError } = await admin
            .from('booked_service')
            .update({ payment_id: attachedPaymentId })
            .eq('id', id);
        if (linkError) return { ok: false, error: linkError.message, status: 500 };

        await maybeCreditProviderAfterPaymentSettled(admin, id);

        return { ok: true, mode: 'wallet', amount };
    }

    // Non–admin-booker mark paid — payments row first, then link (FK-safe).
    const paymentId = crypto.randomUUID();
    const attachedPaymentId = await upsertBookingPaymentRecord(admin, booking, {
        paymentId,
        providerRef: paymentId,
        paymentMethod: 'admin',
        provider: 'admin',
        status: BOOKING_PAYMENT_STATUS.COMPLETED,
    });

    const { error: bookingUpdateError } = await admin
        .from('booked_service')
        .update({
            payment_status: BOOKING_PAYMENT_STATUS.COMPLETED,
            paymentCompleted: true,
            paymentType: 'admin',
            payment_id: attachedPaymentId,
        })
        .eq('id', id);

    if (bookingUpdateError) return { ok: false, error: bookingUpdateError.message, status: 500 };

    await maybeCreditProviderAfterPaymentSettled(admin, id);

    return { ok: true, mode: 'mark_paid', amount };
}

export function rejectRefundNote(bookingId: string): string {
    return `Order #${bookingId.slice(0, 6)} reject refund`;
}

/**
 * Credits customer wallet for held booking payment when admin rejects.
 * Idempotent when no net held amount remains.
 */
export async function refundCustomerForRejectedBooking(
    admin: SupabaseClient,
    bookingId: string
): Promise<
    | { ok: true; skipped: true; reason: 'nothing_to_refund' | 'no_customer' }
    | { ok: true; skipped: false; amount: number; walletAmount: number }
    | { ok: false; error: string; status: number }
> {
    const id = bookingId.trim();
    if (!id) return { ok: false, error: 'bookingId is required', status: 400 };

    const { data: bookingRaw, error: bookingError } = await admin
        .from('booked_service')
        .select('id, customer_id, totalAmount, price, paymentType')
        .eq('id', id)
        .maybeSingle();

    if (bookingError) return { ok: false, error: bookingError.message, status: 500 };
    if (!bookingRaw) return { ok: false, error: 'Booking not found', status: 404 };

    const booking = bookingRaw as BookingRow & { paymentType?: string | null };
    const customerId = (booking.customer_id ?? '').trim();
    if (!customerId) return { ok: true, skipped: true, reason: 'no_customer' };

    const authUser = await resolveCustomerAuthUserId(admin, customerId);
    if (!authUser.ok) {
        return { ok: false, error: authUser.error, status: authUser.status };
    }

    const { data: txs, error: txError } = await admin
        .from('wallet_transaction')
        .select('isCredit, note, transactionId, createdDate, amount')
        .eq('userId', authUser.authUserId);

    if (txError) return { ok: false, error: txError.message, status: 500 };

    const rows = (txs ?? []) as Array<{
        isCredit?: boolean | null;
        note?: string | null;
        transactionId?: string | null;
        createdDate?: string | null;
        amount?: string | number | null;
    }>;

    const refundAmount = netCustomerBookingHeldAmount(id, rows);
    if (!(refundAmount > 0) || !customerBookingFundsHeld(id, rows)) {
        return { ok: true, skipped: true, reason: 'nothing_to_refund' };
    }

    const { data: customerRaw, error: customerError } = await admin
        .from('customer')
        .select('id, wallet_amount')
        .eq('id', customerId)
        .maybeSingle();

    if (customerError) return { ok: false, error: customerError.message, status: 500 };
    if (!customerRaw) return { ok: false, error: 'Customer not found', status: 404 };

    const currentWallet = parseAmount((customerRaw as { wallet_amount?: string | number }).wallet_amount);
    const nextWallet = Math.round((currentWallet + refundAmount) * 100) / 100;
    const now = new Date().toISOString();
    const paymentType = (booking.paymentType ?? 'wallet').toString();

    const { error: insertError } = await admin.from('wallet_transaction').insert({
        amount: refundAmount.toFixed(2),
        createdDate: now,
        isCredit: true,
        note: rejectRefundNote(id),
        paymentType,
        transactionId: id,
        type: 'customer',
        ...walletTransactionProfileColumns({
            type: 'customer',
            authUserId: authUser.authUserId,
            customerId,
        }),
    });

    if (insertError) return { ok: false, error: insertError.message, status: 500 };

    const { error: walletUpdateError } = await admin
        .from('customer')
        .update({ wallet_amount: nextWallet.toFixed(2) })
        .eq('id', customerId);

    if (walletUpdateError) return { ok: false, error: walletUpdateError.message, status: 500 };

    return { ok: true, skipped: false, amount: refundAmount, walletAmount: nextWallet };
}

interface ProviderRow {
    id: string;
    phone?: string | null;
    phoneNumber?: string | null;
    countryCode?: string | null;
    country_code?: string | null;
    firstName?: string | null;
    last_name?: string | null;
}

function providerPhone(provider: ProviderRow): string {
    return (provider.phoneNumber ?? provider.phone ?? '').trim();
}

function providerCountryCode(provider: ProviderRow): string {
    return (provider.countryCode ?? provider.country_code ?? '+251').trim();
}

export async function sendBookingProviderSms(
    admin: SupabaseClient,
    params: {
        providerId: string;
        serviceName: string;
        customerName: string;
    }
): Promise<void> {
    const { data: providerRaw } = await admin
        .from('provider')
        .select('id, phoneNumber, countryCode, country_code, firstName, last_name')
        .eq('id', params.providerId)
        .maybeSingle();

    if (!providerRaw) return;

    const provider = providerRaw as ProviderRow;
    const phone = providerPhone(provider);
    if (!phone) return;

    let recipient = phone.replace(/\s+/g, '');
    if (!recipient.startsWith('+')) {
        const cc = providerCountryCode(provider);
        const ccClean = cc.startsWith('+') ? cc : `+${cc}`;
        recipient = `${ccClean}${recipient}`;
    }

    const message = `New booking for ${params.serviceName} from ${params.customerName}. Please check your provider app.`;

    try {
        await fetch(SMS_UPSTREAM, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                recipient,
                message,
                callback: '',
            }),
        });
    } catch {
    }
}
