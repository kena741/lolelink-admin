'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchNotifications } from '@/features/notification/notificationSlice';

export function NotificationBell() {
    const pathname = usePathname();
    const dispatch = useAppDispatch();
    const items = useAppSelector((state) => state.notification.items);
    const unreadCount = useMemo(() => items.filter((item) => !item.is_read).length, [items]);
    const isNotificationsPage = pathname?.startsWith('/admin/notifications');

    useEffect(() => {
        if (!pathname?.startsWith('/admin')) return;
        if (isNotificationsPage) return;
        dispatch(fetchNotifications());
    }, [dispatch, pathname, isNotificationsPage]);

    if (!pathname?.startsWith('/admin') || isNotificationsPage) return null;

    return (
        <Link
            href="/admin/notifications"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-text-primary transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Open notifications"
        >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            ) : null}
        </Link>
    );
}
