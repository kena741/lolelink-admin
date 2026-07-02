'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_ADMIN_ROLES, hasPermission } from '@/lib/admin-permissions';
import { getSupabase } from '@/lib/supabaseClient';

interface UseAdminPermissionsResult {
    loading: boolean;
    adminId: string | null;
    permissions: string[];
    can: (permission: string) => boolean;
    canWriteBookings: boolean;
    canWriteCustomers: boolean;
    canWriteProviders: boolean;
    canVerifyProviders: boolean;
    canWriteServices: boolean;
    canWriteCatalog: boolean;
    canWriteFinance: boolean;
    canWriteContact: boolean;
    canWriteDocuments: boolean;
    canWriteSettings: boolean;
    canWriteAdmins: boolean;
    canWriteRoles: boolean;
    canWriteNotifications: boolean;
}

async function resolveRolePermissions(roleSlug: string): Promise<string[]> {
    const { data: roleRow } = await getSupabase()
        .from('admin_role')
        .select('permissions')
        .eq('slug', roleSlug)
        .maybeSingle();

    const permissions = (roleRow as { permissions?: string[] } | null)?.permissions;
    if (Array.isArray(permissions) && permissions.length > 0) {
        return permissions;
    }

    const defaultRole = DEFAULT_ADMIN_ROLES.find((role) => role.slug === roleSlug);
    return defaultRole ? [...defaultRole.permissions] : [];
}

export function useAdminPermissions(): UseAdminPermissionsResult {
    const [loading, setLoading] = useState(true);
    const [adminId, setAdminId] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<string[]>([]);

    useEffect(() => {
        let isMounted = true;

        async function loadPermissions() {
            setLoading(true);
            const { data: userData } = await getSupabase().auth.getUser();
            const user = userData.user;

            if (!user) {
                if (isMounted) {
                    setAdminId(null);
                    setPermissions([]);
                    setLoading(false);
                }
                return;
            }

            const { data: adminRow } = await getSupabase()
                .from('admin')
                .select('id, role, is_active')
                .eq('user_id', user.id)
                .maybeSingle();

            if (!isMounted) return;

            if (!adminRow || !adminRow.is_active) {
                setAdminId(null);
                setPermissions([]);
                setLoading(false);
                return;
            }

            const rolePermissions = await resolveRolePermissions(adminRow.role as string);
            if (isMounted) {
                setAdminId(adminRow.id as string);
                setPermissions(rolePermissions);
                setLoading(false);
            }
        }

        void loadPermissions();
        const { data: authSub } = getSupabase().auth.onAuthStateChange(() => {
            void loadPermissions();
        });

        return () => {
            isMounted = false;
            authSub.subscription.unsubscribe();
        };
    }, []);

    const can = useCallback(
        (permission: string) => hasPermission(permissions, permission),
        [permissions]
    );

    return {
        loading,
        adminId,
        permissions,
        can,
        canWriteBookings: can('bookings:write'),
        canWriteCustomers: can('customers:write'),
        canWriteProviders: can('providers:write'),
        canVerifyProviders: can('providers:verify'),
        canWriteServices: can('services:write'),
        canWriteCatalog: can('catalog:write'),
        canWriteFinance: can('finance:write'),
        canWriteContact: can('contact:write'),
        canWriteDocuments: can('documents:write'),
        canWriteSettings: can('settings:write'),
        canWriteAdmins: can('admins:write'),
        canWriteRoles: can('roles:write'),
        canWriteNotifications: can('notifications:write'),
    };
}

export function canAccessAdminRoute(pathname: string, can: (permission: string) => boolean): boolean {
    if (pathname === '/admin/dashboard' || pathname === '/admin') return true;
    if (pathname.startsWith('/admin/providers')) return can('providers:read');
    if (pathname.startsWith('/admin/verify-documents')) return can('providers:verify');
    if (pathname.startsWith('/admin/services')) return can('services:read');
    if (pathname.startsWith('/admin/categories') || pathname.startsWith('/admin/subcategories')) {
        return can('catalog:read');
    }
    if (pathname.startsWith('/admin/documents')) return can('documents:read');
    if (pathname.startsWith('/admin/banners') || pathname.startsWith('/admin/coupon')) {
        return can('catalog:read');
    }
    if (pathname.startsWith('/admin/bookings')) return can('bookings:read');
    if (pathname.startsWith('/admin/handyman')) return can('providers:read');
    if (pathname.startsWith('/admin/customers/job-requests')) return can('contact:read');
    if (pathname.startsWith('/admin/customers')) return can('customers:read');
    if (pathname.startsWith('/admin/finance')) return can('finance:read');
    if (pathname.startsWith('/admin/notifications')) return can('notifications:read');
    if (pathname.startsWith('/admin/settings')) return can('settings:read');
    if (pathname.startsWith('/admin/mobile-app-config')) {
        return can('settings:read') || can('contact:read');
    }
    if (pathname.startsWith('/admin/admins')) return can('admins:read');
    if (pathname.startsWith('/admin/roles')) return can('roles:read');
    if (pathname.startsWith('/admin/activity-logs')) return can('logs:read');
    if (pathname.startsWith('/admin/contact-messages')) return can('contact:read');
    return true;
}
