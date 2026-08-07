import type { SupabaseClient } from '@supabase/supabase-js';
import {
    computeAdminCommissionFee,
    loadAdminCommissionConfig,
    type AdminCommissionConfig,
} from '@/lib/booking-admin-commission';
import { customerBookingFundsHeld, hasBookingCustomerRefund } from '@/lib/booking-display';
import {
    isBookingActuallyPaid,
    isPaymentRecordSettled,
} from '@/lib/booking-status';
import { walletTransactionMagnitude } from '@/lib/wallet-transaction-metrics';
import { resolveCustomerAuthUserId } from '@/lib/wallet-transaction-user';

interface BookingPayoutRow {
    id: string;
    provider_id?: string | null;
    customer_id?: string | null;
    totalAmount?: string | number | null;
    price?: string | number | null;
    adminCommission?: string | number | null;
    paymentType?: string | null;
    payment_status?: string | null;
    paymentCompleted?: boolean | null;
    status?: string | null;
}

interface WalletNoteRow {
    note?: string | null;
    isCredit?: boolean | null;
    amount?: string | number | null;
    transactionId?: string | null;
}

function parseAmount(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
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
    commission: Pick<AdminCommissionConfig, 'value' | 'isFix' | 'active'>,
    applyCommission = true
): number {
    if (!(gross > 0)) return 0;
    if (!applyCommission) return roundMoney(gross);
    const fee = computeAdminCommissionFee(gross, commission);
    return Math.max(0, roundMoney(gross - fee));
}

export function completionPayoutNote(bookingId: string, applyCommission = true): string {
    if (applyCommission) {
        return `Order #${bookingId.slice(0, 6)} completed (payout after admin commission)`;
    }
    return `Order #${bookingId.slice(0, 6)} completed (full service amount)`;
}

export interface CreditProviderPayoutOptions {
    /** When false, provider gets gross service total. Default true (platform fee deducted). */
    applyCommission?: boolean;
}

export function completionPayoutReversalTxId(bookingId: string, sequence = 1): string {
    if (sequence <= 1) return `reversal-payout-${bookingId}`;
    return `reversal-payout-${bookingId}-${sequence}`;
}

export function completionPayoutReversalNote(bookingId: string): string {
    return `Admin reversal: completion payout for booking ${bookingId}`;
}

