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
