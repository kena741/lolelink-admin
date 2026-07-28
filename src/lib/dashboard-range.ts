export type DashboardRange = 'today' | '7d' | '30d' | 'all';

export function parseDashboardRange(value: string | null | undefined): DashboardRange | null {
    const normalized = (value ?? '').trim().toLowerCase();
    if (normalized === 'today' || normalized === '7d' || normalized === '30d' || normalized === 'all') {
        return normalized;
    }
    return null;
}

/** Matches dashboard payout-health date window (paymentDate || createdDate). */
export function isDateInDashboardRange(
    dateString: string | null | undefined,
    range: DashboardRange
): boolean {
    if (range === 'all') return true;
    if (!dateString) return false;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();
    if (range === 'today') {
        return (
            date.getFullYear() === now.getFullYear() &&
            date.getMonth() === now.getMonth() &&
            date.getDate() === now.getDate()
        );
    }

    const days = range === '7d' ? 7 : 30;
    const from = new Date();
    from.setDate(now.getDate() - days);
    return date >= from;
}

export function dashboardRangeLabel(range: DashboardRange): string {
    if (range === 'today') return 'Today';
    if (range === '7d') return 'Last 7 days';
    if (range === '30d') return 'Last 30 days';
    return 'All time';
}
