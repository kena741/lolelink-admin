import '@testing-library/jest-dom/vitest';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test-project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test-project.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';

const BLOCKED_SUPABASE_HOST_PATTERNS = [
    /zemenservice/i,
    /lolelink/i,
    /production/i,
];

function assertSafeSupabaseUrl(url: string | undefined, label: string): void {
    if (!url) return;
    const host = (() => {
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    })();

    for (const pattern of BLOCKED_SUPABASE_HOST_PATTERNS) {
        if (pattern.test(host)) {
            throw new Error(`[vitest] Refusing to run tests against production-like ${label}: ${host}`);
        }
    }
}

assertSafeSupabaseUrl(process.env.SUPABASE_URL, 'SUPABASE_URL');
assertSafeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
