import type { SupabaseClient } from '@supabase/supabase-js';

function isNationalIdDocumentName(name: string | null | undefined): boolean {
    const n = (name ?? '').toLowerCase();
    if (!n) return false;
    if (n.includes('fayda')) return true;
    if (n.includes('national id') || n.includes('national-id') || n.includes('nationalid')) return true;
    return false;
}

export interface NationalIdDocumentMeta {
    id: string;
    name: string | null;
}

export async function fetchNationalIdDocumentsMeta(
    supabase: SupabaseClient
): Promise<NationalIdDocumentMeta[]> {
    const { data, error } = await supabase.from('documents').select('id, name');
    if (error || !data) {
        if (error) console.error('Failed to load documents for National ID / Fayda:', error.message);
        return [];
    }
    const out: NationalIdDocumentMeta[] = [];
    for (const row of data as { id: string; name?: string | null }[]) {
        if (row.id && isNationalIdDocumentName(row.name)) {
            out.push({ id: row.id, name: row.name ?? null });
        }
    }
    return out;
}

export async function fetchNationalIdDocumentIds(supabase: SupabaseClient): Promise<string[]> {
    const meta = await fetchNationalIdDocumentsMeta(supabase);
    return meta.map((m) => m.id);
}

export type FaydaVerificationStatus = 'verified' | 'pending' | 'rejected' | 'none';

function foldFaydaStatuses(values: (boolean | null | undefined)[]): FaydaVerificationStatus {
    if (values.length === 0) return 'none';
    if (values.some((v) => v === true)) return 'verified';
    if (values.some((v) => v === null || v === undefined)) return 'pending';
    if (values.some((v) => v === false)) return 'rejected';
    return 'none';
}

export async function fetchFaydaStatusByProviderId(
    supabase: SupabaseClient,
    documentIds: string[]
): Promise<Map<string, FaydaVerificationStatus>> {
    const buckets = new Map<string, (boolean | null)[]>();
    if (documentIds.length === 0) return new Map();

    const pageSize = 1000;
    let from = 0;
    for (;;) {
        const { data, error } = await supabase
            .from('verify_documents')
            .select('providerId, isVerify')
            .in('documentId', documentIds)
            .range(from, from + pageSize - 1);
        if (error) {
            console.error('Failed to load verify_documents for Fayda status:', error.message);
            return new Map();
        }
        const rows = data as { providerId?: string | null; isVerify?: boolean | null }[] | null;
        if (!rows?.length) break;
        for (const r of rows) {
            const pid = r.providerId;
            if (!pid) continue;
            const list = buckets.get(pid) ?? [];
            list.push(r.isVerify ?? null);
            buckets.set(pid, list);
        }
        if (rows.length < pageSize) break;
        from += pageSize;
    }

    const out = new Map<string, FaydaVerificationStatus>();
    for (const [pid, vis] of buckets) {
        out.set(pid, foldFaydaStatuses(vis));
    }
    return out;
}

export async function fetchVerifiedFaydaProviderIds(
    supabase: SupabaseClient,
    documentIds: string[]
): Promise<Set<string>> {
    const byProvider = await fetchFaydaStatusByProviderId(supabase, documentIds);
    const set = new Set<string>();
    for (const [pid, st] of byProvider) {
        if (st === 'verified') set.add(pid);
    }
    return set;
}
