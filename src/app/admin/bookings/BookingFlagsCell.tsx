'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { BookedService } from '@/features/bookedService/bookedServiceSlice';
import { getBookingAnomalies } from '@/lib/booking-display';
import { cn } from '@/lib/utils';

interface BookingFlagsCellProps {
    booking: BookedService;
    onOpenIssues: (bookingId: string) => void;
}

export function BookingFlagsCell({ booking, onOpenIssues }: BookingFlagsCellProps) {
    const anomalies = getBookingAnomalies(booking as unknown as Record<string, unknown>);

    if (anomalies.length === 0) {
        return (
            <span className="inline-flex items-center text-gray-400" title="No issues">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                <span className="sr-only">No issues</span>
            </span>
        );
    }

    const hasError = anomalies.some((item) => item.severity === 'error');
    const errorCount = anomalies.filter((item) => item.severity === 'error').length;
    const warningCount = anomalies.length - errorCount;
    const summary = [
        errorCount > 0 ? `${errorCount} critical` : null,
        warningCount > 0 ? `${warningCount} warning` : null,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <button
            type="button"
            onClick={(event) => {
                event.stopPropagation();
                onOpenIssues(booking.id);
            }}
            title={`View ${anomalies.length} issue${anomalies.length === 1 ? '' : 's'}: ${summary}`}
            aria-label={`View ${anomalies.length} booking issues in detail panel`}
            className={cn(
                'inline-flex h-7 min-w-[2.75rem] items-center justify-center gap-1 rounded-full px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-200',
                hasError
                    ? 'bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100'
                    : 'bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100'
            )}
        >
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
            {anomalies.length}
        </button>
    );
}
