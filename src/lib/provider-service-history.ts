/** Prefix stored on booked_service.description for admin-logged past hires. */
export const PAST_HIRE_DESCRIPTION_PREFIX = '[Past hire]';

export function isPastHireDescription(description: string | null | undefined): boolean {
    return (description ?? '').trimStart().startsWith(PAST_HIRE_DESCRIPTION_PREFIX);
}

export function buildPastHireDescription(note: string): string {
    const trimmed = note.trim();
    return trimmed
        ? `${PAST_HIRE_DESCRIPTION_PREFIX} ${trimmed}`
        : `${PAST_HIRE_DESCRIPTION_PREFIX} Logged by admin`;
}

export interface ServiceHistoryBookingInput {
    id: string;
    customerId: string;
    status: string;
    createdAt: string;
    amount: number;
}

export interface ServiceHistoryAnnotatedBooking extends ServiceHistoryBookingInput {
    hiredBefore: boolean;
    priorCompletedCount: number;
}

export interface ServiceHistoryRepeatCustomer {
    customerId: string;
    completedCount: number;
    bookingCount: number;
    totalSpent: number;
    firstBookingAt: string;
    lastBookingAt: string;
}

export interface ServiceHistoryStats {
    bookingCount: number;
    completedCount: number;
    rejectedCount: number;
    activeCount: number;
    uniqueCustomers: number;
    hiredBeforeCustomers: number;
    hiredBeforeBookings: number;
    completedRevenue: number;
    firstBookingAt: string | null;
    lastBookingAt: string | null;
}

const COMPLETED = 'completed';
const REJECTED = 'rejected';
const ACTIVE = new Set([
    'pending',
    'accepted',
    'on_the_way',
    'in_progress',
    'hold',
    'pending_extra_payment',
    'pending_approval',
    'admin_paid',
]);

function sortKey(createdAt: string): number {
    const ms = Date.parse(createdAt);
    return Number.isFinite(ms) ? ms : 0;
}

/** Chronological hired-before: customer already completed ≥1 job with this provider before this booking. */
export function annotateHiredBefore<T extends ServiceHistoryBookingInput>(
    rows: T[]
): Array<T & { hiredBefore: boolean; priorCompletedCount: number }> {
    const chronological = [...rows].sort((a, b) => {
        const diff = sortKey(a.createdAt) - sortKey(b.createdAt);
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id);
    });

    const completedBefore = new Map<string, number>();
    const byId = new Map<string, { hiredBefore: boolean; priorCompletedCount: number }>();

    for (const row of chronological) {
        const customerId = row.customerId.trim();
        const prior = customerId ? completedBefore.get(customerId) ?? 0 : 0;
        byId.set(row.id, { hiredBefore: prior > 0, priorCompletedCount: prior });
        if (customerId && row.status === COMPLETED) {
            completedBefore.set(customerId, prior + 1);
        }
    }

    return rows.map((row) => {
        const meta = byId.get(row.id) ?? { hiredBefore: false, priorCompletedCount: 0 };
        return { ...row, ...meta };
    });
}

export function summarizeServiceHistory(
    rows: Array<ServiceHistoryAnnotatedBooking>
): { stats: ServiceHistoryStats; repeatCustomers: ServiceHistoryRepeatCustomer[] } {
    const customerAgg = new Map<
        string,
        {
            completedCount: number;
            bookingCount: number;
            totalSpent: number;
            firstBookingAt: string;
            lastBookingAt: string;
        }
    >();

    let completedCount = 0;
    let rejectedCount = 0;
    let activeCount = 0;
    let hiredBeforeBookings = 0;
    let completedRevenue = 0;
    let firstBookingAt: string | null = null;
    let lastBookingAt: string | null = null;

    for (const row of rows) {
        if (row.status === COMPLETED) {
            completedCount += 1;
            completedRevenue += row.amount;
        } else if (row.status === REJECTED) {
            rejectedCount += 1;
        } else if (ACTIVE.has(row.status)) {
            activeCount += 1;
        }

        if (row.hiredBefore) hiredBeforeBookings += 1;

        if (row.createdAt) {
            if (!firstBookingAt || sortKey(row.createdAt) < sortKey(firstBookingAt)) {
                firstBookingAt = row.createdAt;
            }
            if (!lastBookingAt || sortKey(row.createdAt) > sortKey(lastBookingAt)) {
                lastBookingAt = row.createdAt;
            }
        }

        const customerId = row.customerId.trim();
        if (!customerId) continue;

        const existing = customerAgg.get(customerId);
        if (!existing) {
            customerAgg.set(customerId, {
                completedCount: row.status === COMPLETED ? 1 : 0,
                bookingCount: 1,
                totalSpent: row.status === COMPLETED ? row.amount : 0,
                firstBookingAt: row.createdAt,
                lastBookingAt: row.createdAt,
            });
            continue;
        }

        existing.bookingCount += 1;
        if (row.status === COMPLETED) {
            existing.completedCount += 1;
            existing.totalSpent += row.amount;
        }
        if (sortKey(row.createdAt) < sortKey(existing.firstBookingAt)) {
            existing.firstBookingAt = row.createdAt;
        }
        if (sortKey(row.createdAt) > sortKey(existing.lastBookingAt)) {
            existing.lastBookingAt = row.createdAt;
        }
    }

    const repeatCustomers = [...customerAgg.entries()]
        .filter(([, agg]) => agg.completedCount >= 2)
        .map(([customerId, agg]) => ({
            customerId,
            completedCount: agg.completedCount,
            bookingCount: agg.bookingCount,
            totalSpent: Math.round(agg.totalSpent * 100) / 100,
            firstBookingAt: agg.firstBookingAt,
            lastBookingAt: agg.lastBookingAt,
        }))
        .sort((a, b) => b.completedCount - a.completedCount || b.totalSpent - a.totalSpent);

    return {
        stats: {
            bookingCount: rows.length,
            completedCount,
            rejectedCount,
            activeCount,
            uniqueCustomers: customerAgg.size,
            hiredBeforeCustomers: repeatCustomers.length,
            hiredBeforeBookings,
            completedRevenue: Math.round(completedRevenue * 100) / 100,
            firstBookingAt,
            lastBookingAt,
        },
        repeatCustomers,
    };
}
