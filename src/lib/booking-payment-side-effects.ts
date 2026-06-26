import type { SupabaseClient } from '@supabase/supabase-js';
import { BOOKING_PAYMENT_STATUS } from '@/lib/booking-status';
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
        return params.paymentId ?? '';
    }

    const now = new Date().toISOString();
    const amount = bookingTotalAmount(booking);

    const { data: existing } = await admin
        .from('payments')
        .select('id')
        .eq('booking_id', booking.id)
        .maybeSingle();

    const paymentId =
        params.paymentId ??
        (existing && (existing as { id?: string }).id ? (existing as { id: string }).id : crypto.randomUUID());

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
        ...(existing ? {} : { created_at: now }),
    };

    if (existing && (existing as { id?: string }).id) {
        await admin.from('payments').update(payload).eq('id', (existing as { id: string }).id);
        return paymentId;
    }

    await admin.from('payments').insert({
        id: paymentId,
        ...payload,
    });

    return paymentId;
}

export async function debitCustomerWalletForBooking(
    admin: SupabaseClient,
    bookingId: string,
    customerId: string,
    amount: number
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
    const txRef = `wallet-bkg-${bookingId.slice(0, 8)}-${Date.now()}`;
    const paymentId = crypto.randomUUID();

    const { error: walletTxError } = await admin.from('wallet_transaction').insert({
        amount: amount.toFixed(2),
        createdDate: now,
        isCredit: false,
        note: `Booking payment ${bookingId}`,
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
            payment_id: paymentId,
        })
        .eq('id', bookingId);

    if (bookingUpdateError) {
        return { ok: false, error: bookingUpdateError.message, status: 500 };
    }

    return { ok: true, paymentId };
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
        .select('id, phone, phoneNumber, countryCode, country_code, firstName, last_name')
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
