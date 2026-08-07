'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminSession } from '@/lib/admin-session';
import { canAccessAdminRoute } from '@/hooks/use-admin-permissions';
import { getSupabase } from '@/lib/supabaseClient';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { status, can, refresh } = useAdminSession();
    const didNavigate = useRef(false);
    const readyOnce = useRef(false);

    if (status === 'ready') readyOnce.current = true;

    useEffect(() => {
        didNavigate.current = false;
    }, [pathname]);

    useEffect(() => {
        if (status === 'loading') return;

        if (status === 'unauthenticated') {
            if (didNavigate.current) return;
            didNavigate.current = true;
            void getSupabase().auth.signOut();
            router.replace(
                '/login?error=auth&next=' + encodeURIComponent(pathname || '/admin/dashboard')
            );
            return;
        }

        if (status === 'forbidden') {
            if (didNavigate.current) return;
            didNavigate.current = true;
            void getSupabase().auth.signOut();
            router.replace('/login?error=forbidden');
            return;
        }

        if (status === 'ready') {
            const routePath = pathname || '/admin/dashboard';
            if (!canAccessAdminRoute(routePath, can)) {
                if (didNavigate.current) return;
                didNavigate.current = true;
                router.replace('/admin/dashboard?error=forbidden');
            }
        }
    }, [status, pathname, can, router]);

    useEffect(() => {
        if (status !== 'loading' || readyOnce.current) return;
        const timeoutId = window.setTimeout(() => {
            if (readyOnce.current || didNavigate.current) return;
            void (async () => {
                const { data } = await getSupabase().auth.getSession();
                if (data.session?.user) {
                    void refresh();
                    return;
                }
                didNavigate.current = true;
                router.replace(
                    '/login?error=timeout&next=' + encodeURIComponent(pathname || '/admin/dashboard')
                );
            })();
        }, 20000);
        return () => window.clearTimeout(timeoutId);
    }, [status, refresh, router, pathname]);

    // First boot only — never blank the shell again on route change once ready.
    if (status === 'loading' && !readyOnce.current) {
        return (
            <div className="grid min-h-screen w-full place-items-center bg-background">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
                    Checking access…
                </div>
            </div>
        );
    }

    if (status === 'unauthenticated' || status === 'forbidden') {
        return null;
    }

    if (status === 'ready' && !canAccessAdminRoute(pathname || '/admin/dashboard', can)) {
        return null;
    }

    return <>{children}</>;
}
