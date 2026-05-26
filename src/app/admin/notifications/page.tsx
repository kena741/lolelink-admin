"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import {
    Bell,
    CalendarCheck2,
    CheckCheck,
    CheckCircle2,
    Clock3,
    ExternalLink,
    RefreshCw,
    Search,
    Trash2,
    User,
    Wallet,
    X,
    XCircle,
    Zap,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchAllBookings } from "@/features/bookedService/bookedServiceSlice";
import { fetchProviders } from "@/features/provider/providerSlice";
import { fetchAllCustomers } from "@/features/customer/customerSlice";
import {
    fetchNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    deleteNotification,
    deleteNotificationsBulk,
    NotificationItem,
} from "@/features/notification/notificationSlice";
import { cn } from "@/lib/utils";

interface ReadFilterOption {
    id: "all" | "unread" | "read";
    label: string;
    count: number;
}

interface NotificationVisualMeta {
    icon: React.ElementType;
    accentClass: string;
    badgeClass: string;
}

function getNotificationTypeLabel(value?: string | null): string {
    if (!value) return "Update";
    return value
        .split("_")
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(" ");
}

function getNotificationVisualMeta(notification: NotificationItem): NotificationVisualMeta {
    const combined = `${notification.type ?? ""} ${notification.title ?? ""} ${notification.description ?? ""}`.toLowerCase();

    if (/(reject|cancel|fail|error|decline)/.test(combined)) {
        return {
            icon: XCircle,
            accentClass: "border-l-destructive bg-destructive/5",
            badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
        };
    }
    if (/(payout|withdraw|payment|wallet|activation)/.test(combined)) {
        return {
            icon: Wallet,
            accentClass: "border-l-primary bg-primary/5",
            badgeClass: "border-primary/30 bg-primary/10 text-foreground",
        };
    }
    if (/(accept|approved|complete|success|done)/.test(combined)) {
        return {
            icon: CheckCircle2,
            accentClass: "border-l-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/20",
            badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
        };
    }
    if (/(booking|request|assign|job)/.test(combined)) {
        return {
            icon: CalendarCheck2,
            accentClass: "border-l-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/20",
            badgeClass: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
        };
    }
    if (/(pending|review|hold|wait)/.test(combined)) {
        return {
            icon: Clock3,
            accentClass: "border-l-amber-500 bg-amber-50/70 dark:bg-amber-950/20",
            badgeClass: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
        };
    }
    return {
        icon: Bell,
        accentClass: "border-l-border bg-card",
        badgeClass: "border-border bg-secondary text-foreground",
    };
}

function getNotificationMessage(notification: NotificationItem): string {
    if (notification.description && notification.description.trim().length > 0) return notification.description;
    return "A new activity needs your attention.";
}

function formatDisplayName(first?: string, last?: string): string | null {
    const fullName = [first, last].filter(Boolean).join(" ").trim();
    if (fullName.length === 0) return null;
    return fullName;
}

