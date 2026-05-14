import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendSms, buildRecipient } from '../src/lib/sms';

function loadEnvLocal(): void {
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

interface ProviderRow {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
    phone?: string | null;
    phoneNumber?: string | null;
    countryCode?: string | null;
    country_code?: string | null;
    archived_at?: string | null;
    archivedAt?: string | null;
}

function providerName(p: ProviderRow): string {
    const first = (p.firstName ?? p.first_name ?? '').toString().trim();
    const last = (p.lastName ?? p.last_name ?? '').toString().trim();
    const full = [first, last].filter(Boolean).join(' ');
    return (full || p.name || 'there').toString();
}

function isArchived(p: ProviderRow): boolean {
    const v = p.archived_at ?? p.archivedAt;
    return typeof v === 'string' && v.length > 0;
}

function isNationalIdDocumentName(name: string | null | undefined): boolean {
    const n = (name ?? '').toLowerCase();
    if (!n) return false;
    if (n.includes('fayda')) return true;
    if (n.includes('national id') || n.includes('national-id') || n.includes('nationalid')) return true;
    return false;
}

async function nationalIdDocumentIds(supabase: SupabaseClient): Promise<string[]> {
    const { data, error } = await supabase.from('documents').select('id, name');
    if (error || !data) {
        if (error) console.error('Failed to load documents for National ID filter:', error.message);
        return [];
    }
    const ids: string[] = [];
    for (const row of data as { id: string; name?: string | null }[]) {
        if (row.id && isNationalIdDocumentName(row.name)) ids.push(row.id);
    }
    return ids;
}

async function providerIdsWithVerifiedNationalId(
    supabase: SupabaseClient,
    documentIds: string[]
): Promise<Set<string>> {
    const out = new Set<string>();
    if (documentIds.length === 0) return out;
    const pageSize = 1000;
    let from = 0;
    for (;;) {
        const { data, error } = await supabase
            .from('verify_documents')
            .select('providerId')
            .in('documentId', documentIds)
            .eq('isVerify', true)
            .range(from, from + pageSize - 1);
        if (error) {
            console.error('Failed to load verified National ID rows:', error.message);
            return out;
        }
        const rows = data as { providerId?: string | null }[] | null;
        if (!rows?.length) break;
        for (const r of rows) {
            const id = r.providerId;
            if (id) out.add(id);
        }
        if (rows.length < pageSize) break;
        from += pageSize;
    }
    return out;
}

async function serviceCountsByProvider(supabase: SupabaseClient): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    const bump = (rows: { provider_id?: string | null }[] | null) => {
        for (const r of rows ?? []) {
            const id = r.provider_id;
            if (!id) continue;
            map.set(id, (map.get(id) ?? 0) + 1);
        }
    };
    const { data: a, error: e1 } = await supabase.from('service').select('provider_id');
    if (!e1 && a) {
        bump(a as { provider_id?: string | null }[]);
        return map;
    }
    const { data: b } = await supabase.from('services').select('provider_id');
    bump(b as { provider_id?: string | null }[]);
    return map;
}

function parseArgValue(prefix: string): string | undefined {
    const raw = process.argv.find((a) => a.startsWith(prefix));
    if (!raw) return undefined;
    const eq = raw.indexOf('=');
    if (eq === -1) return undefined;
    const v = raw.slice(eq + 1).trim();
    return v.length > 0 ? v : undefined;
}

