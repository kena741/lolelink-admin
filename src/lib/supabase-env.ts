import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseTarget = 'prod' | 'staging';

export const SUPABASE_ENV_COOKIE = 'supabase_env';
export const SUPABASE_ENV_HEADER = 'x-supabase-env';
export const SUPABASE_ENV_STORAGE_KEY = 'supabase_env';

export interface SupabasePublicConfig {
    target: SupabaseTarget;
    url: string;
    anonKey: string;
    edgeFunctionsBaseUrl: string;
}

export interface SupabaseEnvConfig extends SupabasePublicConfig {
    serviceRoleKey: string;
}

const adminClients = new Map<SupabaseTarget, SupabaseClient>();

function trimEnv(value: string | undefined): string | undefined {
    const v = value?.trim();
    return v && v.length > 0 ? v : undefined;
}

const PUBLIC_PROD_URL = trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const PUBLIC_PROD_ANON = trimEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const PUBLIC_STAGING_URL = trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL_STAGING);
const PUBLIC_STAGING_ANON = trimEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING);

function readServerEnv(name: string): string | undefined {
    return trimEnv(process.env[name]);
}

function prodUrl(): string | undefined {
    return PUBLIC_PROD_URL ?? readServerEnv('SUPABASE_URL');
}

function prodAnonKey(): string | undefined {
    return PUBLIC_PROD_ANON ?? readServerEnv('SUPABASE_ANON_KEY');
}

function prodServiceRoleKey(): string | undefined {
    return readServerEnv('SUPABASE_SERVICE_ROLE_KEY');
}

function stagingUrl(): string | undefined {
    return PUBLIC_STAGING_URL ?? readServerEnv('SUPABASE_URL_STAGING');
}

function stagingAnonKey(): string | undefined {
    return PUBLIC_STAGING_ANON ?? readServerEnv('SUPABASE_ANON_KEY_STAGING');
}

function stagingServiceRoleKey(): string | undefined {
    return readServerEnv('SUPABASE_SERVICE_ROLE_KEY_STAGING');
}

function prodEdgeBaseUrl(url: string): string {
    return readServerEnv('EDGE_FUNCTIONS_BASE_URL') ?? `${url.replace(/\/$/, '')}/functions/v1`;
}

function stagingEdgeBaseUrl(url: string): string {
    return (
        readServerEnv('EDGE_FUNCTIONS_BASE_URL_STAGING') ??
        `${url.replace(/\/$/, '')}/functions/v1`
    );
}

function isClientRuntime(): boolean {
    return typeof window !== 'undefined';
}

export function isStagingConfigured(): boolean {
    const url = stagingUrl();
    const anonKey = stagingAnonKey();
    if (!url || !anonKey) return false;
    if (isClientRuntime()) return true;
    return Boolean(stagingServiceRoleKey());
}

export function isEnvSwitcherEnabled(): boolean {
    if (process.env.NODE_ENV === 'development') return isStagingConfigured();
    return (
        process.env.NEXT_PUBLIC_ENABLE_SUPABASE_ENV_SWITCHER === 'true' &&
        isStagingConfigured()
    );
}

export function parseSupabaseTarget(raw: string | null | undefined): SupabaseTarget {
    if (raw === 'staging' && isStagingConfigured()) return 'staging';
    return 'prod';
}

export function getPublicSupabaseConfig(target: SupabaseTarget): SupabasePublicConfig {
    if (target === 'staging') {
        const url = stagingUrl();
        const anonKey = stagingAnonKey();
        if (!url || !anonKey) {
            throw new Error(
                'Staging Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL_STAGING and NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING in .env.local (restart dev server after changes).'
            );
        }
        return {
            target: 'staging',
            url,
            anonKey,
            edgeFunctionsBaseUrl: stagingEdgeBaseUrl(url),
        };
    }

    const url = prodUrl();
    const anonKey = prodAnonKey();
    if (!url || !anonKey) {
        throw new Error(
            'Production Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (restart dev server after changes).'
        );
    }
    const edge = prodEdgeBaseUrl(url);
    return {
        target: 'prod',
        url,
        anonKey,
        edgeFunctionsBaseUrl: edge,
    };
}

export function getSupabaseConfig(target: SupabaseTarget): SupabaseEnvConfig {
    const publicConfig = getPublicSupabaseConfig(target);

    if (isClientRuntime()) {
        return {
            ...publicConfig,
            serviceRoleKey: '',
        };
    }

    const serviceRoleKey =
        target === 'staging' ? stagingServiceRoleKey() : prodServiceRoleKey();
    if (!serviceRoleKey) {
        const keyName =
            target === 'staging'
                ? 'SUPABASE_SERVICE_ROLE_KEY_STAGING'
                : 'SUPABASE_SERVICE_ROLE_KEY';
        throw new Error(
            `${target === 'staging' ? 'Staging' : 'Production'} Supabase admin is not configured. Set ${keyName} in .env.local.`
        );
    }

    return {
        ...publicConfig,
        serviceRoleKey,
    };
}

export function getEdgeFunctionsBaseUrl(target: SupabaseTarget): string {
    return getPublicSupabaseConfig(target).edgeFunctionsBaseUrl;
}

export function getSupabaseTargetFromRequest(request: Request): SupabaseTarget {
    const header = request.headers.get(SUPABASE_ENV_HEADER);
    if (header) return parseSupabaseTarget(header);

    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return 'prod';

    const match = cookieHeader
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${SUPABASE_ENV_COOKIE}=`));
    if (!match) return 'prod';

    const value = match.slice(SUPABASE_ENV_COOKIE.length + 1);
    return parseSupabaseTarget(decodeURIComponent(value));
}

export function getSupabaseAdmin(target?: SupabaseTarget): SupabaseClient {
    const resolved = target ?? 'prod';
    const cached = adminClients.get(resolved);
    if (cached) return cached;

    const config = getSupabaseConfig(resolved);
    const client = createClient(config.url, config.serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
    adminClients.set(resolved, client);
    return client;
}

export function getSupabaseAdminFromRequest(request: Request): SupabaseClient {
    return getSupabaseAdmin(getSupabaseTargetFromRequest(request));
}

export function getClientSupabaseTarget(): SupabaseTarget {
    if (typeof window === 'undefined') return 'prod';
    const stored = window.localStorage.getItem(SUPABASE_ENV_STORAGE_KEY);
    return parseSupabaseTarget(stored);
}

export function setClientSupabaseTarget(target: SupabaseTarget): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SUPABASE_ENV_STORAGE_KEY, target);
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${SUPABASE_ENV_COOKIE}=${encodeURIComponent(target)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export async function getServerSupabaseTarget(): Promise<SupabaseTarget> {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const value = cookieStore.get(SUPABASE_ENV_COOKIE)?.value;
    return parseSupabaseTarget(value);
}
