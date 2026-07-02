'use client';

import { useMemo } from 'react';
import { formatAdminDateTimeUtc } from '@/lib/admin-datetime';
import {
    buildDashboardRevenueTransactionLines,
    DASHBOARD_REVENUE_BUCKET_LABELS,
    DASHBOARD_REVENUE_CATEGORY_LABELS,
    sumDashboardRevenueTransactionLines,
    type DashboardBookingCommissionRow,
    type DashboardJobRequestRow,
    type DashboardRevenueCategory,
    type DashboardWalletRow,
} from '@/lib/dashboard-revenue-metrics';
import { Sheet, SheetBody, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface DashboardRevenueTransactionsSheetProps {
    open: boolean;
    category: DashboardRevenueCategory | null;
    onClose: () => void;
    walletRows: DashboardWalletRow[];
    bookings: DashboardBookingCommissionRow[];
    jobRequests: DashboardJobRequestRow[];
    rangeLabel: string;
}

function formatCurrency(value: number): string {
    return `ETB ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function bucketBadgeClass(bucket: keyof typeof DASHBOARD_REVENUE_BUCKET_LABELS): string {
    if (bucket === 'commission') return 'bg-chart-3/15 text-chart-3';
    if (bucket === 'activation_fee') return 'bg-primary/10 text-primary';
    if (bucket === 'boost_featured') return 'bg-chart-2/15 text-chart-2';
    if (bucket === 'customer_job_post') return 'bg-chart-4/15 text-chart-4';
    return 'bg-muted text-text-secondary';
}

export function DashboardRevenueTransactionsSheet({
    open,
    category,
    onClose,
    walletRows,
    bookings,
    jobRequests,
    rangeLabel,
}: DashboardRevenueTransactionsSheetProps) {
    const lines = useMemo(() => {
        if (!category) return [];
        return buildDashboardRevenueTransactionLines(category, {
            walletRows,
            bookings,
            jobRequests,
        });
    }, [bookings, category, jobRequests, walletRows]);

    const total = useMemo(() => sumDashboardRevenueTransactionLines(lines), [lines]);
    const title = category ? DASHBOARD_REVENUE_CATEGORY_LABELS[category] : 'Revenue';

    return (
        <Sheet open={open} onClose={onClose} widthClassName="w-full max-w-2xl lg:max-w-3xl">
            <SheetHeader onClose={onClose}>
                <SheetTitle>{title}</SheetTitle>
                <SheetDescription>
                    {rangeLabel} · {lines.length} transaction{lines.length === 1 ? '' : 's'}
                </SheetDescription>
            </SheetHeader>

            <SheetBody className="space-y-3 bg-gray-50/50">
                {lines.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-text-secondary">
                        No transactions in this period.
                    </div>
                ) : (
                    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                        {lines.map((line) => (
                            <li
                                key={line.id}
                                className="flex items-start justify-between gap-4 px-4 py-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="truncate text-sm font-semibold text-text-primary">
                                            {line.title}
                                        </p>
                                        {category === 'total' ? (
                                            <span
                                                className={cn(
                                                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                                    bucketBadgeClass(line.bucket)
                                                )}
                                            >
                                                {DASHBOARD_REVENUE_BUCKET_LABELS[line.bucket]}
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="mt-0.5 truncate text-xs text-text-secondary">
                                        {line.subtitle}
                                    </p>
                                    <p className="mt-1 text-[11px] tabular-nums text-text-secondary">
                                        {formatAdminDateTimeUtc(line.occurredAt)}
                                        <span aria-hidden="true"> · </span>
                                        <span className="font-mono">{line.reference}</span>
                                    </p>
                                </div>
                                <p className="shrink-0 text-sm font-bold tabular-nums text-text-primary">
                                    {formatCurrency(line.amount)}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </SheetBody>

            <SheetFooter className="justify-between">
                <span className="text-sm text-text-secondary">
                    {lines.length} item{lines.length === 1 ? '' : 's'}
                </span>
                <span className="text-sm font-bold tabular-nums text-text-primary">
                    Total {formatCurrency(total)}
                </span>
            </SheetFooter>
        </Sheet>
    );
}
