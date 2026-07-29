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
            className="fixed bottom-6 right-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-subtle bg-surface text-primary shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all duration-150 hover:bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 md:bottom-8 md:right-8"
            aria-label="Open notifications"
        >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </Link>
    );
}
