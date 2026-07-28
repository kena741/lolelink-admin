import { BOOKING_PAYMENT_STATUS, resolveBookingPaymentStatus } from '@/lib/booking-status';

export interface BookingAnomaly {
    id: string;
    severity: 'warning' | 'error';
    category: 'integrity' | 'payment' | 'lifecycle' | 'data';
    label: string;
}

export interface ParsedBookingCoupon {
    code: string | null;
    amount: string | null;
    active: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

export function parseBookingAmount(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

export function formatBookingAmount(value: unknown): string {
    const amount = parseBookingAmount(value);
    if (amount === null) return '—';
    return `ETB ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatBookingShortId(id: string): string {
    const trimmed = id.trim();
    if (trimmed.length <= 8) return trimmed;
    return trimmed.slice(0, 8);
}

export function sanitizePersonDisplayName(value: string | null | undefined): string {
    if (!value?.trim()) return '';
    return value
        .replace(/[^\p{L}\p{N}\s'.-]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function formatAnomalyShortLabel(id: string): string {
    const labels: Record<string, string> = {
        'same-owner-booking': 'Same owner',
        'negative-amount': 'Negative amt',
        'payment-flag-mismatch': 'Pay flag',
        'rejected-refund-missing': 'No refund',
        'completed-unpaid': 'Unpaid done',
        'missing-service-name': 'No service',
    };
    return labels[id] ?? 'Issue';
}

const UNPAID_PAYMENT_STATUSES = new Set<string>([
    BOOKING_PAYMENT_STATUS.PENDING,
    'payment_cancelled',
    'payment_rejected_by_admin',
]);

export function hasBookingPaymentFlagConflict(
    paymentStatus: string,
    paymentCompleted: boolean
): boolean {
    if (paymentCompleted && UNPAID_PAYMENT_STATUSES.has(paymentStatus)) {
        return true;
    }

    if (!paymentCompleted && paymentStatus === BOOKING_PAYMENT_STATUS.COMPLETED) {
        return false;
    }

    return false;
}

export interface BookingWalletTransaction {
    isCredit?: boolean | null;
    note?: string | null;
    transactionId?: string | null;
    createdDate?: string | null;
    amount?: string | number | null;
}

export function hasBookingCustomerRefund(
    bookingId: string,
    transactions: BookingWalletTransaction[]
): boolean {
    const id = bookingId.trim().toLowerCase();
    if (!id) return false;

    const shortId = id.slice(0, 8);

    return transactions.some((tx) => {
        if (tx.isCredit !== true) return false;

        const note = (tx.note ?? '').toLowerCase();
        const transactionId = (tx.transactionId ?? '').toLowerCase();

        if (transactionId.includes(id) || note.includes(id)) {
            return true;
        }

        if (note.includes(shortId) && (note.includes('refund') || note.includes('decline'))) {
            return true;
        }

        return note.includes(`order #${shortId}`);
    });
}

function isBookingRelatedWalletTx(bookingId: string, tx: BookingWalletTransaction): boolean {
    const id = bookingId.trim().toLowerCase();
    if (!id) return false;
    const shortId = id.slice(0, 8);
    const note = (tx.note ?? '').toLowerCase();
    const transactionId = (tx.transactionId ?? '').toLowerCase();

    if (transactionId.includes(id) || note.includes(id)) return true;
    if (note.includes(`order #${shortId}`)) return true;
    if (
        note.includes(shortId) &&
        (note.includes('refund') ||
            note.includes('decline') ||
            note.includes('re-collection') ||
            note.includes('booking') ||
            note.includes('payment') ||
            note.includes('service fee'))
    ) {
        return true;
    }
    return false;
}

function isBookingRefundCredit(tx: BookingWalletTransaction): boolean {
    if (tx.isCredit !== true) return false;
    const note = (tx.note ?? '').toLowerCase();
    return note.includes('refund') || note.includes('decline');
}

/**
 * True when the latest related customer ledger activity leaves payment held
 * (a debit / re-collection after any refund).
 */
export function customerBookingFundsHeld(
    bookingId: string,
    transactions: BookingWalletTransaction[]
): boolean {
    return netCustomerBookingHeldAmount(bookingId, transactions) > 0;
}

