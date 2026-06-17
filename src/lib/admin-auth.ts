import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_ADMIN_ROLES, hasPermission } from '@/lib/admin-permissions';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { createSupabaseServerClientFromRequest } from '@/lib/supabase-server';

interface AdminRow {
    id: string;
    role: string;
    is_active: boolean;
}

export interface AdminAuthContext {
    adminId: string;
    role: string;
    permissions: string[];
}

export type AdminAuthResult =
    | { ok: true; context: AdminAuthContext }
    | { ok: false; status: number; error: string };

async function resolveRolePermissions(
    supabaseAdmin: SupabaseClient,
    roleSlug: string
): Promise<string[]> {
    const { data: roleRow } = await supabaseAdmin
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

export async function requireAdminPermission(
    request: Request,
    permission: string
): Promise<AdminAuthResult> {
    const supabase = await createSupabaseServerClientFromRequest(request);
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
        return { ok: false, status: 401, error: 'Unauthorized' };
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    const { data: adminRow, error: adminError } = await supabaseAdmin
        .from('admin')
        .select('id, role, is_active')
        .eq('user_id', userData.user.id)
        .maybeSingle();

    if (adminError) {
        return { ok: false, status: 500, error: adminError.message };
    }

    const admin = adminRow as AdminRow | null;
    if (!admin || !admin.is_active) {
        return { ok: false, status: 403, error: 'Admin access required' };
    }

    const permissions = await resolveRolePermissions(supabaseAdmin, admin.role);
    if (!hasPermission(permissions, permission)) {
        return { ok: false, status: 403, error: 'Insufficient permissions' };
    }

    return {
        ok: true,
        context: {
            adminId: admin.id,
            role: admin.role,
            permissions,
        },
    };
}
