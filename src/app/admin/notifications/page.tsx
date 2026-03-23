"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import { Bell, CheckCheck, Clock3 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchAllBookings } from "@/features/bookedService/bookedServiceSlice";
import { fetchProviders } from "@/features/provider/providerSlice";
import { fetchAllCustomers } from "@/features/customer/customerSlice";
import {
    fetchNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    NotificationItem,
} from "@/features/notification/notificationSlice";

interface ReadFilterOption {
    id: "all" | "unread" | "read";
    label: string;
    count: number;
}

function getNotificationTypeLabel(value?: string | null): string {
    if (!value) return "Update";
    return value
        .split("_")
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(" ");
}

function getNotificationTypeColorClasses(value?: string | null): string {
    const normalizedValue = (value ?? "").toLowerCase();
    if (normalizedValue.includes("booking_request"))
        return "border border-primary/30 bg-primary/10 text-foreground";
    if (normalizedValue.includes("order"))
        return "border border-border bg-secondary text-foreground";
    if (normalizedValue.includes("booking_status"))
        return "border border-ring/30 bg-accent text-foreground";
    return "border border-border bg-accent text-foreground";
}

function getNotificationCardColorClasses(notification: NotificationItem): string {
    const type = (notification.type ?? "").toLowerCase();
    const title = (notification.title ?? "").toLowerCase();
    const description = (notification.description ?? "").toLowerCase();
    const combined = `${type} ${title} ${description}`;

    if (/(reject|cancel|fail|error|decline)/.test(combined))
        return notification.is_read
            ? "border-destructive/35 bg-card"
            : "border-destructive/45 bg-destructive/5";
    if (/(accept|approved|complete|success|done)/.test(combined))
        return notification.is_read
            ? "border-primary/30 bg-card"
            : "border-primary/40 bg-primary/5";
    if (/(assign|request|new job|job started|ongoing)/.test(combined))
        return notification.is_read
            ? "border-ring/30 bg-card"
            : "border-ring/40 bg-accent/70";
    if (/(pending|review|hold|wait)/.test(combined))
        return notification.is_read
            ? "border-border bg-card"
            : "border-border bg-secondary/60";
    return notification.is_read
        ? "border-border bg-card"
        : "border-primary/30 bg-accent/60";
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

    const onMarkRead = async (notificationId: string) => {
        await dispatch(markNotificationRead({ id: notificationId }));
    };

    const onMarkAllRead = async () => {
        await dispatch(markAllNotificationsRead());
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

    const filterOptions = useMemo<ReadFilterOption[]>(
        () => [
            { id: "all", label: "All", count: items.length },
            { id: "unread", label: "Unread", count: unreadCount },
            { id: "read", label: "Read", count: readCount },
        ],
        [items.length, unreadCount, readCount]
    );

    return (
        <AuthGuard>
            <div className="flex min-h-screen bg-background">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    <div className="mx-auto max-w-[1100px] px-6 py-10">
                        <div className="rounded-md border border-border bg-card p-[24px] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="mb-2 flex items-center gap-3">
                                        <div className="inline-flex h-[40px] w-[40px] items-center justify-center rounded-md bg-accent text-foreground">
                                            <Bell className="h-[24px] w-[24px]" />
                                        </div>
                                        <h1 className="text-[24px] font-bold leading-[1.2] text-foreground sm:text-[32px]">
                                            Notifications
                                        </h1>
                                    </div>
                                    <p className="text-[16px] font-medium leading-[1.3] text-muted-foreground">
                                        Track operational updates and respond quickly to new activity.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="rounded-md border border-border bg-secondary px-4 py-2">
                                        <div className="text-[13px] font-semibold leading-[1.2] text-muted-foreground">Unread</div>
                                        <div className="text-[20px] font-bold leading-[1.2] text-foreground">{unreadCount}</div>
                                    </div>
                                    <button
                                        onClick={onMarkAllRead}
                                        disabled={unreadCount === 0}
                                        className="inline-flex h-[40px] items-center gap-2 rounded-md bg-primary px-4 text-[14px] font-semibold leading-[1.2] text-primary-foreground transition-all duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                                    >
                                        <CheckCheck className="h-[16px] w-[16px]" />
                                        Mark all read
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="sticky top-0 z-20 mt-6 rounded-md border border-border bg-card p-[16px] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <input
                                    value={searchValue}
                                    onChange={(event) => setSearchValue(event.target.value)}
                                    placeholder="Search notifications..."
                                    className="h-[40px] w-full rounded-md border border-border bg-background px-4 text-[16px] font-medium leading-[1.3] text-foreground outline-none transition-all duration-150 placeholder:text-muted-foreground focus:ring-2 focus:ring-ring md:max-w-[420px]"
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                    {filterOptions.map((option) => (
                                        <button
                                            key={option.id}
                                            onClick={() => setReadFilter(option.id)}
                                            className={`h-[40px] rounded-full px-4 text-[14px] font-semibold leading-[1.2] transition-all duration-150 ${
                                                readFilter === option.id
                                                    ? "border border-border bg-secondary text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                                                    : "border border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
                                            }`}
                                        >
                                            {option.label} ({option.count})
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {loading && (
                            <div className="mb-4 mt-6 flex items-center gap-2 text-[14px] font-medium leading-[1.2] text-muted-foreground">
                                <div className="h-[16px] w-[16px] animate-spin rounded-full border-2 border-ring border-t-transparent" />
                                Loading notifications...
                            </div>
                        )}

                        {error && (
                            <div className="mb-4 mt-6 rounded-md border border-border bg-card p-[16px] text-[14px] font-medium leading-[1.2] text-destructive">
                                {error}
                            </div>
                        )}

                        <div className="mt-6 space-y-4 pb-10">
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
                                return (
                                    <div
                                        key={item.id}
                                        className={`rounded-md border p-[24px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all duration-150 ${getNotificationCardColorClasses(item)}`}
                                    >
                                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                            <div className="min-w-0">
                                                <div className="mb-2 flex items-center gap-2">
                                                    <span
                                                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-semibold leading-[1.2] ${getNotificationTypeColorClasses(
                                                            item.type
                                                        )}`}
                                                    >
                                                        {getNotificationTypeLabel(item.type)}
                                                    </span>
                                                    {!item.is_read && (
                                                        <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-1 text-[13px] font-semibold leading-[1.2] text-foreground">
                                                            New
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="truncate text-[18px] font-semibold leading-[1.2] text-foreground">
                                                    {item.title || "System update"}
                                                </h3>
                                                <p className="mt-2 text-[16px] font-medium leading-[1.3] text-muted-foreground">
                                                    {adminMessage}
                                                </p>
                                                <div className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold leading-[1.2] text-muted-foreground">
                                                    <Clock3 className="h-[16px] w-[16px]" />
                                                    {item.created_at ? new Date(item.created_at).toLocaleString() : "Unknown time"}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 md:pl-3">
                                                {!item.is_read && (
                                                    <button
                                                        onClick={() => onMarkRead(item.id)}
                                                        className="inline-flex h-[40px] items-center rounded-md border border-border bg-background px-3 text-[14px] font-semibold leading-[1.2] text-foreground transition-all duration-150 hover:bg-secondary"
                                                    >
                                                        Mark read
                                                    </button>
                                                )}
                                                <Link
                                                    href={item.action_url || "/admin/dashboard"}
                                                    className="inline-flex h-[40px] items-center rounded-md bg-primary px-4 text-[14px] font-semibold leading-[1.2] text-primary-foreground transition-all duration-150 hover:bg-primary/90"
                                                >
                                                    Open
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {!loading && filteredItems.length === 0 && (
                            <div className="rounded-md border border-border bg-card p-[32px] text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                                <div className="mx-auto mb-3 grid h-[48px] w-[48px] place-items-center rounded-full bg-secondary">
                                    <Bell className="h-[24px] w-[24px] text-foreground" />
                                </div>
                                <h3 className="text-[20px] font-bold leading-[1.2] text-foreground">
                                    {items.length === 0 ? "No notifications yet" : "No matching notifications"}
                                </h3>
                                <p className="mt-2 text-[16px] font-medium leading-[1.3] text-muted-foreground">
                                    {items.length === 0
                                        ? "New app activities will appear here automatically."
                                        : "Try a different search term or filter."}
                                </p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
}
