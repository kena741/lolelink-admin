/**
 * Mobile-aligned booking payment progress.
 * paymentCompleted = money started; % / remaining come from totalAmount vs obligation.
 */

export type BookingPaymentAmounts = {
    paymentCompleted?: boolean | null;
    payment_status?: string | null;
    totalAmount?: string | number | null;
    subTotal?: string | number | null;
    price?: string | number | null;
    quantity?: string | number | null;
    status?: string | null;
    nextCycleDue?: boolean | null;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
};

export type BookingPaymentSettlement = 'unpaid' | 'partial' | 'paid';

const TERMINAL_JOB = new Set([
    'completed',
    'rejected',
    'cancelled',
    'canceled',
    'admin_paid',
]);

export function asBookingMoney(value: string | number | null | undefined): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const n = Number.parseFloat(String(value ?? '').trim());
    return Number.isFinite(n) ? n : 0;
}

export function isRecurringBooking(input: BookingPaymentAmounts): boolean {
    return (
        input.nextCycleDue === true ||
        Boolean(input.currentPeriodStart) ||
        Boolean(input.currentPeriodEnd)
    );
}

/** Full customer service obligation (not extras). Prefer stored subTotal, then price×qty. */
export function customerObligationAmount(input: BookingPaymentAmounts): number {
    const sub = asBookingMoney(input.subTotal);
    if (sub > 0) return sub;
    const unit = asBookingMoney(input.price);
    const qty = Number.parseInt(String(input.quantity ?? '1'), 10);
    const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
    if (unit > 0) return unit * safeQty;
    return asBookingMoney(input.totalAmount);
}

export function remainingServiceBalance(input: BookingPaymentAmounts): number {
    if (isRecurringBooking(input)) return 0;
    if (input.paymentCompleted !== true) return 0;
    const status = String(input.status ?? '')
        .trim()
        .toLowerCase();
    if (TERMINAL_JOB.has(status)) return 0;
    const full = customerObligationAmount(input);
    const paid = asBookingMoney(input.totalAmount);
    if (full <= 0) return 0;
    const remaining = full - paid;
    return remaining < 0.01 ? 0 : remaining;
}

/** 0 when unpaid flag; else totalAmount ÷ obligation. */
export function paidPercentage(input: BookingPaymentAmounts): number {
    if (input.paymentCompleted !== true) return 0;
    const full = customerObligationAmount(input);
    if (full <= 0) return 100;
    if (!isRecurringBooking(input) && remainingServiceBalance(input) <= 0) return 100;
    const paid = Math.min(Math.max(asBookingMoney(input.totalAmount), 0), full);
    return Math.min(100, Math.max(0, Math.round((paid / full) * 100)));
}

export function resolveBookingPaymentSettlement(
    input: BookingPaymentAmounts
): BookingPaymentSettlement {
    const status = String(input.payment_status ?? '')
        .trim()
        .toLowerCase();
    const flagged =
        input.paymentCompleted === true || status === 'payment_completed';
    if (!flagged) return 'unpaid';
    if (remainingServiceBalance(input) > 0) return 'partial';
    return 'paid';
}