export function isProviderCompletionPayoutCredit(row: {
    note?: string | null;
    isCredit?: boolean | null;
}): boolean {
    if (row.isCredit !== true) return false;
    const note = String(row.note ?? '').toLowerCase();
    if (note.includes('admin reversal')) return false;
    // Admin admin path: "...completed (payout after admin commission)"
    if (note.includes('completed') && note.includes('payout')) return true;
    // Mobile / extra-payment path: "Order #xxxxxx completed with extra payment"
    if (note.includes('completed') && note.includes('extra payment')) return true;
    if (/order\s*#[0-9a-f]{4,12}\s*completed/.test(note)) return true;
    return false;
}

export function isProviderCompletionPayoutReversal(
    bookingId: string,
    row: { isCredit?: boolean | null; transactionId?: string | null }
): boolean {
    if (row.isCredit !== false) return false;
    const txId = String(row.transactionId ?? '');
    const prefix = `reversal-payout-${bookingId}`;
    return txId === prefix || txId.startsWith(`${prefix}-`);
}

/** True when completion credits exceed matching clawback reversals. */
export function providerCompletionNetOutstanding(
    bookingId: string,
    rows: WalletNoteRow[]
): boolean {
    let credits = 0;
    let reversals = 0;
    for (const row of rows) {
        if (isProviderCompletionPayoutCredit(row)) credits += 1;
        if (isProviderCompletionPayoutReversal(bookingId, row)) reversals += 1;
    }
    return credits > reversals;
}

export function nextCompletionPayoutReversalSequence(
    bookingId: string,
    rows: WalletNoteRow[]
): number {
    let reversals = 0;
    for (const row of rows) {
        if (isProviderCompletionPayoutReversal(bookingId, row)) reversals += 1;
    }
    return reversals + 1;
}

function completionPaymentTypeLabel(paymentType: string | null | undefined): string {
    const normalized = (paymentType ?? '').trim().toLowerCase();
    if (normalized === 'chapa') return 'Chapa';
    if (normalized === 'wallet') return 'Wallet';
    if (normalized === 'admin') return 'Wallet';
    return 'Wallet';
}

async function loadProviderCompletionLedgerRows(
    admin: SupabaseClient,
    bookingId: string,
    providerId: string
): Promise<WalletNoteRow[]> {
    const { data: creditRows, error: creditError } = await admin
        .from('wallet_transaction')
        .select('id, note, isCredit, amount, transactionId')
        .eq('userId', providerId)
        .eq('transactionId', bookingId);

    if (creditError) throw new Error(creditError.message);

    const { data: reversalRows, error: reversalError } = await admin
        .from('wallet_transaction')
        .select('id, note, isCredit, amount, transactionId')
        .eq('userId', providerId)
        .like('transactionId', `reversal-payout-${bookingId}%`);

    if (reversalError) throw new Error(reversalError.message);

    return [...((creditRows ?? []) as WalletNoteRow[]), ...((reversalRows ?? []) as WalletNoteRow[])];
}

async function bookingCustomerPaymentBlockedByRefund(
    admin: SupabaseClient,
    bookingId: string,
    customerId: string | null | undefined
): Promise<boolean> {
    const cid = (customerId ?? '').trim();
    if (!cid) return false;

    const authUser = await resolveCustomerAuthUserId(admin, cid);
    if (!authUser.ok) return false;

    const { data, error } = await admin
        .from('wallet_transaction')
        .select('isCredit, note, transactionId, createdDate')
        .eq('userId', authUser.authUserId);

    if (error) throw new Error(error.message);

    const txs = (data ?? []) as Array<{
        isCredit?: boolean | null;
        note?: string | null;
        transactionId?: string | null;
        createdDate?: string | null;
    }>;

    if (!hasBookingCustomerRefund(bookingId, txs)) return false;
    return !customerBookingFundsHeld(bookingId, txs);
}

/**
 * Credits provider wallet once payment is settled (and job is completed, or admin mark-paid path).
 * Idempotent per booking. applyCommission=false → full service total (admin mark paid).
 */
export async function creditProviderForCompletedBooking(
    admin: SupabaseClient,
    bookingId: string,
    options?: CreditProviderPayoutOptions
): Promise<
    | {
          ok: true;
          skipped: true;
          reason: 'already_credited' | 'zero_amount' | 'unpaid' | 'customer_refunded';
      }
    | { ok: true; skipped: false; amount: number; walletAmount: number }
    | { ok: false; error: string; status: number }
> {
    const id = bookingId.trim();
    if (!id) return { ok: false, error: 'bookingId is required', status: 400 };
    const applyCommission = options?.applyCommission !== false;

    const { data: bookingRaw, error: bookingError } = await admin
        .from('booked_service')
        .select(
            'id, provider_id, customer_id, totalAmount, price, adminCommission, paymentType, payment_status, paymentCompleted, status'
        )
        .eq('id', id)
        .maybeSingle();

    if (bookingError) return { ok: false, error: bookingError.message, status: 500 };
    if (!bookingRaw) return { ok: false, error: 'Booking not found', status: 404 };

    const booking = bookingRaw as BookingPayoutRow;
    const providerId = (booking.provider_id ?? '').trim();
    if (!providerId) return { ok: false, error: 'Booking has no provider', status: 400 };

    // Provider wallet credit requires real payment settlement — never job status alone.
    let paid = isBookingActuallyPaid(booking.payment_status, booking.paymentCompleted);
    if (!paid) {
        const { data: payRow } = await admin
            .from('payments')
            .select('status')
            .eq('booking_id', id)
            .maybeSingle();
        paid = isPaymentRecordSettled((payRow as { status?: string } | null)?.status);
    }
    if (!paid) {
        return { ok: true, skipped: true, reason: 'unpaid' };
    }

    if (await bookingCustomerPaymentBlockedByRefund(admin, id, booking.customer_id)) {
        return { ok: true, skipped: true, reason: 'customer_refunded' };
    }

    const ledgerRows = await loadProviderCompletionLedgerRows(admin, id, providerId);
    if (providerCompletionNetOutstanding(id, ledgerRows)) {
        return { ok: true, skipped: true, reason: 'already_credited' };
    }

    const commission = await loadAdminCommissionConfig(admin);
    const gross = bookingGrossAmount(booking);
    const commissionFee = applyCommission ? computeAdminCommissionFee(gross, commission) : 0;
    const payoutAmount = computeProviderPayoutAmount(gross, commission, applyCommission);
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
        note: completionPayoutNote(id, applyCommission),
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

    if (applyCommission) {
        const storedCommission = parseAmount(booking.adminCommission);
        if (!(storedCommission > 0) && commissionFee > 0) {
            await admin
                .from('booked_service')
                .update({ adminCommission: commissionFee })
                .eq('id', id);
        }
    } else {
        await admin.from('booked_service').update({ adminCommission: 0 }).eq('id', id);
    }

    return { ok: true, skipped: false, amount: payoutAmount, walletAmount: nextWallet };
}

/**
 * Claws back provider completion payout when leaving completed status.
 */
export async function clawbackProviderCompletionPayout(
    admin: SupabaseClient,
    bookingId: string
): Promise<
    | { ok: true; skipped: true; reason: 'no_credit' | 'already_reversed' }
    | { ok: true; skipped: false; amount: number; walletAmount: number }
    | { ok: false; error: string; status: number }
> {
    const id = bookingId.trim();
    if (!id) return { ok: false, error: 'bookingId is required', status: 400 };

    const { data: bookingRaw, error: bookingError } = await admin
        .from('booked_service')
        .select('id, provider_id')
        .eq('id', id)
        .maybeSingle();

    if (bookingError) return { ok: false, error: bookingError.message, status: 500 };
    if (!bookingRaw) return { ok: false, error: 'Booking not found', status: 404 };

    const providerId = String((bookingRaw as { provider_id?: string | null }).provider_id ?? '').trim();
    if (!providerId) return { ok: false, error: 'Booking has no provider', status: 400 };

    const ledgerRows = await loadProviderCompletionLedgerRows(admin, id, providerId);
    const reversalSequence = nextCompletionPayoutReversalSequence(id, ledgerRows);
    const reversalTxId = completionPayoutReversalTxId(id, reversalSequence);

    if (!providerCompletionNetOutstanding(id, ledgerRows)) {
        const hadCredit = ledgerRows.some((row) => isProviderCompletionPayoutCredit(row));
        return {
            ok: true,
            skipped: true,
            reason: hadCredit ? 'already_reversed' : 'no_credit',
        };
    }

    const creditRow = ledgerRows.find((row) => isProviderCompletionPayoutCredit(row));
    const payoutAmount = walletTransactionMagnitude(creditRow?.amount);
    if (!(payoutAmount > 0)) {
        return { ok: true, skipped: true, reason: 'no_credit' };
    }

    const { data: providerRaw, error: providerError } = await admin
        .from('provider')
        .select('id, walletAmount')
        .eq('id', providerId)
        .maybeSingle();

    if (providerError) return { ok: false, error: providerError.message, status: 500 };
    if (!providerRaw) return { ok: false, error: 'Provider not found', status: 404 };

    const currentWallet = parseAmount((providerRaw as { walletAmount?: string | number }).walletAmount);
    const nextWallet = roundMoney(currentWallet - payoutAmount);
    const now = new Date().toISOString();

    const { error: insertError } = await admin.from('wallet_transaction').insert({
        amount: payoutAmount.toFixed(2),
        createdDate: now,
        isCredit: false,
        note: completionPayoutReversalNote(id),
        paymentType: 'admin',
        transactionId: reversalTxId,
        type: 'provider',
        userId: providerId,
        provider_id: null,
        customer_id: null,
    });

    if (insertError) return { ok: false, error: insertError.message, status: 500 };

    const { error: walletUpdateError } = await admin
        .from('provider')
        .update({ walletAmount: nextWallet.toFixed(2) })
        .eq('id', providerId);

    if (walletUpdateError) return { ok: false, error: walletUpdateError.message, status: 500 };

    return { ok: true, skipped: false, amount: payoutAmount, walletAmount: nextWallet };
}

/**
 * If job is already completed and payment just settled, credit provider wallet once.
 * (payment can arrive after status is completed — status alone must not credit.)
 * Admin-marked payments credit full service; other methods deduct platform commission.
 */
export async function maybeCreditProviderAfterPaymentSettled(
    admin: SupabaseClient,
    bookingId: string
): Promise<void> {
    const id = bookingId.trim();
    if (!id) return;

    const { data } = await admin
        .from('booked_service')
        .select('status, paymentType')
        .eq('id', id)
        .maybeSingle();
    const row = data as { status?: string; paymentType?: string } | null;
    const status = String(row?.status ?? '')
        .trim()
        .toLowerCase();
    if (status !== 'completed' && status !== 'service_completion_approved_by_customer') return;

    const paymentType = String(row?.paymentType ?? '')
        .trim()
        .toLowerCase();
    const applyCommission = paymentType !== 'admin';

    await creditProviderForCompletedBooking(admin, id, { applyCommission });
}
