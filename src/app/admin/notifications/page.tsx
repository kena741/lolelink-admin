"use client";

import React, { useEffect, useMemo } from "react";
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

function getNotificationTypeLabel(value?: string | null): string {
    if (!value) return "Update";
    return value
        .split("_")
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(" ");
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

    return (
        <AuthGuard>
            <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/30">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    <div className="relative isolate overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 opacity-90" />
                        <div className="relative mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-8">
                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                            <Bell className="h-6 w-6 text-white" />
                                        </div>
                                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                                            Notifications
                                        </h1>
                                    </div>
                                    <p className="text-white/90 text-base font-medium">
                                        Live updates from app activity and operational events
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
                                        <div className="text-sm text-white/80">Unread</div>
                                        <div className="text-2xl font-bold text-white">{unreadCount}</div>
                                    </div>
                                    <button
                                        onClick={onMarkAllRead}
                                        disabled={unreadCount === 0}
                                        className="inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md px-4 py-3 text-sm font-semibold text-white ring-2 ring-white/20 hover:bg-white/20 hover:ring-white/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <CheckCheck className="h-4 w-4" />
                                        Mark all read
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        {loading && (
                            <div className="mb-4 text-sm text-gray-600 flex items-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                                Loading notifications...
                            </div>
                        )}

                        {error && (
                            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        <div className="space-y-3">
                            {items.map((item) => {
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
                                        className={`rounded-2xl border bg-white/90 backdrop-blur-xl p-4 sm:p-5 shadow-sm transition-all ${
                                            item.is_read
                                                ? "border-gray-200"
                                                : "border-indigo-200 ring-1 ring-indigo-100"
                                        }`}
                                    >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                                                        {getNotificationTypeLabel(item.type)}
                                                    </span>
                                                    {!item.is_read && (
                                                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                                            New
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="text-base font-semibold text-gray-900 truncate">
                                                    {item.title || "System update"}
                                                </h3>
                                                <p className="mt-1 text-sm text-gray-600">
                                                    {adminMessage}
                                                </p>
                                                <div className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500">
                                                    <Clock3 className="h-3.5 w-3.5" />
                                                    {item.created_at ? new Date(item.created_at).toLocaleString() : "Unknown time"}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 sm:pl-3">
                                                {!item.is_read && (
                                                    <button
                                                        onClick={() => onMarkRead(item.id)}
                                                        className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                                    >
                                                        Mark read
                                                    </button>
                                                )}
                                                <Link
                                                    href={item.action_url || "/admin/dashboard"}
                                                    className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                                                >
                                                    Open
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {!loading && items.length === 0 && (
                            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
                                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-gray-100 grid place-items-center">
                                    <Bell className="h-6 w-6 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">No notifications yet</h3>
                                <p className="mt-1 text-sm text-gray-600">
                                    New app activities will appear here automatically.
                                </p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
}
