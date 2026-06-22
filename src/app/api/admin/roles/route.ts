import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { DEFAULT_ADMIN_ROLES } from '@/lib/admin-permissions';
import { logAdminActivity } from '@/lib/admin-activity-log';

export const runtime = 'nodejs';

interface AdminRoleRow {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    permissions: string[];
    is_system: boolean;
    created_at: string;
    updated_at: string;
}

interface RoleMutationBody {
    id?: string;
    slug?: string;
    name?: string;
    description?: string;
    permissions?: string[];
}

function normalizeSlug(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '_');
}

async function ensureDefaultRoles(supabaseAdmin: ReturnType<typeof getSupabaseAdminFromRequest>) {
    const { count, error: countError } = await supabaseAdmin
        .from('admin_role')
        .select('id', { count: 'exact', head: true });

    if (countError) throw countError;

    if ((count ?? 0) === 0) {
        const { error: seedError } = await supabaseAdmin.from('admin_role').insert(
            DEFAULT_ADMIN_ROLES.map((role) => ({
                slug: role.slug,
                name: role.name,
                description: role.description,
                permissions: [...role.permissions],
                is_system: role.is_system,
            }))
        );

        if (seedError) throw seedError;
        return;
    }

    for (const role of DEFAULT_ADMIN_ROLES) {
        if (!role.is_system) continue;

        const { error: syncError } = await supabaseAdmin
            .from('admin_role')
            .update({
                name: role.name,
                description: role.description,
                permissions: [...role.permissions],
                updated_at: new Date().toISOString(),
            })
            .eq('slug', role.slug)
            .eq('is_system', true);

        if (syncError) throw syncError;
    }
}

export async function GET(request: Request) {
    const auth = await requireAdminPermission(request, 'roles:read');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        await ensureDefaultRoles(supabaseAdmin);

        const { data, error } = await supabaseAdmin
            .from('admin_role')
            .select('*')
            .order('name', { ascending: true });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data: (data as AdminRoleRow[]) ?? [] });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireAdminPermission(request, 'roles:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as RoleMutationBody;
        const slug = normalizeSlug(body.slug ?? '');
        const name = (body.name ?? '').trim();
        const description = (body.description ?? '').trim() || null;
        const permissions = Array.isArray(body.permissions) ? body.permissions : [];

        if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });
        if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
        if (permissions.length === 0) {
            return NextResponse.json({ error: 'At least one permission is required' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('admin_role')
            .insert({
                slug,
                name,
                description,
                permissions,
                is_system: false,
            })
            .select('*')
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        const row = data as AdminRoleRow;
        await logAdminActivity({
            request,
            action: 'create',
            resource_type: 'role',
            resource_id: row.id,
            summary: `Created role ${name} (${slug})`,
            metadata: { permissions },
        });
        return NextResponse.json({ data: row });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const auth = await requireAdminPermission(request, 'roles:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as RoleMutationBody;
        if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const { data: existing, error: existingError } = await supabaseAdmin
            .from('admin_role')
            .select('is_system')
            .eq('id', body.id)
            .maybeSingle();

        if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
        if (!existing) return NextResponse.json({ error: 'Role not found' }, { status: 404 });

        const updates: Record<string, string | string[] | boolean | null> = {
            updated_at: new Date().toISOString(),
        };

        if (typeof body.name === 'string') updates.name = body.name.trim();
        if (typeof body.description === 'string') {
            updates.description = body.description.trim() || null;
        }
        if (Array.isArray(body.permissions)) updates.permissions = body.permissions;
        if (typeof body.slug === 'string' && !existing.is_system) {
            updates.slug = normalizeSlug(body.slug);
        }

        const { data, error } = await supabaseAdmin
            .from('admin_role')
            .update(updates)
            .eq('id', body.id)
            .select('*')
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        const row = data as AdminRoleRow;
        await logAdminActivity({
            request,
            action: 'update',
            resource_type: 'role',
            resource_id: body.id,
            summary: `Updated role ${row.name}`,
            metadata: updates,
        });
        return NextResponse.json({ data: row });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const auth = await requireAdminPermission(request, 'roles:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as RoleMutationBody;
        if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const { data: existing, error: existingError } = await supabaseAdmin
            .from('admin_role')
            .select('slug, is_system')
            .eq('id', body.id)
            .maybeSingle();

        if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
        if (!existing) return NextResponse.json({ error: 'Role not found' }, { status: 404 });
        if (existing.is_system) {
            return NextResponse.json({ error: 'System roles cannot be deleted' }, { status: 400 });
        }

        const { count, error: usageError } = await supabaseAdmin
            .from('admin')
            .select('id', { count: 'exact', head: true })
            .eq('role', existing.slug as string);

        if (usageError) return NextResponse.json({ error: usageError.message }, { status: 500 });
        if ((count ?? 0) > 0) {
            return NextResponse.json(
                { error: 'Role is assigned to admins. Reassign them before deleting.' },
                { status: 400 }
            );
        }

        const { error } = await supabaseAdmin.from('admin_role').delete().eq('id', body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        await logAdminActivity({
            request,
            action: 'delete',
            resource_type: 'role',
            resource_id: body.id,
            summary: `Deleted role ${existing.slug as string}`,
        });
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
