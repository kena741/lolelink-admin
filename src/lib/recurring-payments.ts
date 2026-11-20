import type { RecurringBillingCycle } from '@/features/settings/settingsSlice';
import { DEFAULT_RECURRING_PAYMENT_SETTINGS } from '@/features/settings/settingsSlice';

export const RECURRING_CYCLE_OPTIONS: Array<{ value: RecurringBillingCycle; label: string }> = [
    { value: 'MINUTE', label: 'Every minute' },
    { value: 'HOUR', label: 'Hourly' },
    { value: 'WEEK', label: 'Weekly' },
    { value: 'MONTH', label: 'Monthly' },
    { value: 'QUARTER', label: 'Quarterly' },
    { value: 'YEAR', label: 'Yearly' },
];

export function isRecurringPricingType(value: string | null | undefined): boolean {
    return (value ?? '').trim().toUpperCase() === 'RECURRING';
}

export function normalizeBillingInterval(
    raw: string | null | undefined,
    available: RecurringBillingCycle[] = DEFAULT_RECURRING_PAYMENT_SETTINGS.available_cycles,
): RecurringBillingCycle {
    const cycle = (raw ?? '').trim().toUpperCase();
    if (available.includes(cycle)) return cycle;
    if (available.includes('MONTH')) return 'MONTH';
    return available[0] ?? 'MONTH';
}

export function billingIntervalLabel(raw: string | null | undefined): string {
    const cycle = (raw ?? '').trim().toUpperCase() || 'MONTH';
    const known = RECURRING_CYCLE_OPTIONS.find((o) => o.value === cycle);
    if (known) return known.label;
    return cycle
        .toLowerCase()
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function bookingServiceDetailsRecord(serviceDetails: unknown): Record<string, unknown> | null {
    if (!serviceDetails || typeof serviceDetails !== 'object' || Array.isArray(serviceDetails)) return null;
    return serviceDetails as Record<string, unknown>;
}

export function isRecurringBooking(booking: {
    nextCycleDue?: boolean | null;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    serviceDetails?: unknown;
}): boolean {
    if (booking.nextCycleDue === true) return true;
    if (booking.currentPeriodStart || booking.currentPeriodEnd) return true;
    const details = bookingServiceDetailsRecord(booking.serviceDetails);
    if (!details) return false;
    return isRecurringPricingType(
        (details.pricing_type ?? details.pricingType)?.toString(),
    );
}

export function addBillingInterval(
    start: Date,
    interval: string,
    count = 1
): Date {
    const d = new Date(start.getTime());
    const n = Math.max(1, Math.floor(count) || 1);
    switch ((interval || 'MONTH').trim().toUpperCase()) {
        case 'MINUTE':
            d.setUTCMinutes(d.getUTCMinutes() + n);
            break;
        case 'HOUR':
            d.setUTCHours(d.getUTCHours() + n);
            break;
        case 'WEEK':
            d.setUTCDate(d.getUTCDate() + 7 * n);
            break;
        case 'QUARTER':
            d.setUTCMonth(d.getUTCMonth() + 3 * n);
            break;
        case 'YEAR':
            d.setUTCFullYear(d.getUTCFullYear() + n);
            break;
        case 'MONTH':
        default:
            d.setUTCMonth(d.getUTCMonth() + n);
            break;
    }
    return d;
}

/** Paid window for one cycle starting at the work/booking timestamp. */
export function computePaidBillingPeriod(
    startIso: string,
    interval: string | null | undefined,
    count: number | null | undefined = 1
): { currentPeriodStart: string; currentPeriodEnd: string } {
    const startMs = Date.parse(startIso);
    const start = Number.isFinite(startMs) ? new Date(startMs) : new Date();
    const end = addBillingInterval(
        start,
        interval || 'MONTH',
        typeof count === 'number' && Number.isFinite(count) ? count : 1
    );
    return {
        currentPeriodStart: start.toISOString(),
        currentPeriodEnd: end.toISOString(),
    };
}

/**
 * Past-hire for recurring services: this cycle paid, job stays ongoing.
 * One-time services: completed + paid (unchanged).
 */
export function applyPastHireStatusFields(
    row: Record<string, unknown>,
    pastAt: string
): { recurring: boolean } {
    const details = bookingServiceDetailsRecord(row.serviceDetails);
    const recurring = isRecurringPricingType(
        details ? (details.pricing_type ?? details.pricingType)?.toString() : null
    );

    row.paymentCompleted = true;
    row.paymentType = 'admin';
    row.createdAt = pastAt;
    row.bookingDate = pastAt;

    if (!recurring) {
        row.status = 'completed';
        return { recurring: false };
    }

    const interval =
        typeof details?.billing_interval === 'string'
            ? details.billing_interval
            : typeof details?.billingInterval === 'string'
              ? details.billingInterval
              : 'MONTH';
    const countRaw = details?.billing_interval_count ?? details?.billingIntervalCount;
    const count =
        typeof countRaw === 'number'
            ? countRaw
            : typeof countRaw === 'string'
              ? Number.parseInt(countRaw, 10)
              : 1;

    const period = computePaidBillingPeriod(pastAt, interval, count);
    row.status = 'accepted';
    row.currentPeriodStart = period.currentPeriodStart;
    row.currentPeriodEnd = period.currentPeriodEnd;
    row.nextCycleDue = false;
    return { recurring: true };
}
