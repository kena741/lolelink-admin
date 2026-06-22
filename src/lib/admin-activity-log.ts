import { getSupabaseAdminFromRequest, getSupabaseTargetFromRequest } from '@/lib/supabase-env';
import { createSupabaseServerClientFromRequest } from '@/lib/supabase-server';
import { sanitizeLogMetadata } from '@/lib/sanitize-log-metadata';

interface AdminActorRow {
    id: string;
    full_name: string | null;
    role: string;
    user_id: string;
}

export interface LogAdminActivityInput {
    request: Request;
    action: string;
    resource_type: string;
    resource_id?: string | null;
    summary: string;
    metadata?: Record<string, unknown>;
}

async function resolveAdminActor(request: Request): Promise<{
    admin_id: string | null;
    admin_email: string | null;
    admin_name: string | null;
    admin_role: string | null;
}> {
    try {
        const supabase = await createSupabaseServerClientFromRequest(request);
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) {
            return {
                admin_id: null,
                admin_email: null,
                admin_name: null,
                admin_role: null,
            };
        }

        const supabaseAdmin = getSupabaseAdminFromRequest(request);
        const { data: adminRow } = await supabaseAdmin
            .from('admin')
            .select('id, full_name, role, user_id')
            .eq('user_id', user.id)
            .maybeSingle();

        const admin = adminRow as AdminActorRow | null;
        return {
            admin_id: admin?.id ?? null,
            admin_email: user.email ?? null,
            admin_name: admin?.full_name ?? null,
            admin_role: admin?.role ?? null,
        };
    } catch {
        return {
            admin_id: null,
            admin_email: null,
            admin_name: null,
            admin_role: null,
        };
    }
}

export async function logAdminActivity(input: LogAdminActivityInput): Promise<void> {
    try {
        const supabaseAdmin = getSupabaseAdminFromRequest(input.request);
        const actor = await resolveAdminActor(input.request);
        const env = getSupabaseTargetFromRequest(input.request);
        const route = new URL(input.request.url).pathname;

        const { error } = await supabaseAdmin.from('admin_activity_log').insert({
            admin_id: actor.admin_id,
            admin_email: actor.admin_email,
            admin_name: actor.admin_name,
            admin_role: actor.admin_role,
            action: input.action,
            resource_type: input.resource_type,
            resource_id: input.resource_id ?? null,
            route,
            summary: input.summary,
            metadata: sanitizeLogMetadata(input.metadata ?? {}),
            env,
        });

        if (error) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('[activity-log] insert failed:', error.message);
            }
        }
    } catch (error: unknown) {
        if (process.env.NODE_ENV === 'development') {
            const message = error instanceof Error ? error.message : 'unknown error';
            console.warn('[activity-log] unexpected error:', message);
        }
    }
}
