'use client';

import type { ElementType, ReactNode } from 'react';
import Link from 'next/link';
import {
    AlertTriangle,
    CalendarCheck2,
    FileCheck2,
    Inbox,
    Wallet,
    Zap,
} from 'lucide-react';
import type { OpsCategory, OpsInboxItem } from '@/lib/ops-inbox';
import { formatOpsRelativeTime, getOpsCategoryLabel } from '@/lib/ops-inbox';
import { cn } from '@/lib/utils';

const CATEGORY_ICON: Record<OpsCategory, ElementType> = {
    finance: Wallet,
    documents: FileCheck2,
    bookings: CalendarCheck2,
    account: Zap,
    system: Inbox,
};

function categorySurfaceClass(category: OpsCategory, unread: boolean): string {
    if (!unread) return 'bg-muted/60 text-text-secondary';
    if (category === 'finance') return 'bg-primary/10 text-primary';
    if (category === 'documents') return 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200';
    if (category === 'bookings') return 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200';
    if (category === 'account') return 'bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200';
    return 'bg-muted text-text-primary';
}

export function OpsInboxRow({
    item,
    compact = false,
    onOpen,
    trailing,
}: {
    item: OpsInboxItem;
    compact?: boolean;
    onOpen?: (item: OpsInboxItem) => void;
    trailing?: ReactNode;
}) {
    const Icon = CATEGORY_ICON[item.category];
    const unread = !item.isRead;

    return (
        <div
            className={cn(
                'group flex gap-3 border-b border-border/80 transition-colors duration-150 last:border-b-0',
                compact ? 'px-3 py-2.5' : 'px-4 py-3.5',
                unread ? 'bg-card' : 'bg-muted/20',
                'hover:bg-muted/70'
            )}
        >
            <div
                className={cn(
                    'mt-0.5 inline-flex shrink-0 items-center justify-center rounded-md',
                    compact ? 'h-8 w-8' : 'h-9 w-9',
                    categorySurfaceClass(item.category, unread)
                )}
            >
                <Icon className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Link
                                href={item.href}
                                onClick={() => onOpen?.(item)}
                                className={cn(
                                    'truncate text-sm font-medium text-text-primary outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                    unread && 'font-semibold'
                                )}
                            >
                                {item.title}
                            </Link>
                            {item.severity === 'high' && unread ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
                                    <AlertTriangle className="h-3 w-3" />
                                    High
                                </span>
                            ) : null}
                        </div>
                        <p
                            className={cn(
                                'mt-0.5 text-sm leading-snug text-text-secondary',
                                compact ? 'line-clamp-1' : 'line-clamp-2'
                            )}
                        >
                            {item.body}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-text-hint">
                            <span className="font-medium text-text-secondary">
                                {getOpsCategoryLabel(item.category)}
                            </span>
                            <span aria-hidden>·</span>
                            <span>{item.metaLabel}</span>
                            {item.source === 'backlog' ? (
                                <>
                                    <span aria-hidden>·</span>
                                    <span className="font-medium text-primary">In queue</span>
                                </>
                            ) : null}
                            <span aria-hidden>·</span>
                            <time dateTime={item.createdAt ?? undefined}>
                                {formatOpsRelativeTime(item.createdAt)}
                            </time>
                        </div>
                    </div>
                    {trailing ? <div className="flex shrink-0 items-center gap-1">{trailing}</div> : null}
                </div>
            </div>
        </div>
    );
}
