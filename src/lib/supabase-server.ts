import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
    getPublicSupabaseConfig,
    getServerSupabaseTarget,
    getSupabaseTargetFromRequest,
    type SupabaseTarget,
} from '@/lib/supabase-env';

export async function createSupabaseServerClient(target?: SupabaseTarget): Promise<SupabaseClient> {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const resolvedTarget = target ?? await getServerSupabaseTarget();
    const config = getPublicSupabaseConfig(resolvedTarget);

    return createServerClient(config.url, config.anonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                } catch {
                }
            },
        },
    });
}

export async function createSupabaseServerClientFromRequest(request: Request): Promise<SupabaseClient> {
    const target = getSupabaseTargetFromRequest(request);
    return createSupabaseServerClient(target);
}