/** Net customer wallet amount still held for this booking (debits minus refunds). */
export function netCustomerBookingHeldAmount(
    bookingId: string,
    transactions: BookingWalletTransaction[]
): number {
    const related = transactions
        .filter((tx) => isBookingRelatedWalletTx(bookingId, tx))
        .slice()
        .sort((a, b) => {
            const aTime = Date.parse(String(a.createdDate ?? '')) || 0;
            const bTime = Date.parse(String(b.createdDate ?? '')) || 0;
            return aTime - bTime;
        });

    let net = 0;
    for (const tx of related) {
        const magnitude = Math.abs(Number(tx.amount ?? 0)) || 0;
        if (isBookingRefundCredit(tx)) {
            net = Math.max(0, Math.round((net - magnitude) * 100) / 100);
            continue;
        }
        if (tx.isCredit !== true) {
            net = Math.round((net + magnitude) * 100) / 100;
        }
    }
    return net > 0 ? net : 0;
}

function isRejectedPaidBooking(
    jobStatus: string,
    paymentStatus: string,
    paymentCompleted: boolean
): boolean {
    if (jobStatus !== 'rejected') return false;
    return resolveBookingPaymentStatus(paymentStatus, paymentCompleted) === BOOKING_PAYMENT_STATUS.COMPLETED;
}

