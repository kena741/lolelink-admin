'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_ADMIN_ROLES, hasPermission } from '@/lib/admin-permissions';
import { getSupabase } from '@/lib/supabaseClient';

interface UseAdminPermissionsResult {
    loading: boolean;
    canWriteBookings: boolean;
    permissions: string[];
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
    const [permissions, setPermissions] = useState<string[]>([]);

    useEffect(() => {
        let isMounted = true;

        async function loadPermissions() {
            setLoading(true);
            const { data: userData } = await getSupabase().auth.getUser();
            const user = userData.user;

            if (!user) {
                if (isMounted) {
                    setPermissions([]);
                    setLoading(false);
                }
                return;
            }

            const { data: adminRow } = await getSupabase()
                .from('admin')
                .select('role, is_active')
                .eq('user_id', user.id)
                .maybeSingle();

            if (!isMounted) return;

            if (!adminRow || !adminRow.is_active) {
                setPermissions([]);
                setLoading(false);
                return;
            }

            const rolePermissions = await resolveRolePermissions(adminRow.role as string);
            if (isMounted) {
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

    return {
        loading,
        permissions,
        canWriteBookings: hasPermission(permissions, 'bookings:write'),
    };
}
