'use client';

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { hasPermission } from '@/lib/admin-permissions';
import { getSupabase } from '@/lib/supabaseClient';

export type AdminSessionStatus = 'loading' | 'ready' | 'unauthenticated' | 'forbidden';

export interface AdminSessionValue {
    status: AdminSessionStatus;
    user: User | null;
    adminId: string | null;
    role: string | null;
    permissions: string[];
    can: (permission: string) => boolean;
    refresh: () => Promise<void>;
}

const AdminSessionContext = createContext<AdminSessionValue | null>(null);

async function readUser(): Promise<User | null> {
    const { data: sess } = await getSupabase().auth.getSession();
    if (sess.session?.user) return sess.session.user;
    await new Promise((resolve) => setTimeout(resolve, 120));
    const { data: retry } = await getSupabase().auth.getSession();
    return retry.session?.user ?? null;
}

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<AdminSessionStatus>('loading');
    const [user, setUser] = useState<User | null>(null);
    const [adminId, setAdminId] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<string[]>([]);
    const loadGen = useRef(0);

    const refresh = useCallback(async () => {
        const gen = ++loadGen.current;
        try {
            const nextUser = await readUser();
            if (gen !== loadGen.current) return;

            if (!nextUser) {
                setUser(null);
                setAdminId(null);
                setRole(null);
                setPermissions([]);
                setStatus('unauthenticated');
                return;
            }

            // Resolve grants via service-role API so role edits apply immediately
            // (client RLS on admin_role often falls back to code defaults).
            const response = await fetch('/api/admin/me', { cache: 'no-store' });
            if (gen !== loadGen.current) return;

            if (response.status === 401) {
                setUser(nextUser);
                setAdminId(null);
                setRole(null);
                setPermissions([]);
                setStatus('unauthenticated');
                return;
            }

            if (response.status === 403) {
                setUser(nextUser);
                setAdminId(null);
                setRole(null);
                setPermissions([]);
                setStatus('forbidden');
                return;
            }

            if (!response.ok) {
                setUser(nextUser);
                setAdminId(null);
                setRole(null);
                setPermissions([]);
                setStatus('unauthenticated');
                return;
            }

            const payload = (await response.json()) as {
                data?: { adminId?: string; role?: string; permissions?: string[] };
            };
            if (gen !== loadGen.current) return;

            setUser(nextUser);
            setAdminId(typeof payload.data?.adminId === 'string' ? payload.data.adminId : null);
            setRole(typeof payload.data?.role === 'string' ? payload.data.role : null);
            setPermissions(
                Array.isArray(payload.data?.permissions) ? [...payload.data.permissions] : []
            );
            setStatus('ready');
        } catch {
            if (gen !== loadGen.current) return;
            setUser(null);
            setAdminId(null);
            setRole(null);
            setPermissions([]);
            setStatus('unauthenticated');
        }
    }, []);

    useEffect(() => {
        void refresh();
        const { data: sub } = getSupabase().auth.onAuthStateChange(() => {
            void refresh();
        });
        return () => {
            loadGen.current += 1;
            sub.subscription.unsubscribe();
        };
    }, [refresh]);

    const can = useCallback(
        (permission: string) => hasPermission(permissions, permission),
        [permissions]
    );

    const value = useMemo<AdminSessionValue>(
        () => ({
            status,
            user,
            adminId,
            role,
            permissions,
            can,
            refresh,
        }),
        [status, user, adminId, role, permissions, can, refresh]
    );

    return (
        <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>
    );
}

export function useAdminSession(): AdminSessionValue {
    const ctx = useContext(AdminSessionContext);
    if (!ctx) {
        return {
            status: 'loading',
            user: null,
            adminId: null,
            role: null,
            permissions: [],
            can: () => false,
            refresh: async () => undefined,
        };
    }
    return ctx;
}