function readBookingId(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

export function isSameOwnerBooking(booking: Record<string, unknown>): boolean {
    const customerId = readBookingId(booking.customer_id);
    const providerId = readBookingId(booking.provider_id);
    if (customerId && providerId && customerId === providerId) {
        return true;
    }

    const customerUserId = readBookingId(booking.customer_user_id);
    const providerUserId = readBookingId(booking.provider_user_id);
    return Boolean(customerUserId && providerUserId && customerUserId === providerUserId);
}

const ANOMALY_CATEGORY_LABELS: Record<BookingAnomaly['category'], string> = {
    integrity: 'Integrity',
    payment: 'Payment',
    lifecycle: 'Job & payment',
    data: 'Data quality',
};

export function getAnomalyCategoryLabel(category: BookingAnomaly['category']): string {
    return ANOMALY_CATEGORY_LABELS[category];
}

export function groupBookingAnomaliesByCategory(
    anomalies: BookingAnomaly[]
): Array<{ category: BookingAnomaly['category']; items: BookingAnomaly[] }> {
    const order: BookingAnomaly['category'][] = ['integrity', 'payment', 'lifecycle', 'data'];
    const grouped = new Map<BookingAnomaly['category'], BookingAnomaly[]>();

    for (const anomaly of anomalies) {
        const existing = grouped.get(anomaly.category) ?? [];
        existing.push(anomaly);
        grouped.set(anomaly.category, existing);
    }

    return order
        .filter((category) => grouped.has(category))
        .map((category) => ({ category, items: grouped.get(category) ?? [] }));
}

export type BookingAnomalySeverityGroup = 'error' | 'warning';

const SEVERITY_GROUP_LABELS: Record<BookingAnomalySeverityGroup, string> = {
    error: 'Critical',
    warning: 'Warning',
};

export function getAnomalySeverityGroupLabel(severity: BookingAnomalySeverityGroup): string {
    return SEVERITY_GROUP_LABELS[severity];
}

export function groupBookingAnomaliesBySeverity(
    anomalies: BookingAnomaly[]
): Array<{ severity: BookingAnomalySeverityGroup; label: string; items: BookingAnomaly[] }> {
    const order: BookingAnomalySeverityGroup[] = ['error', 'warning'];
    const grouped = new Map<BookingAnomalySeverityGroup, BookingAnomaly[]>();

    for (const anomaly of anomalies) {
        const existing = grouped.get(anomaly.severity) ?? [];
        existing.push(anomaly);
        grouped.set(anomaly.severity, existing);
    }

    return order
        .filter((severity) => grouped.has(severity))
        .map((severity) => ({
            severity,
            label: getAnomalySeverityGroupLabel(severity),
            items: grouped.get(severity) ?? [],
        }));
}

export function formatBookingTableDate(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function bookingAmountTone(value: unknown): 'negative' | 'zero' | 'positive' | 'unknown' {
    const amount = parseBookingAmount(value);
    if (amount === null) return 'unknown';
    if (amount < 0) return 'negative';
    if (amount === 0) return 'zero';
    return 'positive';
}

export function resolveBookingServiceId(booking: Record<string, unknown>): string {
    if (typeof booking.service_id === 'string' && booking.service_id.trim()) {
        return booking.service_id.trim();
    }
    if (typeof booking.serviceId === 'string' && booking.serviceId.trim()) {
        return booking.serviceId.trim();
    }

    const details = asRecord(booking.serviceDetails);
    if (typeof details?.service_id === 'string' && details.service_id.trim()) {
        return details.service_id.trim();
    }
    if (typeof details?.serviceId === 'string' && details.serviceId.trim()) {
        return details.serviceId.trim();
    }

    return '';
}

export function resolveBookingServiceName(booking: Record<string, unknown>): string {
    const direct = typeof booking.serviceName === 'string' ? booking.serviceName.trim() : '';
    if (direct) return direct;

    const details = asRecord(booking.serviceDetails);
    const fromDetails = typeof details?.serviceName === 'string' ? details.serviceName.trim() : '';
    return fromDetails || '—';
}

export function resolveBookingServiceImage(booking: Record<string, unknown>): string | null {
    const direct = booking.serviceImage;
    if (typeof direct === 'string' && direct.trim()) return direct.trim();

    const details = asRecord(booking.serviceDetails);
    const images = details?.serviceImage;
    if (Array.isArray(images) && typeof images[0] === 'string' && images[0].trim()) {
        return images[0].trim();
    }
    return null;
}

export function parseBookingCoupon(raw: unknown): ParsedBookingCoupon | null {
    if (!raw) return null;

    let parsed: Record<string, unknown> | null = null;
    if (typeof raw === 'string') {
        try {
            parsed = asRecord(JSON.parse(raw));
        } catch {
            return null;
        }
    } else {
        parsed = asRecord(raw);
    }

    if (!parsed) return null;

    const code = typeof parsed.code === 'string' && parsed.code.trim() ? parsed.code.trim() : null;
    const amount =
        parsed.amount === null || parsed.amount === undefined
            ? null
            : String(parsed.amount);
    const active = parsed.active === true;

    if (!code && !amount) return null;
    return { code, amount, active };
}

export function formatPaymentMethodLabel(paymentType: unknown): string {
    if (typeof paymentType !== 'string' || !paymentType.trim()) return '—';
    const normalized = paymentType.trim().toLowerCase();
    if (normalized === 'chapa') return 'Chapa';
    if (normalized === 'wallet') return 'Wallet';
    if (normalized === 'admin') return 'Admin';
    return paymentType.trim();
}

export function getBookingAnomalies(booking: Record<string, unknown>): BookingAnomaly[] {
    const anomalies: BookingAnomaly[] = [];
    const total = parseBookingAmount(booking.totalAmount);
    const subTotal = parseBookingAmount(booking.subTotal);
    const paymentStatus = typeof booking.payment_status === 'string' ? booking.payment_status : '';
    const paymentCompleted = booking.paymentCompleted === true;
    const jobStatus = typeof booking.status === 'string' ? booking.status : '';
    const resolvedPayment = resolveBookingPaymentStatus(paymentStatus, paymentCompleted);

    if (isSameOwnerBooking(booking)) {
        anomalies.push({
            id: 'same-owner-booking',
            severity: 'error',
            category: 'integrity',
            label: 'Customer and provider share the same account (marketplace integrity risk)',
        });
    }

    if ((total !== null && total < 0) || (subTotal !== null && subTotal < 0)) {
        anomalies.push({
            id: 'negative-amount',
            severity: 'error',
            category: 'integrity',
            label: 'Negative amount on booking',
        });
    }

    if (hasBookingPaymentFlagConflict(paymentStatus, paymentCompleted)) {
        anomalies.push({
            id: 'payment-flag-mismatch',
            severity: 'warning',
            category: 'payment',
            label: 'paymentCompleted is true but payment_status indicates unpaid or cancelled',
        });
    }

    if (isRejectedPaidBooking(jobStatus, paymentStatus, paymentCompleted)) {
        const refundRecorded = booking.customer_refund_recorded === true;
        if (!refundRecorded) {
            anomalies.push({
                id: 'rejected-refund-missing',
                severity: 'warning',
                category: 'lifecycle',
                label: 'Rejected after payment — refund not recorded back to customer wallet',
            });
        }
    }

    if (jobStatus === 'completed' && resolvedPayment !== 'payment_completed') {
        anomalies.push({
            id: 'completed-unpaid',
            severity: 'warning',
            category: 'lifecycle',
            label: 'Completed job without completed payment',
        });
    }

    const serviceName = resolveBookingServiceName(booking);
    if (serviceName === '—') {
        anomalies.push({
            id: 'missing-service-name',
            severity: 'warning',
            category: 'data',
            label: 'Service name missing on booking row',
        });
    }

    return anomalies;
}

export function formatBookingDateTime(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatBookingAddress(raw: unknown): string {
    const address = asRecord(raw);
    if (!address) return '—';

    const parts = [
        typeof address.address === 'string' ? address.address.trim() : '',
        typeof address.locality === 'string' ? address.locality.trim() : '',
        typeof address.landmark === 'string' ? address.landmark.trim() : '',
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : '—';
}
