'use client';

import { useCallback, useEffect, useState } from 'react';
import type { NavActionCounts } from '@/app/api/admin/nav-action-counts/route';

const EMPTY: NavActionCounts = {
    '/admin/finance/payout-request': 0,
    '/admin/verify-documents': 0,
    '/admin/services/approve': 0,
    '/admin/bookings': 0,
    '/admin/customers/job-requests': 0,
};

const REFRESH_MS = 60_000;

export function useNavActionCounts(): {
    counts: NavActionCounts;
    refresh: () => void;
} {
    const [counts, setCounts] = useState<NavActionCounts>(EMPTY);

    const refresh = useCallback(() => {
        void fetch('/api/admin/nav-action-counts', { cache: 'no-store' })
            .then(async (response) => {
                if (!response.ok) return;
                const payload = (await response.json()) as { counts?: NavActionCounts };
                if (payload.counts) setCounts({ ...EMPTY, ...payload.counts });
            })
            .catch(() => {
                // keep last good counts
            });
    }, []);

    useEffect(() => {
        refresh();
        const timer = window.setInterval(refresh, REFRESH_MS);
        const onFocus = () => refresh();
        window.addEventListener('focus', onFocus);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('focus', onFocus);
        };
    }, [refresh]);

    return { counts, refresh };
}

export function formatActionCount(count: number): string {
    if (count <= 0) return '';
    if (count > 99) return '99+';
    return String(count);
}
