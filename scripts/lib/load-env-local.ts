import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadEnvLocal(): void {
    const p = resolve(process.cwd(), '.env.local');
    if (!existsSync(p)) return;
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
}
