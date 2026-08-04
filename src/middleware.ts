import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
    getPublicSupabaseConfig,
    parseSupabaseTarget,
    SUPABASE_ENV_COOKIE,
} from '@/lib/supabase-env';

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({ request });

    const target = parseSupabaseTarget(request.cookies.get(SUPABASE_ENV_COOKIE)?.value);
    const config = getPublicSupabaseConfig(target);

    const supabase = createServerClient(config.url, config.anonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
                cookiesToSet.forEach(({ name, value }) => {
                    request.cookies.set(name, value);
                });
                response = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) => {
                    response.cookies.set(name, value, options);
                });
            },
        },
    });

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/login';
        loginUrl.searchParams.set('error', 'auth');
        loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
        return NextResponse.redirect(loginUrl);
    }

    return response;
}

export const config = {
    matcher: ['/admin/:path*'],
};
