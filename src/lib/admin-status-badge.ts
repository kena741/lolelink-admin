import { resolveBookingPaymentStatus } from '@/lib/booking-status';

export type AdminStatusTone =
    | 'neutral'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'violet'
    | 'slate'
    | 'pending'
    | 'wallet';

export const adminStatusToneClasses: Record<AdminStatusTone, string> = {
    neutral: 'border border-gray-200 bg-gray-100 text-gray-700',
    success: 'border border-emerald-600/25 bg-emerald-50 text-emerald-700',
    warning: 'border border-amber-300 bg-amber-50 text-amber-800',
    danger: 'border border-destructive/35 bg-destructive/10 text-destructive',
    info: 'border border-indigo-600/25 bg-indigo-50 text-indigo-700',
    violet: 'border border-violet-300 bg-violet-50 text-violet-700',
    slate: 'border border-slate-200 bg-slate-50 text-slate-700',
    pending: 'border border-amber-300 bg-amber-50 text-amber-800',
    wallet: 'border border-sky-300 bg-sky-50 text-sky-700',
};

export function getAdminStatusToneClasses(tone: AdminStatusTone): string {
    return adminStatusToneClasses[tone];
}

export function getBookingJobStatusTone(status?: string): AdminStatusTone {
    switch (status ?? 'pending') {
        case 'pending':
            return 'pending';
        case 'completed':
        case 'admin_paid':
            return 'success';
        case 'rejected':
            return 'danger';
        case 'accepted':
        case 'pending_approval':
        case 'in_progress':
        case 'on_the_way':
            return 'info';
        case 'pending_extra_payment':
        case 'hold':
            return 'warning';
        default:
            return 'neutral';
    }
}

export function getBookingPaymentStatusTone(
    paymentStatus: string | null | undefined,
    paymentCompleted: boolean | null | undefined
): AdminStatusTone {
    switch (resolveBookingPaymentStatus(paymentStatus, paymentCompleted)) {
        case 'payment_completed':
            return 'success';
        case 'payment_approved_by_admin':
            return 'info';
        case 'pending_payment':
            return 'warning';
        case 'payment_rejected_by_admin':
            return 'danger';
        case 'payment_cancelled':
            return 'neutral';
        default:
            return 'neutral';
    }
}

export function getBookingPaymentMethodTone(paymentType?: string | null): AdminStatusTone {
    const normalized = (paymentType ?? '').toLowerCase();
    if (normalized === 'chapa') return 'violet';
    if (normalized === 'wallet') return 'wallet';
    return 'neutral';
}

export function getPaymentRecordStatusTone(status: string): AdminStatusTone {
    switch (status) {
        case 'payment_completed':
            return 'success';
        case 'payment_approved_by_admin':
            return 'info';
        case 'pending_payment':
            return 'warning';
        case 'payment_rejected_by_admin':
            return 'danger';
        case 'payment_cancelled':
            return 'slate';
        default:
            return 'neutral';
    }
}

export function getWalletTransactionTypeTone(type: string): AdminStatusTone {
    const normalized = type.toLowerCase();
    if (normalized === 'customer') return 'wallet';
    if (normalized === 'provider' || normalized === 'provider_payout') return 'violet';
    return 'neutral';
}

export function getWalletTransactionPaymentTone(paymentType: string): AdminStatusTone {
    const normalized = paymentType.toLowerCase();
    if (normalized === 'chapa') return 'violet';
    if (normalized === 'wallet') return 'wallet';
    return 'neutral';
}
