import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import {
    fetchFaydaStatusByProviderId,
    fetchNationalIdDocumentsMeta,
    type FaydaVerificationStatus,
} from './lib/fayda-documents';
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
    archived_at?: string | null;
    archivedAt?: string | null;
}

function providerName(p: ProviderRow): string {
    const first = (p.firstName ?? p.first_name ?? '').toString().trim();
    const last = (p.lastName ?? p.last_name ?? '').toString().trim();
    const full = [first, last].filter(Boolean).join(' ');
    return (full || p.name || '(no name)').toString();
}

function isArchived(p: ProviderRow): boolean {
    const v = p.archived_at ?? p.archivedAt;
    return typeof v === 'string' && v.length > 0;
}

function formatPhone(p: ProviderRow): string {
    const raw = (p.phoneNumber ?? p.phone ?? '').toString().trim();
    return raw || '—';
}

function parseFilter(): FaydaVerificationStatus | 'all' {
    const raw = process.argv.find((a) => a.startsWith('--status='));
    if (!raw) return 'all';
    const v = raw.split('=')[1]?.trim().toLowerCase();
    if (v === 'verified' || v === 'pending' || v === 'rejected' || v === 'none') return v;
    return 'all';
}

async function main(): Promise<void> {
    loadEnvLocal();

    const includeArchived = process.argv.includes('--include-archived');
    const statusFilter = parseFilter();

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

    const meta = await fetchNationalIdDocumentsMeta(supabase);
    const docIds = meta.map((m) => m.id);
    const faydaByProvider = await fetchFaydaStatusByProviderId(supabase, docIds);
    const serviceCounts = await fetchServiceCountsByProvider(supabase);

    const allRows = providers as ProviderRow[];
    const rows = includeArchived ? allRows : allRows.filter((p) => !isArchived(p));

    console.log('Fayda / National ID verification (same document name rules as notify-zero-services)\n');
    if (meta.length === 0) {
        console.warn('No documents matched National ID / Fayda name. Check documents.name in Supabase.\n');
    } else {
        console.log('Matched document types:');
        for (const m of meta) {
            console.log(`  ${m.id}  ${m.name ?? ''}`);
        }
        console.log('');
    }

    console.log(
        includeArchived
            ? 'Scope: all providers (including archived)\n'
            : 'Scope: non-archived providers only (use --include-archived for everyone)\n'
    );

    type RowOut = { p: ProviderRow; services: number };
    const byStatus: Record<FaydaVerificationStatus, RowOut[]> = {
        verified: [],
        pending: [],
        rejected: [],
        none: [],
    };

    for (const p of rows) {
        const status = faydaByProvider.get(p.id) ?? 'none';
        const services = serviceCounts.get(p.id) ?? 0;
        byStatus[status].push({ p, services });
    }

    for (const k of Object.keys(byStatus) as FaydaVerificationStatus[]) {
        byStatus[k].sort((a, b) => providerName(a.p).localeCompare(providerName(b.p)));
    }

    const header = 'id\tname\tservices\tphone\tarchived';

    const printSection = (title: string, status: FaydaVerificationStatus, list: RowOut[]) => {
        if (statusFilter !== 'all' && statusFilter !== status) return;
        console.log(`--- ${title} (${list.length}) ---`);
        console.log(header);
        for (const { p, services } of list) {
            const arch = isArchived(p) ? 'yes' : 'no';
            console.log(
                `${p.id}\t${providerName(p)}\t${services}\t${formatPhone(p)}\t${arch}`
            );
        }
        console.log('');
    };

    printSection('VERIFIED', 'verified', byStatus.verified);
    printSection('PENDING', 'pending', byStatus.pending);
    printSection('REJECTED', 'rejected', byStatus.rejected);
    printSection('NONE (no Fayda/National ID upload or no matching row)', 'none', byStatus.none);

    console.log('Summary');
    console.log(`  verified:  ${byStatus.verified.length}`);
    console.log(`  pending:   ${byStatus.pending.length}`);
    console.log(`  rejected:  ${byStatus.rejected.length}`);
    console.log(`  none:      ${byStatus.none.length}`);
    console.log(`  providers in scope: ${rows.length}`);
    console.log('\nFlags: --include-archived  |  --status=verified|pending|rejected|none');
    console.log('Doc IDs used:', docIds.length ? docIds.join(', ') : '(none)');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
