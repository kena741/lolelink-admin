'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    CheckCheck,
    Inbox,
    RefreshCw,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import { OpsInboxRow } from '@/components/ops-inbox/OpsInboxRow';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
    fetchNotifications,
    markNotificationRead,
    markNotificationsReadBulk,
    deleteNotification,
    deleteNotificationsBulk,
} from '@/features/notification/notificationSlice';
import { fetchPayoutRequests } from '@/features/payout/payoutSlice';
import { fetchVerifyDocuments } from '@/features/verifyDocuments/verifyDocumentsSlice';
import {
    buildOpsInbox,
    countOpsInbox,
    filterOpsInbox,
    getOpsCategoryLabel,
    opsNotificationIds,
    type OpsCategory,
    type OpsCategoryFilter,
    type OpsInboxItem,
    type OpsStatusFilter,
} from '@/lib/ops-inbox';
import { cn } from '@/lib/utils';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';

const STATUS_TABS: Array<{ id: OpsStatusFilter; label: string }> = [
    { id: 'needs', label: 'Needs attention' },
    { id: 'all', label: 'All' },
    { id: 'done', label: 'Cleared alerts' },
];

const CATEGORY_TABS: Array<{ id: OpsCategoryFilter; label: string }> = [
    { id: 'all', label: 'All queues' },
    { id: 'finance', label: 'Finance' },
    { id: 'documents', label: 'Documents' },
    { id: 'bookings', label: 'Bookings' },
    { id: 'account', label: 'Account' },
    { id: 'system', label: 'System' },
];

