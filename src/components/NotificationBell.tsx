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

    useEffect(() => {
        if (!pathname?.startsWith('/admin')) return;
        dispatch(fetchNotifications());
    }, [dispatch, pathname]);

    if (!pathname?.startsWith('/admin')) return null;

    return (
        <Link
            href="/admin/notifications"
            className="fixed right-6 top-6 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-lg transition-all hover:bg-gray-50"
            aria-label="Open notifications"
        >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </Link>
    );
}
