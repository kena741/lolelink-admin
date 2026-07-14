import type { SupabaseClient } from '@supabase/supabase-js';
import { BOOKING_PAYMENT_STATUS, resolveBookingPaymentStatus } from '@/lib/booking-status';

interface BookingPayoutRow {
    id: string;
    provider_id?: string | null;
    totalAmount?: string | number | null;
    price?: string | number | null;
    adminCommission?: string | number | null;
    paymentType?: string | null;
    payment_status?: string | null;
    paymentCompleted?: boolean | null;
    status?: string | null;
}

interface AdminCommissionConfig {
    value: number;
    isFix: boolean;
}

function parseAmount(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}

function parseObjectValue(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'string') {
        try {
            return (JSON.parse(value) as Record<string, unknown>) ?? {};
        } catch {
            return {};
        }
    }
    if (typeof value === 'object') return value as Record<string, unknown>;
    return {};
}

export function bookingGrossAmount(booking: {
    totalAmount?: string | number | null;
    price?: string | number | null;
}): number {
    const total = parseAmount(booking.totalAmount);
    if (total > 0) return total;
    return parseAmount(booking.price);
}

export function computeProviderPayoutAmount(
    gross: number,
    commission: AdminCommissionConfig
): number {
    if (!(gross > 0)) return 0;
    const fee = commission.isFix
        ? commission.value
        : roundMoney((gross * commission.value) / 100);
    return Math.max(0, roundMoney(gross - fee));
}

export function completionPayoutNote(bookingId: string): string {
    return `Order #${bookingId.slice(0, 6)} completed (payout after admin commission)`;
}

function completionPaymentTypeLabel(paymentType: string | null | undefined): string {
    const normalized = (paymentType ?? '').trim().toLowerCase();
    if (normalized === 'chapa') return 'Chapa';
    if (normalized === 'wallet') return 'Wallet';
    if (normalized === 'admin') return 'Wallet';
    return 'Wallet';
}

async function loadAdminCommissionConfig(admin: SupabaseClient): Promise<AdminCommissionConfig> {
    const { data } = await admin
        .from('app_settings')
        .select('data')
        .eq('id', 'admin_commission')
        .maybeSingle();

    const row = parseObjectValue((data as { data?: unknown } | null)?.data);
    const rawValue = row.value;
    let value = 0;
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) value = rawValue;
    else if (typeof rawValue === 'string') {
        const parsed = parseFloat(rawValue);
        if (Number.isFinite(parsed)) value = parsed;
    }

    return {
        value,
        isFix: row.isFix === true,
    };
}

async function providerCompletionAlreadyPaid(
    admin: SupabaseClient,
    bookingId: string,
    providerId: string
): Promise<boolean> {
    const { data, error } = await admin
        .from('wallet_transaction')
        .select('id, note, isCredit')
        .eq('transactionId', bookingId)
        .eq('userId', providerId)
        .eq('isCredit', true);

    if (error) throw new Error(error.message);

    return (data ?? []).some((row) => {
        const note = String((row as { note?: string | null }).note ?? '').toLowerCase();
        return note.includes('completed') && note.includes('payout');
    });
}

/**
 * Credits provider wallet when admin marks a booking completed.
 * Mirrors mobile ledger shape: Order #<id6> completed (payout after admin commission).
 */
export async function creditProviderForCompletedBooking(
    admin: SupabaseClient,
    bookingId: string
): Promise<
    | { ok: true; skipped: true; reason: 'already_credited' | 'zero_amount' | 'unpaid' }
    | { ok: true; skipped: false; amount: number; walletAmount: number }
    | { ok: false; error: string; status: number }
> {
    const id = bookingId.trim();
    if (!id) return { ok: false, error: 'bookingId is required', status: 400 };

    const { data: bookingRaw, error: bookingError } = await admin
        .from('booked_service')
        .select(
            'id, provider_id, totalAmount, price, adminCommission, paymentType, payment_status, paymentCompleted, status'
        )
        .eq('id', id)
        .maybeSingle();

    if (bookingError) return { ok: false, error: bookingError.message, status: 500 };
    if (!bookingRaw) return { ok: false, error: 'Booking not found', status: 404 };

    const booking = bookingRaw as BookingPayoutRow;
    const providerId = (booking.provider_id ?? '').trim();
    if (!providerId) return { ok: false, error: 'Booking has no provider', status: 400 };

    const paymentStatus = resolveBookingPaymentStatus(booking.payment_status, booking.paymentCompleted);
    if (paymentStatus !== BOOKING_PAYMENT_STATUS.COMPLETED) {
        return { ok: true, skipped: true, reason: 'unpaid' };
    }

    if (await providerCompletionAlreadyPaid(admin, id, providerId)) {
        return { ok: true, skipped: true, reason: 'already_credited' };
    }

    const commission = await loadAdminCommissionConfig(admin);
    const gross = bookingGrossAmount(booking);
    const payoutAmount = computeProviderPayoutAmount(gross, commission);
    if (payoutAmount <= 0) {
        return { ok: true, skipped: true, reason: 'zero_amount' };
    }

    const { data: providerRaw, error: providerError } = await admin
        .from('provider')
        .select('id, walletAmount')
        .eq('id', providerId)
        .maybeSingle();

    if (providerError) return { ok: false, error: providerError.message, status: 500 };
    if (!providerRaw) return { ok: false, error: 'Provider not found', status: 404 };

    const currentWallet = parseAmount((providerRaw as { walletAmount?: string | number }).walletAmount);
    const nextWallet = roundMoney(currentWallet + payoutAmount);
    const now = new Date().toISOString();

    // Mobile writes userId = provider profile id and leaves provider_id null.
    const { error: walletTxError } = await admin.from('wallet_transaction').insert({
        amount: payoutAmount.toFixed(2),
        createdDate: now,
        isCredit: true,
        note: completionPayoutNote(id),
        paymentType: completionPaymentTypeLabel(booking.paymentType),
        transactionId: id,
        type: 'provider',
        userId: providerId,
        provider_id: null,
        customer_id: null,
    });

    if (walletTxError) return { ok: false, error: walletTxError.message, status: 500 };

    const { error: walletUpdateError } = await admin
        .from('provider')
        .update({ walletAmount: nextWallet.toFixed(2) })
        .eq('id', providerId);

    if (walletUpdateError) return { ok: false, error: walletUpdateError.message, status: 500 };

    return { ok: true, skipped: false, amount: payoutAmount, walletAmount: nextWallet };
}
