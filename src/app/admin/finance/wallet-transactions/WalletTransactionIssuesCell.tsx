'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { WalletTransactionIssue } from '@/lib/wallet-transaction-issues';
import { getAdminStatusToneClasses } from '@/lib/admin-status-badge';
import { cn } from '@/lib/utils';

interface WalletTransactionIssuesCellProps {
    issues: WalletTransactionIssue[];
}

function IssuePopover({
    issues,
    anchorRef,
    onClose,
}: {
    issues: WalletTransactionIssue[];
    anchorRef: React.RefObject<HTMLButtonElement | null>;
    onClose: () => void;
}) {
    const popoverId = useId();
    const popoverRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const [mounted, setMounted] = useState(false);

    const errorCount = issues.filter((issue) => issue.severity === 'error').length;
    const warningCount = issues.length - errorCount;
    const header =
        errorCount > 0 && warningCount > 0
            ? `${errorCount} critical · ${warningCount} warning`
            : errorCount > 0
              ? `${errorCount} critical`
              : `${warningCount} warning`;

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!anchorRef.current) return;

        function updatePosition() {
            const anchor = anchorRef.current;
            if (!anchor) return;

            const rect = anchor.getBoundingClientRect();
            const width = 320;
            const margin = 12;
            let left = rect.left;
            let top = rect.bottom + 8;

            if (left + width > window.innerWidth - margin) {
                left = window.innerWidth - width - margin;
            }
            if (left < margin) left = margin;

            const estimatedHeight = 56 + issues.length * 88;
            if (top + estimatedHeight > window.innerHeight - margin) {
                top = Math.max(margin, rect.top - estimatedHeight - 8);
            }

            setPosition({ top, left });
        }

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [anchorRef, issues.length]);

    useEffect(() => {
        function handlePointerDown(event: MouseEvent) {
            const target = event.target as Node;
            if (anchorRef.current?.contains(target)) return;
            if (popoverRef.current?.contains(target)) return;
            onClose();
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') onClose();
        }

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [anchorRef, onClose]);

    if (!mounted || !position) return null;

    return createPortal(
        <div
            ref={popoverRef}
            id={popoverId}
            role="dialog"
            aria-label="Wallet transaction issues"
            className="fixed z-120 w-80 rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
            style={{ top: position.top, left: position.left }}
        >
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-500">{header}</p>
            <ul className="max-h-72 space-y-2 overflow-y-auto">
                {issues.map((issue) => (
                    <li
                        key={issue.id}
                        className={cn(
                            'rounded-lg border px-3 py-2.5',
                            issue.severity === 'error'
                                ? 'border-rose-200 bg-rose-50/70'
                                : 'border-amber-200 bg-amber-50/70'
                        )}
                    >
                        <p
                            className={cn(
                                'text-sm font-semibold leading-snug',
                                issue.severity === 'error' ? 'text-rose-900' : 'text-amber-950'
                            )}
                        >
                            {issue.label}
                        </p>
                        {issue.detail ? (
                            <p className="mt-1.5 text-xs leading-relaxed text-gray-600">{issue.detail}</p>
                        ) : null}
                    </li>
                ))}
            </ul>
        </div>,
        document.body
    );
}

export function WalletTransactionIssuesCell({ issues }: WalletTransactionIssuesCellProps) {
    const [open, setOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

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
    const summary = [
        errorCount > 0 ? `${errorCount} critical` : null,
        warningCount > 0 ? `${warningCount} warning` : null,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                aria-expanded={open}
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen((current) => !current);
                }}
                title={`${summary}: ${issues.map((issue) => issue.label).join(' · ')}`}
                aria-label={`${issues.length} wallet transaction issues. Click to ${open ? 'hide' : 'show'} details.`}
                className={cn(
                    'inline-flex h-7 min-w-11 items-center justify-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-200',
                    hasError
                        ? cn(getAdminStatusToneClasses('danger'), 'hover:bg-destructive/15')
                        : cn(getAdminStatusToneClasses('warning'), 'hover:bg-amber-100')
                )}
            >
                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                {issues.length}
            </button>

            {open ? (
                <IssuePopover issues={issues} anchorRef={buttonRef} onClose={() => setOpen(false)} />
            ) : null}
        </>
    );
}
