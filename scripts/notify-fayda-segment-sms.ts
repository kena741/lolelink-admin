import { createClient } from '@supabase/supabase-js';
import { sendSms, buildRecipient } from '../src/lib/sms';
import {
    fetchFaydaStatusByProviderId,
    fetchNationalIdDocumentIds,
    type FaydaVerificationStatus,
} from './lib/fayda-documents';
import {
    parseFaydaSmsSegment,
    resolveFaydaSegmentMessageTemplate,
    type FaydaSmsSegment,
} from './lib/fayda-segment-sms-defaults';
import { loadEnvLocal } from './lib/load-env-local';
import { fetchServiceCountsByProvider } from './lib/service-counts-by-provider';

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

function parseArgValue(prefix: string): string | undefined {
    const raw = process.argv.find((a) => a.startsWith(prefix));
    if (!raw) return undefined;
    const eq = raw.indexOf('=');
    if (eq === -1) return undefined;
    const v = raw.slice(eq + 1).trim();
    return v.length > 0 ? v : undefined;
}

function providerInSegment(
    segment: FaydaSmsSegment,
    faydaStatus: FaydaVerificationStatus,
    serviceCount: number
): boolean {
    if (segment === 'approved-zero-services') {
        return faydaStatus === 'verified' && serviceCount === 0;
    }
    return faydaStatus === segment;
}

function describeSegmentEligibility(
    segment: FaydaSmsSegment,
    faydaStatus: FaydaVerificationStatus,
    serviceCount: number
): string {
    if (segment === 'approved-zero-services') {
        return `Fayda status must be verified and service count must be 0 (current: ${faydaStatus}, services=${serviceCount})`;
    }
    return `Fayda status must be "${segment}" (current: ${faydaStatus})`;
}

async function main(): Promise<void> {
    loadEnvLocal();

    const segment = parseFaydaSmsSegment(parseArgValue('--segment='));
    if (!segment) {
        console.error(
            'Missing or invalid --segment=. Use: --segment=approved-zero-services|rejected|none|pending'
        );
        process.exit(1);
    }

    const messageTemplate = resolveFaydaSegmentMessageTemplate(segment);
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

    const counts = await fetchServiceCountsByProvider(supabase);
    const rows = (providers as ProviderRow[]).filter((p) => !isArchived(p));
    const nationalDocIds = await fetchNationalIdDocumentIds(supabase);
    const faydaByProvider = await fetchFaydaStatusByProviderId(supabase, nationalDocIds);

    if (nationalDocIds.length === 0) {
        console.warn(
            'No documents row matched National ID / Fayda name. Fayda status will be "none" for everyone. Check documents.name in Supabase.'
        );
    }

    let targets: ProviderRow[];

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
        const faydaStatus = faydaByProvider.get(p.id) ?? 'none';
        const n = counts.get(p.id) ?? 0;
        const eligible = providerInSegment(segment, faydaStatus, n);
        if (!eligible && !forceSingle) {
            console.error(
                `Provider does not match segment "${segment}". ${describeSegmentEligibility(segment, faydaStatus, n)}. Use --force to send a test SMS anyway.`
            );
            process.exit(1);
        }
        if (!eligible && forceSingle) {
            console.warn(
                `Warning: provider does not match segment "${segment}"; sending anyway (--force). ${describeSegmentEligibility(segment, faydaStatus, n)}`
            );
        }
        targets = [p];
    } else {
        targets = rows.filter((p) => {
            const faydaStatus = faydaByProvider.get(p.id) ?? 'none';
            const n = counts.get(p.id) ?? 0;
            return providerInSegment(segment, faydaStatus, n);
        });
    }

    const batchEligible = rows.filter((p) => {
        const faydaStatus = faydaByProvider.get(p.id) ?? 'none';
        const n = counts.get(p.id) ?? 0;
        return providerInSegment(segment, faydaStatus, n);
    }).length;

    console.log(`Segment: ${segment}`);
    console.log(`Providers (non-archived): ${rows.length}`);
    if (!onlyProviderId) {
        console.log(`Eligible for segment: ${batchEligible}`);
    } else {
        const p = targets[0];
        const faydaStatus = faydaByProvider.get(p.id) ?? 'none';
        const n = counts.get(p.id) ?? 0;
        console.log(
            `Single provider: ${p.id}  ${providerName(p)}  fayda=${faydaStatus}  services=${n}${!providerInSegment(segment, faydaStatus, n) && forceSingle ? ' (--force)' : ''}`
        );
    }
    if (dryRun) console.log('Dry run — no SMS will be sent.\n');

    let sent = 0;
    let skippedNoPhone = 0;
    let failed = 0;
    let dryRunListed = 0;
    let smsAttempts = 0;

    for (const p of targets) {
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
