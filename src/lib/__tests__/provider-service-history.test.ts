import { describe, expect, it } from 'vitest';
import {
    annotateHiredBefore,
    buildPastHireDescription,
    isPastHireDescription,
    summarizeServiceHistory,
} from '@/lib/provider-service-history';

function row(
    id: string,
    customerId: string,
    status: string,
    createdAt: string,
    amount = 100
) {
    return { id, customerId, status, createdAt, amount };
}

describe('provider-service-history', () => {
    it('tags past-hire descriptions', () => {
        expect(isPastHireDescription(buildPastHireDescription('Offline'))).toBe(true);
        expect(isPastHireDescription('normal note')).toBe(false);
    });

    it('marks later bookings hired-before after a completed job', () => {
        const annotated = annotateHiredBefore([
            row('b2', 'c1', 'pending', '2024-02-01'),
            row('b1', 'c1', 'completed', '2024-01-01'),
            row('b3', 'c2', 'completed', '2024-01-15'),
        ]);

        const byId = Object.fromEntries(annotated.map((item) => [item.id, item]));
        expect(byId.b1.hiredBefore).toBe(false);
        expect(byId.b1.priorCompletedCount).toBe(0);
        expect(byId.b2.hiredBefore).toBe(true);
        expect(byId.b2.priorCompletedCount).toBe(1);
        expect(byId.b3.hiredBefore).toBe(false);
    });

    it('summarizes repeat customers and revenue', () => {
        const annotated = annotateHiredBefore([
            row('a', 'c1', 'completed', '2024-01-01', 50),
            row('b', 'c1', 'completed', '2024-02-01', 70),
            row('c', 'c2', 'rejected', '2024-02-02', 20),
            row('d', 'c2', 'accepted', '2024-03-01', 30),
        ]);
        const { stats, repeatCustomers } = summarizeServiceHistory(annotated);

        expect(stats.bookingCount).toBe(4);
        expect(stats.completedCount).toBe(2);
        expect(stats.rejectedCount).toBe(1);
        expect(stats.activeCount).toBe(1);
        expect(stats.uniqueCustomers).toBe(2);
        expect(stats.hiredBeforeCustomers).toBe(1);
        expect(stats.hiredBeforeBookings).toBe(1);
        expect(stats.completedRevenue).toBe(120);
        expect(repeatCustomers).toHaveLength(1);
        expect(repeatCustomers[0]?.customerId).toBe('c1');
        expect(repeatCustomers[0]?.completedCount).toBe(2);
    });
});