function formatRelativeTime(value?: string | null): string {
    if (!value) return "Unknown time";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown time";

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatAdminMessage(baseMessage: string, customerName?: string | null, providerName?: string | null): string {
    let message = baseMessage
        .replace(/^good news!\s*/i, "")
        .replace(/^great news!\s*/i, "")
        .replace(/\byour booking\b/gi, customerName ? `${customerName}'s booking` : "Customer booking")
        .replace(/\byour service request\b/gi, customerName ? `${customerName}'s service request` : "Customer service request")
        .replace(/\bthey'll\b/gi, "the provider will");

    const acceptedMatch = message.match(/service request for\s+(.+?)\s+has been accepted by\s+(.+?)\.\s*the provider will be starting soon!?/i);
    if (acceptedMatch) {
        const serviceName = acceptedMatch[1]?.trim();
        const detectedProvider = acceptedMatch[2]?.trim();
        const finalProvider = providerName || detectedProvider;
        return `${customerName ? `${customerName}'s ` : ""}service request for ${serviceName} was accepted by provider ${finalProvider} and is expected to start soon.`;
    }

    if (providerName) {
        message = message.replace(/\bhas been assigned to\s+[A-Za-z0-9 ._-]+/gi, `has been assigned to provider ${providerName}`);
        message = message.replace(/\bassigned to\s+[A-Za-z0-9 ._-]+/gi, `assigned to provider ${providerName}`);
        message = message.replace(/\baccepted by\s+[A-Za-z0-9 ._-]+/gi, `accepted by provider ${providerName}`);
    }
    return message;
}

export default function NotificationsPage() {
    const dispatch = useAppDispatch();
    const { items, loading, error } = useAppSelector((state) => state.notification);
    const bookings = useAppSelector((state) => state.bookedService.items);
    const providers = useAppSelector((state) => state.provider.providers);
    const customers = useAppSelector((state) => state.customer.customers);
    const [searchValue, setSearchValue] = useState("");
    const [readFilter, setReadFilter] = useState<ReadFilterOption["id"]>("all");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        dispatch(fetchNotifications());
        dispatch(fetchAllBookings());
        dispatch(fetchProviders());
        dispatch(fetchAllCustomers());
    }, [dispatch]);

    const unreadCount = useMemo(
        () => items.filter((item) => !item.is_read).length,
        [items]
    );
    const readCount = useMemo(
        () => items.filter((item) => item.is_read).length,
        [items]
    );
    const bookingMap = useMemo(() => {
        const map = new Map<string, (typeof bookings)[number]>();
        bookings.forEach((booking) => {
            map.set(booking.id, booking);
        });
        return map;
    }, [bookings]);
    const providerMap = useMemo(() => {
        const map = new Map<string, (typeof providers)[number]>();
        providers.forEach((provider) => {
            map.set(provider.id, provider);
        });
        return map;
    }, [providers]);
    const customerMap = useMemo(() => {
        const map = new Map<string, (typeof customers)[number]>();
        customers.forEach((customer) => {
            if (customer.id) map.set(customer.id, customer);
        });
        return map;
    }, [customers]);

    const onRefresh = () => {
        dispatch(fetchNotifications());
    };

    const onMarkRead = async (notificationId: string) => {
        await dispatch(markNotificationRead({ id: notificationId }));
    };

    const onMarkAllRead = async () => {
        await dispatch(markAllNotificationsRead());
    };

    const onDeleteOne = async (notificationId: string) => {
        await dispatch(deleteNotification({ id: notificationId }));
        setSelectedIds((prev) => prev.filter((id) => id !== notificationId));
    };

    const onDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        await dispatch(deleteNotificationsBulk({ ids: selectedIds }));
        setSelectedIds([]);
    };

    const normalizedSearch = useMemo(
        () => searchValue.trim().toLowerCase(),
        [searchValue]
    );

    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            if (readFilter === "unread" && item.is_read) return false;
            if (readFilter === "read" && !item.is_read) return false;

            if (!normalizedSearch) return true;

            const haystack = [
                item.title ?? "",
                item.description ?? "",
                item.type ?? "",
            ]
                .join(" ")
                .toLowerCase();

            return haystack.includes(normalizedSearch);
        });
    }, [items, normalizedSearch, readFilter]);

    const areAllFilteredSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedIds.includes(item.id));

    const toggleSelectAllFiltered = () => {
        if (areAllFilteredSelected) {
            const filteredIdSet = new Set(filteredItems.map((item) => item.id));
            setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
            return;
        }
        const merged = new Set([...selectedIds, ...filteredItems.map((item) => item.id)]);
        setSelectedIds(Array.from(merged));
    };

    const toggleSelectOne = (id: string) => {
        setSelectedIds((prev) => prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]);
    };

    const filterOptions = useMemo<ReadFilterOption[]>(
        () => [
            { id: "all", label: "All", count: items.length },
            { id: "unread", label: "Unread", count: unreadCount },
            { id: "read", label: "Read", count: readCount },
        ],
        [items.length, unreadCount, readCount]
    );

    const hasActiveFilters = readFilter !== "all" || normalizedSearch.length > 0;

    return (
        <AuthGuard>
            <div className="flex min-h-screen bg-background">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    <div className="relative isolate overflow-hidden bg-primary transition-colors dark:!bg-sidebar dark:border-b dark:border-sidebar-border">
                        <div className="relative mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-8">
                            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <div className="mb-2 flex items-center gap-3">
                                        <div className="rounded-lg bg-card/15 p-2 backdrop-blur-sm">
                                            <Bell className="h-6 w-6 text-primary-foreground" />
                                        </div>
                                        <h1 className="text-3xl font-bold tracking-tight text-primary-foreground drop-shadow-lg sm:text-4xl">
                                            Notifications
                                        </h1>
                                    </div>
                                    <p className="max-w-2xl text-sm text-primary-foreground/90 sm:text-base">
                                        Track operational updates and respond quickly to new activity.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={onMarkAllRead}
                                        disabled={unreadCount === 0 || loading}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-card/15 px-4 text-sm font-semibold text-primary-foreground ring-2 ring-primary-foreground/20 backdrop-blur-md transition-all duration-200 hover:bg-card/25 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <CheckCheck className="h-4 w-4" />
                                        Mark all read
                                    </button>
                                    <button
                                        onClick={onRefresh}
                                        disabled={loading}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-card/15 px-4 text-sm font-semibold text-primary-foreground ring-2 ring-primary-foreground/20 backdrop-blur-md transition-all duration-200 hover:bg-card/25 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                                        Refresh
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                            {filterOptions.map((option) => {
                                const selected = readFilter === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setReadFilter(option.id)}
                                        className={cn(
                                            "rounded-2xl border p-5 text-left shadow-sm transition-all duration-200",
                                            selected
                                                ? "border-indigo-300 bg-gradient-to-br from-indigo-50 to-white ring-2 ring-indigo-200 dark:border-indigo-700 dark:from-indigo-950/30 dark:to-card dark:ring-indigo-900"
                                                : "border-border/80 bg-card hover:border-indigo-200 hover:shadow-md"
                                        )}
                                    >
                                        <p className="text-sm font-medium text-muted-foreground">{option.label}</p>
                                        <p className="mt-1 text-3xl font-bold text-foreground">{option.count}</p>
                                    </button>
                                );
                            })}
                        </section>

                        <div className="mb-6 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div className="relative w-full lg:max-w-md">
                                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        value={searchValue}
                                        onChange={(event) => setSearchValue(event.target.value)}
                                        placeholder="Search title, message, or type..."
                                        className="h-10 w-full rounded-xl border border-border bg-background py-2 pl-11 pr-10 text-sm text-foreground outline-none transition-all duration-150 placeholder:text-muted-foreground focus:ring-2 focus:ring-indigo-200"
                                    />
                                    {searchValue.trim() && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchValue("")}
                                            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                                            aria-label="Clear search"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={toggleSelectAllFiltered}
                                        disabled={filteredItems.length === 0}
                                        className="inline-flex h-10 items-center rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition-all duration-150 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {areAllFilteredSelected ? "Unselect all" : "Select all"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onDeleteSelected}
                                        disabled={selectedIds.length === 0}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 text-sm font-semibold text-destructive transition-all duration-150 hover:bg-destructive/15 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Delete ({selectedIds.length})
                                    </button>
                                    {hasActiveFilters && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setReadFilter("all");
                                                setSearchValue("");
                                            }}
                                            className="inline-flex h-10 items-center rounded-xl border border-border bg-background px-4 text-sm font-semibold text-muted-foreground transition-all duration-150 hover:bg-secondary hover:text-foreground"
                                        >
                                            Clear filters
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {loading && (
                            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Loading notifications...
                            </div>
                        )}

                        {error && (
                            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive">
                                {error}
                            </div>
                        )}

                        {!loading && filteredItems.length === 0 && (
                            <div className="rounded-2xl border border-border/80 bg-card p-12 text-center shadow-sm">
                                <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                                    <Bell className="h-7 w-7 text-muted-foreground" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground">
                                    {items.length === 0 ? "No notifications yet" : "No matching notifications"}
                                </h3>
                                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                                    {items.length === 0
                                        ? "New app activities will appear here automatically."
                                        : "Try a different search term or filter."}
                                </p>
                            </div>
                        )}

                        <div className="space-y-3 pb-10">
                            {filteredItems.map((item) => {
                                const booking = item.booking_id ? bookingMap.get(item.booking_id) : undefined;
                                const providerId = booking?.provider_id || item.provider_id || undefined;
                                const customerId = booking?.customer_id || item.customer_id || undefined;
                                const provider = providerId ? providerMap.get(providerId) : undefined;
                                const customer = customerId ? customerMap.get(customerId) : undefined;
                                const providerName =
                                    formatDisplayName(provider?.firstName || provider?.first_name, provider?.lastName || provider?.last_name) ||
                                    provider?.name ||
                                    null;
                                const customerName =
                                    formatDisplayName(customer?.first_name, customer?.last_name) ||
                                    formatDisplayName(booking?.firstName, booking?.lastName) ||
                                    null;
                                const adminMessage = formatAdminMessage(getNotificationMessage(item), customerName, providerName);
                                const visual = getNotificationVisualMeta(item);
                                const Icon = visual.icon;
                                const isSelected = selectedIds.includes(item.id);

                                return (
                                    <article
                                        key={item.id}
                                        className={cn(
                                            "overflow-hidden rounded-2xl border border-border/80 border-l-4 shadow-sm transition-all duration-200 hover:shadow-md",
                                            visual.accentClass,
                                            !item.is_read && "ring-1 ring-indigo-100 dark:ring-indigo-900/40",
                                            isSelected && "ring-2 ring-indigo-300 dark:ring-indigo-700"
                                        )}
                                    >
                                        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="flex min-w-0 flex-1 gap-4">
                                                <div className="flex shrink-0 flex-col items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelectOne(item.id)}
                                                        className="h-4 w-4 rounded border-border accent-indigo-600"
                                                        aria-label={`Select notification ${item.title || item.id}`}
                                                    />
                                                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-background/80 shadow-sm">
                                                        <Icon className="h-5 w-5 text-foreground" />
                                                    </div>
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                                        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", visual.badgeClass)}>
                                                            {getNotificationTypeLabel(item.type)}
                                                        </span>
                                                        {!item.is_read && (
                                                            <span className="inline-flex items-center rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white">
                                                                New
                                                            </span>
                                                        )}
                                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                                            <Clock3 className="h-3.5 w-3.5" />
                                                            {formatRelativeTime(item.created_at)}
                                                        </span>
                                                    </div>

                                                    <h3 className="text-lg font-bold leading-snug text-foreground">
                                                        {item.title || "System update"}
                                                    </h3>
                                                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                                        {adminMessage}
                                                    </p>

                                                    {(customerName || providerName) && (
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {customerName && (
                                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-semibold text-foreground">
                                                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                                                    {customerName}
                                                                </span>
                                                            )}
                                                            {providerName && (
                                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-semibold text-foreground">
                                                                    <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                                                                    {providerName}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex shrink-0 flex-wrap items-center gap-2 lg:pl-2">
                                                {!item.is_read && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onMarkRead(item.id)}
                                                        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground transition-all duration-150 hover:bg-secondary"
                                                    >
                                                        <CheckCheck className="h-4 w-4" />
                                                        Mark read
                                                    </button>
                                                )}
                                                <Link
                                                    href={item.action_url || "/admin/dashboard"}
                                                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition-all duration-150 hover:bg-indigo-700"
                                                >
                                                    Open
                                                    <ExternalLink className="h-4 w-4" />
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => onDeleteOne(item.id)}
                                                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-destructive/40 bg-destructive/10 text-destructive transition-all duration-150 hover:bg-destructive/15"
                                                    aria-label="Delete notification"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
}
