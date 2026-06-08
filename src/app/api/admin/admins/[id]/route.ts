import { NextResponse } from 'next/server';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { logAdminActivity } from '@/lib/admin-activity-log';

export const runtime = 'nodejs';

type RouteParams = { id: string };

interface PatchBody {
    full_name?: string;
    role?: string;
    is_active?: boolean;
    password?: string;
}

async function getIdFromParams(params: Promise<RouteParams> | RouteParams): Promise<string | null> {
    const resolved = await Promise.resolve(params);
    const id = resolved?.id?.trim();
    return id && id.length > 0 ? id : null;
}

export async function PATCH(request: Request, context: { params: Promise<RouteParams> }) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const id = await getIdFromParams(context.params);
        if (!id) return NextResponse.json({ error: 'Invalid admin id' }, { status: 400 });

        const body = (await request.json()) as PatchBody;
        const updates: Record<string, string | boolean> = {};

        if (typeof body.full_name === 'string') updates.full_name = body.full_name.trim();
        if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;
        if (typeof body.role === 'string') {
            const role = body.role.trim();
            const { data: roleRow, error: roleError } = await supabaseAdmin
                .from('admin_role')
                .select('slug')
                .eq('slug', role)
                .maybeSingle();
            if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });
            if (!roleRow) return NextResponse.json({ error: `Role "${role}" does not exist` }, { status: 400 });
            updates.role = role;
        }

        const { data: existing, error: existingError } = await supabaseAdmin
            .from('admin')
            .select('user_id')
            .eq('id', id)
            .maybeSingle();

        if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
        if (!existing) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });

        if (typeof body.password === 'string' && body.password.length >= 6) {
            const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
                existing.user_id as string,
                { password: body.password }
            );
            if (passwordError) return NextResponse.json({ error: passwordError.message }, { status: 500 });
        }

        if (Object.keys(updates).length === 0 && !body.password) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        if (Object.keys(updates).length > 0) {
            updates.updated_at = new Date().toISOString();
            const { data, error } = await supabaseAdmin
                .from('admin')
                .update(updates)
                .eq('id', id)
                .select('id, user_id, full_name, role, is_active, created_at, updated_at')
                .single();

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            await logAdminActivity({
                request,
                action: 'update',
                resource_type: 'admin',
                resource_id: id,
                summary: `Updated admin ${data.full_name || id}`,
                metadata: updates,
            });
            return NextResponse.json({ data });
        }

        const { data, error } = await supabaseAdmin
            .from('admin')
            .select('id, user_id, full_name, role, is_active, created_at, updated_at')
            .eq('id', id)
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        await logAdminActivity({
            request,
            action: 'update',
            resource_type: 'admin',
            resource_id: id,
            summary: `Updated admin password for ${data.full_name || id}`,
            metadata: { password_reset: true },
        });
        return NextResponse.json({ data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: Promise<RouteParams> }) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const id = await getIdFromParams(context.params);
        if (!id) return NextResponse.json({ error: 'Invalid admin id' }, { status: 400 });

        const { data: existing, error: existingError } = await supabaseAdmin
            .from('admin')
            .select('user_id')
            .eq('id', id)
            .maybeSingle();

        if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
        if (!existing) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });

        const { error: deleteAdminError } = await supabaseAdmin.from('admin').delete().eq('id', id);
        if (deleteAdminError) return NextResponse.json({ error: deleteAdminError.message }, { status: 500 });

        await supabaseAdmin.auth.admin.deleteUser(existing.user_id as string);

        await logAdminActivity({
            request,
            action: 'delete',
            resource_type: 'admin',
            resource_id: id,
            summary: `Deleted admin ${id}`,
        });

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
