'use client';

import { forwardRef } from 'react';
import type { BookingAnomaly } from '@/lib/booking-display';
import {
    formatAnomalyShortLabel,
    getAnomalyCategoryLabel,
    groupBookingAnomaliesBySeverity,
} from '@/lib/booking-display';
import { cn } from '@/lib/utils';

interface BookingIssuesPanelProps {
    anomalies: BookingAnomaly[];
    highlighted?: boolean;
    id?: string;
}

export const BookingIssuesPanel = forwardRef<HTMLElement, BookingIssuesPanelProps>(
    function BookingIssuesPanel({ anomalies, highlighted = false, id }, ref) {
    if (anomalies.length === 0) return null;

    const groupedAnomalies = groupBookingAnomaliesBySeverity(anomalies);
    const errorCount = anomalies.filter((item) => item.severity === 'error').length;
    const warningCount = anomalies.length - errorCount;

    return (
        <section
            ref={ref}
            id={id}
            className={cn(
                'scroll-mt-4 rounded-lg border bg-white p-4 transition-shadow',
                highlighted
                    ? 'border-indigo-300 shadow-[0_0_0_3px_rgba(99,102,241,0.15)]'
                    : 'border-gray-200'
            )}
        >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                    <h3 className="text-base font-bold text-gray-900">Issues</h3>
                    <p className="mt-0.5 text-sm text-gray-500">
                        {anomalies.length} total
                        {errorCount > 0 && warningCount > 0
                            ? ` · ${errorCount} critical · ${warningCount} warning`
                            : errorCount > 0
                              ? ` · ${errorCount} critical`
                              : ` · ${warningCount} warning`}
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                {groupedAnomalies.map(({ severity, label, items }) => (
                    <div
                        key={severity}
                        className={cn(
                            'rounded-md border p-3',
                            severity === 'error'
                                ? 'border-rose-200 bg-rose-50/60'
                                : 'border-amber-200 bg-amber-50/60'
                        )}
                    >
                        <h4
                            className={cn(
                                'mb-3 text-xs font-bold uppercase tracking-wide',
                                severity === 'error' ? 'text-rose-800' : 'text-amber-900'
                            )}
                        >
                            {label}
                            <span className="ml-1.5 font-semibold normal-case tracking-normal text-gray-500">
                                ({items.length})
                            </span>
                        </h4>
                        <ul className="space-y-2">
                            {items.map((anomaly) => (
                                <li
                                    key={anomaly.id}
                                    className="rounded-md border border-white bg-white px-3 py-2.5 shadow-sm"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="text-sm font-semibold text-gray-900">
                                            {formatAnomalyShortLabel(anomaly.id)}
                                        </p>
                                        <span className="shrink-0 rounded-md bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200">
                                            {getAnomalyCategoryLabel(anomaly.category)}
                                        </span>
                                    </div>
                                    <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{anomaly.label}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    );
    }
);
