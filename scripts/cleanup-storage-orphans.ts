import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';

const BUCKET = 'betegnabucket';
const BATCH_SIZE = 100;

interface ListedFile {
    name: string;
    metadata: { size?: number } | null;
}

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error(
            'Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
        );
    }
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

function normalizeStoragePath(url: string): string | null {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length).replace(/%20/g, ' ');
}

function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} kB`;
    return `${bytes} B`;
}

function readStringField(row: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
        const value = row[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
}

function readStringArrayField(row: Record<string, unknown>, keys: string[]): string[] {
    for (const key of keys) {
        const value = row[key];
        if (!Array.isArray(value)) continue;
        return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
    }
    return [];
}

function isPlaceholderProfileUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('firebasestorage.googleapis.com') || lower.includes('placeholder');
}

function resolveProfileImageColumn(row: Record<string, unknown>): string | null {
    if ('profileImage' in row) return 'profileImage';
    if ('profile_image' in row) return 'profile_image';
    return null;
}

async function fetchReferencedPaths(supabase: SupabaseClient): Promise<Set<string>> {
    const paths = new Set<string>();

    const addUrl = (url: string | null) => {
        if (!url) return;
        const path = normalizeStoragePath(url);
        if (path) paths.add(path);
    };

    const [
        providers,
        handymen,
        categories,
        banners,
        verifyDocs,
        bookedServices,
        services,
    ] = await Promise.all([
        supabase.from('provider').select('*'),
        supabase.from('handyman').select('*'),
        supabase.from('category').select('*'),
        supabase.from('banner').select('*'),
        supabase.from('verify_documents').select('*'),
        supabase.from('booked_service').select('*'),
        supabase.from('service').select('*'),
    ]);

    const errors = [
        providers.error,
        handymen.error,
        categories.error,
        banners.error,
        verifyDocs.error,
        bookedServices.error,
        services.error,
    ].filter(Boolean);

    if (errors.length > 0) {
        throw new Error(errors.map((e) => e?.message).join('; '));
    }

    for (const row of providers.data ?? []) {
        const record = row as Record<string, unknown>;
        addUrl(readStringField(record, ['profileImage', 'profile_image']));
        addUrl(readStringField(record, ['banner']));
    }

    for (const row of handymen.data ?? []) {
        addUrl(readStringField(row as Record<string, unknown>, ['profileImage', 'profile_image']));
    }

    for (const row of categories.data ?? []) {
        addUrl(readStringField(row as Record<string, unknown>, ['image']));
    }

    for (const row of banners.data ?? []) {
        addUrl(readStringField(row as Record<string, unknown>, ['image']));
    }

    for (const row of verifyDocs.data ?? []) {
        addUrl(readStringField(row as Record<string, unknown>, ['documentImage', 'document_image']));
    }

    for (const row of bookedServices.data ?? []) {
        addUrl(readStringField(row as Record<string, unknown>, ['serviceImage', 'service_image']));
    }

    for (const row of services.data ?? []) {
        const record = row as Record<string, unknown>;
        for (const url of readStringArrayField(record, ['serviceImage', 'service_image'])) {
            addUrl(url);
        }
        addUrl(readStringField(record, ['video']));
    }

    return paths;
}

async function fetchDeletablePathsFromRpc(supabase: SupabaseClient): Promise<string[]> {
    const { data, error } = await supabase.rpc('get_deletable_storage_paths');

    if (error) {
        throw new Error(error.message);
    }

    return (data ?? []).map((row: { name: string }) => row.name);
}

function loadPathsFromFile(fileArg: string): string[] {
    const filePath = resolve(process.cwd(), fileArg);
    if (!existsSync(filePath)) {
        throw new Error(`Paths file not found: ${filePath}`);
    }

    const raw = readFileSync(filePath, 'utf8').trim();
    let paths: string[];

    if (raw.startsWith('[')) {
        paths = JSON.parse(raw) as string[];
    } else {
        paths = raw
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
    }

    return paths.filter((path) => path.length > 0);
}

async function countPlaceholderProfiles(
    supabase: SupabaseClient,
    table: 'provider' | 'handyman'
): Promise<number> {
    const { data, error } = await supabase.from(table).select('*');
    if (error) throw new Error(`Failed to load ${table} rows: ${error.message}`);

    return (data ?? []).filter((row) => {
        const url = readStringField(row as Record<string, unknown>, ['profileImage', 'profile_image']);
        return url ? isPlaceholderProfileUrl(url) : false;
    }).length;
}

async function clearPlaceholderProfiles(supabase: SupabaseClient) {
    let providersCleared = 0;
    let handymenCleared = 0;

    const { data: providerRows, error: providerLoadError } = await supabase
        .from('provider')
        .select('*');
    if (providerLoadError) {
        throw new Error(`Failed to load provider rows: ${providerLoadError.message}`);
    }

    for (const row of providerRows ?? []) {
        const record = row as Record<string, unknown> & { id: string };
        const column = resolveProfileImageColumn(record);
        const url = column ? readStringField(record, [column]) : null;
        if (!column || !url || !isPlaceholderProfileUrl(url)) continue;

        const { error } = await supabase
            .from('provider')
            .update({ [column]: null })
            .eq('id', record.id);
        if (error) {
            throw new Error(`Failed to clear provider ${record.id}: ${error.message}`);
        }
        providersCleared += 1;
    }

    const { data: handymanRows, error: handymanLoadError } = await supabase
        .from('handyman')
        .select('*');
    if (handymanLoadError) {
        throw new Error(`Failed to load handyman rows: ${handymanLoadError.message}`);
    }

    for (const row of handymanRows ?? []) {
        const record = row as Record<string, unknown> & { id: string };
        const column = resolveProfileImageColumn(record);
        const url = column ? readStringField(record, [column]) : null;
        if (!column || !url || !isPlaceholderProfileUrl(url)) continue;

        const { error } = await supabase
            .from('handyman')
            .update({ [column]: null })
            .eq('id', record.id);
        if (error) {
            throw new Error(`Failed to clear handyman ${record.id}: ${error.message}`);
        }
        handymenCleared += 1;
    }

    return {
        providers: providersCleared,
        handymen: handymenCleared,
    };
}

async function deleteStoragePaths(
    supabase: SupabaseClient,
    paths: string[]
): Promise<{ deleted: number; failed: number }> {
    let deleted = 0;
    let failed = 0;

    for (let i = 0; i < paths.length; i += BATCH_SIZE) {
        const batch = paths.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase.storage.from(BUCKET).remove(batch);

        if (error) {
            failed += batch.length;
            console.error(`  batch ${i / BATCH_SIZE + 1} failed: ${error.message}`);
            continue;
        }

        deleted += data?.length ?? batch.length;
        console.log(
            `  deleted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(paths.length / BATCH_SIZE)} (${deleted}/${paths.length})`
        );
    }

    return { deleted, failed };
}

async function main() {
    loadEnvLocal();

    const apply = process.argv.includes('--apply');
    const clearPlaceholders = process.argv.includes('--clear-placeholders');
    const dryRun = !apply;
    const pathsFileArg = process.argv.find((arg) => arg.startsWith('--paths-file='));
    const pathsFile = pathsFileArg?.slice('--paths-file='.length);

    const supabase = getSupabaseAdmin();

    console.log(`Bucket: ${BUCKET}`);
    console.log(dryRun ? 'Mode: dry run (pass --apply to delete)\n' : 'Mode: APPLY — deleting files\n');

    if (clearPlaceholders) {
        if (dryRun) {
            const providerCount = await countPlaceholderProfiles(supabase, 'provider');
            const handymanCount = await countPlaceholderProfiles(supabase, 'handyman');

            console.log(`Would clear ${providerCount} provider placeholder profile images`);
            console.log(`Would clear ${handymanCount} handyman placeholder profile images\n`);
        } else {
            const cleared = await clearPlaceholderProfiles(supabase);
            console.log(`Cleared ${cleared.providers} provider placeholder rows`);
            console.log(`Cleared ${cleared.handymen} handyman placeholder rows\n`);
        }
    }

    console.log('Loading referenced paths from database...');
    const referencedPaths = await fetchReferencedPaths(supabase);
    console.log(`Referenced paths: ${referencedPaths.size}`);

    let deletablePaths: string[];

    if (pathsFile) {
        console.log(`Loading paths from file: ${pathsFile}`);
        deletablePaths = loadPathsFromFile(pathsFile);
        console.log(`Paths loaded: ${deletablePaths.length}`);
    } else {
        console.log('Fetching deletable paths via get_deletable_storage_paths()...');
        try {
            deletablePaths = await fetchDeletablePathsFromRpc(supabase);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'unknown error';
            throw new Error(
                `${message}\n\nRun scripts/sql/get-deletable-storage-paths.sql in Supabase SQL editor first, or export paths and pass --paths-file=deletable-paths.txt`
            );
        }
        console.log(`Deletable paths from RPC: ${deletablePaths.length}`);
    }

    const deletable: ListedFile[] = deletablePaths.map((name) => ({
        name,
        metadata: null,
    }));
    const deletableBytes = deletable.reduce(
        (sum, obj) => sum + (obj.metadata?.size ?? 0),
        0
    );
    const remaining = referencedPaths.size;

    console.log('\nSummary');
    console.log(`  deletable: ${deletable.length} files (${formatBytes(deletableBytes)})`);
    console.log(`  referenced in DB: ${remaining} paths`);

    const folderCounts = new Map<string, number>();
    for (const obj of deletable) {
        const folder = obj.name.split('/')[0] ?? obj.name;
        folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1);
    }

    console.log('\nDeletable by folder (top 10):');
    [...folderCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([folder, count]) => console.log(`  ${folder}: ${count}`));

    console.log('\nLargest deletable files:');
    deletable
        .slice()
        .sort((a, b) => (b.metadata?.size ?? 0) - (a.metadata?.size ?? 0))
        .slice(0, 10)
        .forEach((obj) =>
            console.log(`  ${formatBytes(obj.metadata?.size ?? 0).padStart(8)}  ${obj.name}`)
        );

    if (dryRun) {
        console.log('\nDry run complete. Re-run with --apply to delete.');
        console.log('Optional flags:');
        console.log('  --clear-placeholders  null Firebase profile images in DB first');
        console.log('  --paths-file=paths.txt  use SQL-exported paths if RPC is unavailable');
        return;
    }

    if (deletable.length === 0) {
        console.log('\nNothing to delete.');
        return;
    }

    console.log('\nDeleting via Storage API...');
    const paths = deletable.map((obj) => obj.name);
    const result = await deleteStoragePaths(supabase, paths);

    console.log('\nDone');
    console.log(`  deleted: ${result.deleted}`);
    console.log(`  failed: ${result.failed}`);

    try {
        const after = await fetchDeletablePathsFromRpc(supabase);
        console.log(`  deletable remaining after run: ${after.length}`);
    } catch {
        console.log('  re-run get_deletable_storage_paths() in SQL editor to verify');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
