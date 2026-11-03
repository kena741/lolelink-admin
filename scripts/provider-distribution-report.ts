/**
 * One-shot provider distribution HTML report from live Supabase data.
 *
 *   pnpm report:provider-distribution
 *   → reports/provider-distribution-YYYY-MM-DD.html
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    buildProviderDistributionReport,
    normalizeServiceRow,
    parseMoney,
    type DistBooking,
    type DistProvider,
    type DistService,
} from '../src/lib/provider-distribution';
import { loadEnvLocal } from './lib/load-env-local';
import { renderProviderDistributionHtml } from './lib/provider-distribution-html';

async function fetchAllRows(
    supabase: SupabaseClient,
    table: string,
    select: string
): Promise<Record<string, unknown>[]> {
    const pageSize = 1000;
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += pageSize) {
        const to = from + pageSize - 1;
        const { data, error } = await supabase.from(table).select(select).range(from, to);
        if (error) throw new Error(`${table}: ${error.message}`);
        const batch = (data ?? []) as unknown as Record<string, unknown>[];
        rows.push(...batch);
        if (batch.length < pageSize) break;
    }
    return rows;
}

function providerName(row: Record<string, unknown>): string {
    const first = String(row.firstName ?? row.first_name ?? '').trim();
    const last = String(row.lastName ?? row.last_name ?? '').trim();
    const full = [first, last].filter(Boolean).join(' ');
    return full || String(row.name ?? row.id ?? 'Provider');
}

function isArchivedProvider(row: Record<string, unknown>): boolean {
    const v = row.archived_at ?? row.archivedAt;
    return typeof v === 'string' && v.length > 0;
}

function money(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) return '—';
    return `ETB ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

async function main(): Promise<void> {
    loadEnvLocal();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    const supabase = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log('Fetching providers…');
    const providerRows = await fetchAllRows(
        supabase,
        'provider',
        'id, firstName, lastName, address, location, active, activation_paid, service_tier_max, archived_at'
    );

    console.log('Fetching services…');
    const serviceRows = await fetchAllRows(
        supabase,
        'service',
        'id, provider_id, price, categoryModel, categoryId, active, status, isArchived, description'
    );

    console.log('Fetching bookings…');
    let bookingRows: Record<string, unknown>[];
    try {
        bookingRows = await fetchAllRows(
            supabase,
            'booked_service',
            'id, provider_id, status, totalAmount, price, createdAt, serviceName, is_archived'
        );
    } catch (error) {
        console.warn(String(error));
        bookingRows = await fetchAllRows(
            supabase,
            'booked_service',
            'id, provider_id, status, totalAmount, price, createdAt, serviceName'
        );
    }

    const providers: DistProvider[] = providerRows.map((row) => ({
        id: String(row.id ?? ''),
        name: providerName(row),
        address: typeof row.address === 'string' ? row.address : null,
        location: (row.location as Record<string, unknown> | null) ?? null,
        active: typeof row.active === 'boolean' ? row.active : null,
        activation_paid: typeof row.activation_paid === 'boolean' ? row.activation_paid : null,
        service_tier_max: typeof row.service_tier_max === 'number' ? row.service_tier_max : null,
        archived: isArchivedProvider(row),
    }));

    const services: DistService[] = serviceRows.map((row) => normalizeServiceRow(row));

    const categoryByProvider = new Map<string, string>();
    for (const service of services) {
        if (service.archived || !service.active) continue;
        if (!categoryByProvider.has(service.provider_id)) {
            categoryByProvider.set(service.provider_id, service.categoryName);
        }
    }

    const bookings: DistBooking[] = bookingRows
        .filter((row) => row.is_archived !== true)
        .map((row) => {
            const providerId = String(row.provider_id ?? '');
            return {
                id: String(row.id ?? ''),
                provider_id: providerId,
                status: String(row.status ?? ''),
                amount: parseMoney(row.totalAmount) ?? parseMoney(row.price) ?? 0,
                createdAt: typeof row.createdAt === 'string' ? row.createdAt : null,
                categoryName: categoryByProvider.get(providerId) ?? 'Uncategorized',
            };
        });

    const report = buildProviderDistributionReport({ providers, services, bookings });

    const outDir = resolve(process.cwd(), 'reports');
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const day = report.generatedAt.slice(0, 10);
    const outPath = resolve(outDir, `provider-distribution-${day}.html`);

    writeFileSync(outPath, renderProviderDistributionHtml(report), 'utf8');
    console.log(`Wrote ${outPath}`);
    console.log(
        `Snapshot: ${report.snapshot.totalProviders} providers · median list ${money(report.snapshot.medianListPrice)} · completed ${money(report.snapshot.completedRevenueAll)}`
    );
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
