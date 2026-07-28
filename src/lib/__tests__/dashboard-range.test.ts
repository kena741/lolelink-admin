import { describe, expect, it } from 'vitest';
import { isDateInDashboardRange } from '@/lib/dashboard-range';

describe('dashboard-range', () => {
    it('includes recent dates in 30d window and excludes older', () => {
        const now = new Date();
        const recent = new Date(now);
        recent.setDate(now.getDate() - 5);
        const old = new Date(now);
        old.setDate(now.getDate() - 40);

        expect(isDateInDashboardRange(recent.toISOString(), '30d')).toBe(true);
        expect(isDateInDashboardRange(old.toISOString(), '30d')).toBe(false);
        expect(isDateInDashboardRange(old.toISOString(), 'all')).toBe(true);
    });
});
