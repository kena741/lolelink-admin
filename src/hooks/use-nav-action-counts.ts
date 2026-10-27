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
const BUMP_EVENT = 'nav-action-count-bump';

type BumpDetail = { href: keyof NavActionCounts; delta: number };

/** Optimistic sidebar badge bump (e.g. pending verify docs). */
export function bumpNavActionCount(href: keyof NavActionCounts, delta: number) {
    if (typeof window === 'undefined' || delta === 0) return;
    window.dispatchEvent(new CustomEvent<BumpDetail>(BUMP_EVENT, { detail: { href, delta } }));
}

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
        const onBump = (event: Event) => {
            const detail = (event as CustomEvent<BumpDetail>).detail;
            if (!detail?.href || !detail.delta) return;
            setCounts((prev) => ({
                ...prev,
                [detail.href]: Math.max(0, (prev[detail.href] ?? 0) + detail.delta),
            }));
        };
        window.addEventListener('focus', onFocus);
        window.addEventListener(BUMP_EVENT, onBump);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener(BUMP_EVENT, onBump);
        };
    }, [refresh]);

    return { counts, refresh };
}

export function formatActionCount(count: number): string {
    if (count <= 0) return '';
    if (count > 99) return '99+';
    return String(count);
}