async function main(): Promise<void> {
    loadEnvLocal();

    const messageTemplate =
        process.env.ZERO_SERVICES_SMS_MESSAGE ??
        'ሰላም {{name}}! ከዘመን ፕሮቫይደር ሰለተመዘገቡ እናመሰግናለን። በዘመን ፕሮቫይደር መተግበሪያ ላይ እስካሁን አገልግሎት አልጨመሩም። እባክዎ አገልግሎትዎን ያስገቡ፤ ደንበኞች እርስዎን ሲፈልጉ ያገኙዎታል። ጥያቄ ካለዎት በዚህ ስልክ 0941024355 ደውለው ይጠይቁ:: ለትብብርዎ እናመሰግናለን!! መልካም ስራ!';

    const dryRun = process.argv.includes('--dry-run');
    const forceSingle = process.argv.includes('--force');
    const onlyProviderId = parseArgValue('--provider-id=');

    let limit = Number.POSITIVE_INFINITY;
    const limitArg = process.argv.find((a) => a.startsWith('--limit='));
    if (limitArg) {
        const n = Number.parseInt(limitArg.split('=')[1] ?? '', 10);
        if (Number.isFinite(n) && n > 0) limit = n;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
        process.exit(1);
    }

    const supabase = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: providers, error } = await supabase.from('provider').select('*');
    if (error || !providers) {
        console.error('Failed to load providers:', error?.message ?? 'unknown');
        process.exit(1);
    }

    const counts = await serviceCountsByProvider(supabase);
    const rows = (providers as ProviderRow[]).filter((p) => !isArchived(p));
    const zeroCandidatesAll = rows.filter((p) => (counts.get(p.id) ?? 0) === 0);

    const nationalDocIds = await nationalIdDocumentIds(supabase);
    const verifiedNationalId = await providerIdsWithVerifiedNationalId(supabase, nationalDocIds);
    if (nationalDocIds.length === 0) {
        console.warn(
            'No documents row matched National ID / Fayda name; no provider will be eligible. Check documents.name in Supabase.'
        );
    }

    let zeroService: ProviderRow[];

    if (onlyProviderId) {
        const p = rows.find((r) => r.id === onlyProviderId);
        if (!p) {
            const exists = (providers as ProviderRow[]).some((r) => r.id === onlyProviderId);
            if (!exists) {
                console.error('Provider not found:', onlyProviderId);
                process.exit(1);
            }
            console.error('Provider is archived or not in active list:', onlyProviderId);
            process.exit(1);
        }
        const n = counts.get(p.id) ?? 0;
        if (n > 0 && !forceSingle) {
            console.error(
                `Provider has ${n} service(s). Use --force to send this test SMS anyway, or pick a provider with 0 services.`
            );
            process.exit(1);
        }
        if (!verifiedNationalId.has(p.id)) {
            console.error(
                'Provider National ID is not verified (no approved verify_documents row for a National ID / Fayda document type). Not sending SMS.'
            );
            process.exit(1);
        }
        zeroService = [p];
    } else {
        zeroService = zeroCandidatesAll.filter((p) => verifiedNationalId.has(p.id));
    }

    console.log(`Providers (non-archived): ${rows.length}`);
    console.log(`National-ID document types matched: ${nationalDocIds.length}`);
    if (!onlyProviderId) {
        console.log(`With 0 services: ${zeroCandidatesAll.length}`);
        console.log(`Eligible (0 services + verified National ID): ${zeroService.length}`);
    } else {
        const p = zeroService[0];
        const n = counts.get(p.id) ?? 0;
        console.log(
            `Single provider: ${p.id}  ${providerName(p)}  services=${n}${n > 0 && forceSingle ? ' (--force)' : ''}`
        );
    }
    if (dryRun) console.log('Dry run — no SMS will be sent.\n');

    let sent = 0;
    let skippedNoPhone = 0;
    let failed = 0;
    let dryRunListed = 0;
    let smsAttempts = 0;

    for (const p of zeroService) {
        const phone = buildRecipient(
            p.phoneNumber ?? p.phone,
            p.countryCode ?? p.country_code
        );
        const name = providerName(p);
        const message = messageTemplate.replace(/\{\{\s*name\s*\}\}/gi, name);

        if (!phone) {
            skippedNoPhone += 1;
            console.log(`skip no phone  ${p.id}  ${name}`);
            continue;
        }

        if (smsAttempts >= limit) break;
        smsAttempts += 1;

        if (dryRun) {
            dryRunListed += 1;
            console.log(`would send  ${p.id}  ${name}  ${phone}`);
            continue;
        }

        const result = await sendSms(phone, message);
        if (result.success) {
            sent += 1;
            console.log(`sent  ${p.id}  ${name}  ${phone}`);
        } else {
            failed += 1;
            console.error(`fail  ${p.id}  ${name}  ${result.error ?? 'unknown'}`);
        }
    }

    console.log('\nSummary');
    console.log(`  sent: ${sent}`);
    console.log(`  dry-run (would send): ${dryRunListed}`);
    console.log(`  skipped (no phone): ${skippedNoPhone}`);
    console.log(`  failed: ${failed}`);
    if (limit !== Number.POSITIVE_INFINITY) console.log(`  sms attempt limit: ${limit}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
