'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { WalletTransactionIssue } from '@/lib/wallet-transaction-issues';
import { getAdminStatusToneClasses } from '@/lib/admin-status-badge';
import { cn } from '@/lib/utils';

interface WalletTransactionIssuesCellProps {
    issues: WalletTransactionIssue[];
}

function IssueList({ issues }: { issues: WalletTransactionIssue[] }) {
    return (
        <ul className="space-y-1.5 text-left text-xs text-gray-700">
            {issues.map((issue) => (
                <li key={issue.id} className="flex items-start gap-2">
                    <span
                        className={cn(
                            'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                            issue.severity === 'error' ? 'bg-destructive' : 'bg-amber-500'
                        )}
                        aria-hidden
                    />
                    <span>{issue.label}</span>
                </li>
            ))}
        </ul>
    );
}

export function WalletTransactionIssuesCell({ issues }: WalletTransactionIssuesCellProps) {
    if (issues.length === 0) {
        return (
            <span className="inline-flex items-center text-gray-400" title="No issues">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                <span className="sr-only">No issues</span>
            </span>
        );
    }

    const hasError = issues.some((issue) => issue.severity === 'error');
    const errorCount = issues.filter((issue) => issue.severity === 'error').length;
    const warningCount = issues.length - errorCount;
    const summary = issues.map((issue) => issue.label).join(' · ');
    const countSummary = [
        errorCount > 0 ? `${errorCount} critical` : null,
        warningCount > 0 ? `${warningCount} warning` : null,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <details className="relative">
            <summary
                title={`${countSummary}: ${summary}`}
                aria-label={`${issues.length} wallet transaction issues. Click to read details.`}
                className={cn(
                    'inline-flex h-7 min-w-11 cursor-pointer list-none items-center justify-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-200 [&::-webkit-details-marker]:hidden',
                    hasError
                        ? getAdminStatusToneClasses('danger')
                        : getAdminStatusToneClasses('warning')
                )}
            >
                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                {issues.length}
            </summary>
            <div className="absolute left-0 z-20 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    {countSummary || `${issues.length} issue${issues.length === 1 ? '' : 's'}`}
                </p>
                <IssueList issues={issues} />
            </div>
        </details>
    );
}
