export type BookedServiceStatus =
    | 'pending'
    | 'accepted'
    | 'rejected'
    | 'on_the_way'
    | 'in_progress'
    | 'hold'
    | 'completed'
    | 'pending_extra_payment'
    | 'pending_approval'
    | 'admin_paid';

export type BookingPaymentStatus =
    | 'pending_payment'
    | 'payment_approved_by_admin'
    | 'payment_rejected_by_admin'
    | 'payment_completed'
    | 'payment_cancelled';

export type BookingPaymentMode = 'pay_later' | 'chapa' | 'wallet' | 'mark_paid';

export const BOOKING_STATUS = {
    AWAITING_PROVIDER: 'pending',
    ADMIN_PAID: 'admin_paid',
} as const satisfies Record<string, BookedServiceStatus>;

export const BOOKING_PAYMENT_STATUS = {
    PENDING: 'pending_payment',
    COMPLETED: 'payment_completed',
} as const satisfies Record<string, BookingPaymentStatus>;

export function resolveInitialBookingStatus(paymentMode: BookingPaymentMode): BookedServiceStatus {
    if (paymentMode === 'mark_paid') {
        return BOOKING_STATUS.ADMIN_PAID;
    }
    return BOOKING_STATUS.AWAITING_PROVIDER;
}

const BOOKING_JOB_STATUS_LABELS: Record<BookedServiceStatus, string> = {
    pending: 'Awaiting provider',
    accepted: 'Accepted',
    rejected: 'Rejected',
    on_the_way: 'On the way',
    in_progress: 'In progress',
    hold: 'On hold',
    completed: 'Completed',
    pending_extra_payment: 'Extra payment due',
    pending_approval: 'Pending approval',
    admin_paid: 'Admin paid',
};

export const BOOKING_JOB_STATUS_OPTIONS: ReadonlyArray<{
    value: BookedServiceStatus;
    label: string;
}> = (Object.keys(BOOKING_JOB_STATUS_LABELS) as BookedServiceStatus[]).map((value) => ({
    value,
    label: BOOKING_JOB_STATUS_LABELS[value],
}));

export function isBookedServiceStatus(value: string): value is BookedServiceStatus {
    return value in BOOKING_JOB_STATUS_LABELS;
}

const BOOKING_PAYMENT_STATUS_LABELS: Record<BookingPaymentStatus, string> = {
    pending_payment: 'Unpaid',
    payment_completed: 'Paid',
    payment_approved_by_admin: 'Approved by admin',
    payment_rejected_by_admin: 'Rejected by admin',
    payment_cancelled: 'Cancelled',
};

export function formatBookingJobStatusLabel(status: string | null | undefined): string {
    if (!status) return 'Unknown';
    if (status in BOOKING_JOB_STATUS_LABELS) {
        return BOOKING_JOB_STATUS_LABELS[status as BookedServiceStatus];
    }
    return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatBookingPaymentStatusLabel(
    paymentStatus: string | null | undefined,
    paymentCompleted?: boolean | null
): string {
    if (paymentCompleted === true || paymentStatus === BOOKING_PAYMENT_STATUS.COMPLETED) {
        return BOOKING_PAYMENT_STATUS_LABELS.payment_completed;
    }
    if (!paymentStatus) return 'Unknown';
    if (paymentStatus in BOOKING_PAYMENT_STATUS_LABELS) {
        return BOOKING_PAYMENT_STATUS_LABELS[paymentStatus as BookingPaymentStatus];
    }
    return paymentStatus.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function resolveBookingPaymentStatus(
    paymentStatus: string | null | undefined,
    paymentCompleted?: boolean | null
): BookingPaymentStatus | 'unknown' {
    if (paymentCompleted === true || paymentStatus === BOOKING_PAYMENT_STATUS.COMPLETED) {
        return BOOKING_PAYMENT_STATUS.COMPLETED;
    }
    if (paymentStatus && paymentStatus in BOOKING_PAYMENT_STATUS_LABELS) {
        return paymentStatus as BookingPaymentStatus;
    }
    return 'unknown';
}

/**
 * True when customer/admin actually settled money — not job status alone.
 * Provider completion credits must wait for this.
 */
export function isBookingActuallyPaid(
    paymentStatus: string | null | undefined,
    paymentCompleted?: boolean | null
): boolean {
    if (paymentCompleted === true) return true;
    const s = (paymentStatus ?? '').trim().toLowerCase();
    return (
        s === BOOKING_PAYMENT_STATUS.COMPLETED ||
        s === 'payment_approved_by_admin' ||
        s === 'paid' ||
        s === 'success'
    );
}

export function isPaymentRecordSettled(status: string | null | undefined): boolean {
    const s = (status ?? '').trim().toLowerCase();
    return (
        s === BOOKING_PAYMENT_STATUS.COMPLETED ||
        s === 'payment_approved_by_admin' ||
        s === 'paid' ||
        s === 'success' ||
        s === 'completed'
    );
}
