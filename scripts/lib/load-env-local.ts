import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function copyFirstEnv(targetKey: string, sourceKeys: string[]): void {
    for (const sourceKey of sourceKeys) {
        const source = process.env[sourceKey]?.trim();
        if (source) {
            process.env[targetKey] = source;
            return;
        }
    }
}

function applyStagingEnvOverrides(): void {
    if (process.env.SUPABASE_ENV !== 'staging') return;

    copyFirstEnv('NEXT_PUBLIC_SUPABASE_URL', [
        'NEXT_PUBLIC_SUPABASE_URL_STAGING',
        'SUPABASE_URL_STAGING',
    ]);
    copyFirstEnv('SUPABASE_URL', ['SUPABASE_URL_STAGING']);
    copyFirstEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', [
        'NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING',
        'SUPABASE_ANON_KEY_STAGING',
    ]);
    copyFirstEnv('SUPABASE_ANON_KEY', ['SUPABASE_ANON_KEY_STAGING']);
    copyFirstEnv('SUPABASE_SERVICE_ROLE_KEY', ['SUPABASE_SERVICE_ROLE_KEY_STAGING']);
    copyFirstEnv('EDGE_FUNCTIONS_BASE_URL', ['EDGE_FUNCTIONS_BASE_URL_STAGING']);
}

export function loadEnvLocal(): void {
    const p = resolve(process.cwd(), '.env.local');
    if (!existsSync(p)) {
        applyStagingEnvOverrides();
        return;
    }
    const raw = readFileSync(p, 'utf8');
    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
        ) {
            val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = val;
    }
    applyStagingEnvOverrides();
}