export default function NotificationsPage() {
    const dispatch = useAppDispatch();
    const { canWriteNotifications } = useAdminPermissions();
    const {
        items: notifications,
        loading: notificationsLoading,
        error,
    } = useAppSelector((state) => state.notification);
    const payouts = useAppSelector((state) => state.payout.requests);
    const payoutsLoading = useAppSelector((state) => state.payout.loading);
    const documents = useAppSelector((state) => state.verifyDocuments.documents);
    const documentsLoading = useAppSelector((state) => state.verifyDocuments.loading);

    const [statusFilter, setStatusFilter] = useState<OpsStatusFilter>('needs');
    const [categoryFilter, setCategoryFilter] = useState<OpsCategoryFilter>('all');
    const [searchValue, setSearchValue] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        dispatch(fetchNotifications());
        dispatch(fetchPayoutRequests());
        dispatch(fetchVerifyDocuments());
    }, [dispatch]);

    const queue = useMemo(
        () =>
            buildOpsInbox({
                notifications,
                payouts,
                documents,
            }),
        [notifications, payouts, documents]
    );

    const counts = useMemo(() => countOpsInbox(queue), [queue]);

    const filteredItems = useMemo(
        () =>
            filterOpsInbox(queue, {
                status: statusFilter,
                category: categoryFilter,
                search: searchValue,
            }),
        [queue, statusFilter, categoryFilter, searchValue]
    );

    const loading = notificationsLoading || payoutsLoading || documentsLoading;
    const markableUnreadIds = useMemo(() => opsNotificationIds(filteredItems), [filteredItems]);

    const selectableIds = useMemo(
        () =>
            filteredItems
                .filter((item) => item.notificationId)
                .map((item) => item.notificationId as string),
        [filteredItems]
    );

    const areAllSelected =
        selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

    function onRefresh() {
        dispatch(fetchNotifications());
        dispatch(fetchPayoutRequests());
        dispatch(fetchVerifyDocuments());
    }

    async function onMarkRead(item: OpsInboxItem) {
        if (!item.canMarkRead || !item.notificationId || item.isRead) return;
        await dispatch(markNotificationRead({ id: item.notificationId }));
    }

    async function onMarkFilteredRead() {
        if (markableUnreadIds.length === 0) return;
        await dispatch(markNotificationsReadBulk({ ids: markableUnreadIds }));
    }

    async function onDeleteOne(notificationId: string) {
        await dispatch(deleteNotification({ id: notificationId }));
        setSelectedIds((prev) => prev.filter((id) => id !== notificationId));
    }

    async function onDeleteSelected() {
        if (selectedIds.length === 0) return;
        await dispatch(deleteNotificationsBulk({ ids: selectedIds }));
        setSelectedIds([]);
    }

    function toggleSelectAll() {
        if (areAllSelected) {
            setSelectedIds((prev) => prev.filter((id) => !selectableIds.includes(id)));
            return;
        }
        setSelectedIds(Array.from(new Set([...selectedIds, ...selectableIds])));
    }

    function toggleSelectOne(id: string) {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
        );
    }

    const statusCounts: Record<OpsStatusFilter, number> = {
        needs: counts.needsAttention,
        all: queue.length,
        done: queue.filter((item) => item.isRead).length,
    };

    const categoryCounts = (id: OpsCategoryFilter): number => {
        if (id === 'all') return counts.needsAttention;
        return counts.byCategory[id as OpsCategory];
    };

    return (
        <AuthGuard>
            <div className="flex min-h-screen">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen bg-background">
                    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
                        <AdminPageHeader
                            title="Ops inbox"
                            description="Work waiting on operations — payouts, documents, and system alerts."
                            actions={
                                <>
                                    {canWriteNotifications && (
                                        <button
                                            type="button"
                                            onClick={() => void onMarkFilteredRead()}
                                            disabled={markableUnreadIds.length === 0 || loading}
                                            className={adminHeaderButtonClassName()}
                                        >
                                            <CheckCheck className="h-4 w-4" />
                                            Clear alerts
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={onRefresh}
                                        disabled={loading}
                                        className={adminHeaderButtonClassName()}
                                    >
                                        <RefreshCw
                                            className={cn('h-4 w-4', loading && 'animate-spin')}
                                        />
                                        Refresh
                                    </button>
                                </>
                            }
                        />

                        <section className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
                            <div>
                                <p className="font-heading text-2xl font-semibold tracking-tight text-text-primary tabular-nums">
                                    {counts.needsAttention}
                                </p>
                                <p className="mt-0.5 text-sm text-text-secondary">
                                    {counts.needsAttention === 0
                                        ? 'Queue is clear'
                                        : counts.highSeverity > 0
                                          ? `${counts.highSeverity} high priority · act first`
                                          : 'Items need a decision or review'}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[12px] text-text-secondary">
                                <span className="rounded-md border border-border bg-card px-2.5 py-1 font-medium">
                                    Finance {counts.byCategory.finance}
                                </span>
                                <span className="rounded-md border border-border bg-card px-2.5 py-1 font-medium">
                                    Documents {counts.byCategory.documents}
                                </span>
                                <span className="rounded-md border border-border bg-card px-2.5 py-1 font-medium">
                                    Other{' '}
                                    {counts.byCategory.bookings +
                                        counts.byCategory.account +
                                        counts.byCategory.system}
                                </span>
                            </div>
                        </section>

                        <div className="mb-4 flex flex-col gap-3">
                            <div
                                role="tablist"
                                aria-label="Inbox status"
                                className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1"
                            >
                                {STATUS_TABS.map((tab) => {
                                    const selected = statusFilter === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            role="tab"
                                            aria-selected={selected}
                                            onClick={() => setStatusFilter(tab.id)}
                                            className={cn(
                                                'inline-flex h-9 items-center gap-2 rounded-[calc(var(--radius)-2px)] px-3 text-sm font-medium transition-colors duration-150',
                                                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                selected
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'text-text-secondary hover:bg-muted hover:text-text-primary'
                                            )}
                                        >
                                            {tab.label}
                                            <span
                                                className={cn(
                                                    'tabular-nums text-[12px]',
                                                    selected
                                                        ? 'text-primary-foreground/85'
                                                        : 'text-text-hint'
                                                )}
                                            >
                                                {statusCounts[tab.id]}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div
                                    role="tablist"
                                    aria-label="Queue category"
                                    className="flex flex-wrap gap-1.5"
                                >
                                    {CATEGORY_TABS.map((tab) => {
                                        const selected = categoryFilter === tab.id;
                                        const count =
                                            statusFilter === 'needs'
                                                ? categoryCounts(tab.id)
                                                : tab.id === 'all'
                                                  ? queue.length
                                                  : queue.filter((i) => i.category === tab.id)
                                                        .length;
                                        return (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                role="tab"
                                                aria-selected={selected}
                                                onClick={() => setCategoryFilter(tab.id)}
                                                className={cn(
                                                    'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors duration-150',
                                                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                    selected
                                                        ? 'border-primary/30 bg-primary/10 text-primary'
                                                        : 'border-border bg-card text-text-secondary hover:bg-muted hover:text-text-primary'
                                                )}
                                            >
                                                {tab.label}
                                                <span className="tabular-nums text-text-hint">
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="relative w-full sm:max-w-xs">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-hint" />
                                    <input
                                        value={searchValue}
                                        onChange={(event) => setSearchValue(event.target.value)}
                                        placeholder="Search queue…"
                                        className="h-9 w-full rounded-md border border-border bg-card py-2 pl-9 pr-9 text-sm text-text-primary outline-none transition-shadow placeholder:text-text-hint focus:ring-2 focus:ring-ring"
                                    />
                                    {searchValue.trim() ? (
                                        <button
                                            type="button"
                                            onClick={() => setSearchValue('')}
                                            className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-text-hint hover:bg-muted hover:text-text-primary"
                                            aria-label="Clear search"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    ) : null}
                                </div>
                            </div>

                            {canWriteNotifications && selectableIds.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={toggleSelectAll}
                                        className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-[13px] font-medium text-text-primary transition-colors hover:bg-muted"
                                    >
                                        {areAllSelected ? 'Unselect alerts' : 'Select alerts'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void onDeleteSelected()}
                                        disabled={selectedIds.length === 0}
                                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete ({selectedIds.length})
                                    </button>
                                </div>
                            ) : null}
                        </div>

                        {error ? (
                            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                                {error}
                            </div>
                        ) : null}

                        {loading && filteredItems.length === 0 ? (
                            <div className="space-y-0 overflow-hidden rounded-md border border-border bg-card">
                                {Array.from({ length: 5 }).map((_, index) => (
                                    <div
                                        key={index}
                                        className="flex gap-3 border-b border-border/80 px-4 py-3.5 last:border-b-0"
                                    >
                                        <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-4 w-40 max-w-full animate-pulse rounded bg-muted" />
                                            <div className="h-3 w-56 max-w-full animate-pulse rounded bg-muted" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        {!loading && filteredItems.length === 0 ? (
                            <div className="rounded-md border border-border bg-card px-6 py-16 text-center">
                                <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
                                    <Inbox className="h-6 w-6" />
                                </div>
                                <h2 className="font-heading text-lg font-semibold text-text-primary">
                                    {statusFilter === 'needs'
                                        ? "You're clear"
                                        : 'No matching items'}
                                </h2>
                                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-secondary">
                                    {statusFilter === 'needs'
                                        ? 'No pending payouts, document reviews, or ops alerts. Come back when the queue builds.'
                                        : 'Try another status, category, or search term.'}
                                </p>
                                {statusFilter === 'needs' ? (
                                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                                        <Link
                                            href="/admin/finance/payout-request"
                                            className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-text-primary transition-colors hover:bg-muted"
                                        >
                                            Payouts
                                        </Link>
                                        <Link
                                            href="/admin/verify-documents"
                                            className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-text-primary transition-colors hover:bg-muted"
                                        >
                                            Documents
                                        </Link>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        {filteredItems.length > 0 ? (
                            <div className="overflow-hidden rounded-md border border-border bg-card">
                                {filteredItems.map((item) => {
                                    const selected = item.notificationId
                                        ? selectedIds.includes(item.notificationId)
                                        : false;

                                    return (
                                        <OpsInboxRow
                                            key={item.id}
                                            item={item}
                                            onOpen={(opened) => {
                                                void onMarkRead(opened);
                                            }}
                                            trailing={
                                                item.notificationId ? (
                                                    <div className="flex items-center gap-1">
                                                        {canWriteNotifications ? (
                                                            <input
                                                                type="checkbox"
                                                                checked={selected}
                                                                onChange={() =>
                                                                    toggleSelectOne(
                                                                        item.notificationId as string
                                                                    )
                                                                }
                                                                className="h-4 w-4 rounded border-border accent-primary"
                                                                aria-label={`Select ${item.title}`}
                                                            />
                                                        ) : null}
                                                        {canWriteNotifications && !item.isRead && item.canMarkRead ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => void onMarkRead(item)}
                                                                className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2 text-[12px] font-medium text-text-primary transition-colors hover:bg-muted"
                                                            >
                                                                Done
                                                            </button>
                                                        ) : null}
                                                        {canWriteNotifications ? (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    void onDeleteOne(
                                                                        item.notificationId as string
                                                                    )
                                                                }
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-hint transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                                                                aria-label="Remove alert"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                ) : (
                                                    <Link
                                                        href={item.href}
                                                        className="inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-accent"
                                                    >
                                                        Open
                                                    </Link>
                                                )
                                            }
                                        />
                                    );
                                })}
                            </div>
                        ) : null}

                        {filteredItems.length > 0 && categoryFilter !== 'all' ? (
                            <p className="mt-3 text-[12px] text-text-hint">
                                Showing {getOpsCategoryLabel(categoryFilter as OpsCategory)} queue
                                · backlog items clear when resolved in their module
                            </p>
                        ) : null}
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
}
