import { describe, expect, it } from 'vitest';
import {
    applyPastHireStatusFields,
    computePaidBillingPeriod,
} from '@/lib/recurring-payments';

describe('recurring past hire', () => {
    it('computes a one-month paid window from work date', () => {
        const period = computePaidBillingPeriod('2026-11-15T12:00:00.000Z', 'MONTH', 1);
        expect(period.currentPeriodStart).toBe('2026-11-15T12:00:00.000Z');
        expect(period.currentPeriodEnd).toBe('2026-12-15T12:00:00.000Z');
    });

    it('keeps recurring past hire active with this period paid', () => {
        const row: Record<string, unknown> = {
            serviceDetails: {
                pricing_type: 'RECURRING',
                billing_interval: 'MONTH',
                billing_interval_count: 1,
            },
        };
        const result = applyPastHireStatusFields(row, '2026-11-15T12:00:00.000Z');
        expect(result.recurring).toBe(true);
        expect(row.status).toBe('accepted');
        expect(row.paymentCompleted).toBe(true);
        expect(row.nextCycleDue).toBe(false);
        expect(row.currentPeriodStart).toBe('2026-11-15T12:00:00.000Z');
        expect(row.currentPeriodEnd).toBe('2026-12-15T12:00:00.000Z');
    });

    it('keeps one-time past hire completed', () => {
        const row: Record<string, unknown> = {
            serviceDetails: { pricing_type: 'ONE_TIME' },
        };
        const result = applyPastHireStatusFields(row, '2026-11-15T12:00:00.000Z');
        expect(result.recurring).toBe(false);
        expect(row.status).toBe('completed');
        expect(row.currentPeriodStart).toBeUndefined();
    });
});
