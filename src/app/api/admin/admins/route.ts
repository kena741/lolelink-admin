import { NextResponse } from 'next/server';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { logAdminActivity } from '@/lib/admin-activity-log';

export const runtime = 'nodejs';

interface AdminRow {
    id: string;
    user_id: string;
    full_name: string | null;
    role: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface CreateAdminBody {
    email?: string;
    password?: string;
    full_name?: string;
    role?: string;
    is_active?: boolean;
}

export async function GET(request: Request) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const { data: admins, error } = await supabaseAdmin
            .from('admin')
            .select('id, user_id, full_name, role, is_active, created_at, updated_at')
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const rows = (admins as AdminRow[]) ?? [];
        const userIds = rows.map((row) => row.user_id).filter(Boolean);
        const emailByUserId = new Map<string, string>();

        if (userIds.length > 0) {
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
                page: 1,
                perPage: 1000,
            });
            if (!authError && authData?.users) {
                for (const user of authData.users) {
                    if (userIds.includes(user.id) && user.email) {
                        emailByUserId.set(user.id, user.email);
                    }
                }
            }
        }

        const data = rows.map((row) => ({
            ...row,
            email: emailByUserId.get(row.user_id) ?? null,
        }));

        return NextResponse.json({ data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as CreateAdminBody;
        const email = (body.email ?? '').trim().toLowerCase();
        const password = body.password ?? '';
        const fullName = (body.full_name ?? '').trim();
        const role = (body.role ?? '').trim();
        const isActive = body.is_active !== false;

        if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });
        if (!password || password.length < 6) {
            return NextResponse.json({ error: 'password must be at least 6 characters' }, { status: 400 });
        }
        if (!fullName) return NextResponse.json({ error: 'full_name is required' }, { status: 400 });
        if (!role) return NextResponse.json({ error: 'role is required' }, { status: 400 });

        const { data: roleRow, error: roleError } = await supabaseAdmin
            .from('admin_role')
            .select('slug')
            .eq('slug', role)
            .maybeSingle();

        if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });
        if (!roleRow) return NextResponse.json({ error: `Role "${role}" does not exist` }, { status: 400 });

        const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName },
        });

        if (createUserError || !createdUser.user) {
            return NextResponse.json(
                { error: createUserError?.message || 'Failed to create auth user' },
                { status: 500 }
            );
        }

        const { data: adminRow, error: adminError } = await supabaseAdmin
            .from('admin')
            .insert({
                user_id: createdUser.user.id,
                full_name: fullName,
                role,
                is_active: isActive,
            })
            .select('id, user_id, full_name, role, is_active, created_at, updated_at')
            .single();

        if (adminError) {
            await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id);
            return NextResponse.json({ error: adminError.message }, { status: 500 });
        }

        const created = {
            ...(adminRow as AdminRow),
            email,
        };

        await logAdminActivity({
            request,
            action: 'create',
            resource_type: 'admin',
            resource_id: created.id,
            summary: `Created admin ${fullName} (${email}) with role ${role}`,
            metadata: { role, is_active: isActive },
        });

        return NextResponse.json({ data: created });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
