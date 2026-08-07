/**
 * Soft-archive bookings: is_archived + archive_note (no status/money changes).
 *
 * Prerequisite: run migration first
 *   supabase/migrations/20260807130000_booked_service_is_archived.sql
 *
 * Default dry-run:
 *   pnpm archive-open-bookings
 *
 * Backfill ALL existing rows as archived:
 *   pnpm archive-open-bookings -- --apply
 *   pnpm archive-open-bookings -- --apply --note="testing bookings"
 */

import { createClient, type PostgrestError } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';

const DEFAULT_NOTE = 'testing bookings';
const MIGRATION_HINT =
    'Missing is_archived/archive_note. Run SQL first: supabase/migrations/20260807130000_booked_service_is_archived.sql';

function hasFlag(name: string): boolean {
    return process.argv.includes(name);
}

function readNote(): string {
    const arg = process.argv.find((value) => value.startsWith('--note='));
    if (!arg) return DEFAULT_NOTE;
    const value = arg.slice('--note='.length).trim();
    return value || DEFAULT_NOTE;
}

function fail(error: PostgrestError | Error | string | null | undefined, hint?: string): never {
    if (typeof error === 'string') console.error(error);
    else if (error instanceof Error) console.error(error.message);
    else if (error) {
        const line = [error.message, error.details, error.hint, error.code].filter(Boolean).join(' | ');
        console.error(line || JSON.stringify(error));
    } else {
        console.error('Unknown error');
    }
    if (hint) console.error(hint);
    process.exit(1);
}

async function main(): Promise<void> {
    loadEnvLocal();

    const apply = hasFlag('--apply');
    const note = readNote();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        fail('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    }

    const admin = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const probe = await admin.from('booked_service').select('id, is_archived, archive_note').limit(1);
    if (probe.error) {
        fail(probe.error, MIGRATION_HINT);
    }

    const { count: total, error: totalError } = await admin
        .from('booked_service')
        .select('id', { count: 'exact', head: true });

    if (totalError) fail(totalError);

    const { count: alreadyArchived, error: archivedError } = await admin
        .from('booked_service')
        .select('id', { count: 'exact', head: true })
        .eq('is_archived', true);

    if (archivedError) fail(archivedError, MIGRATION_HINT);

    console.log(`Total bookings: ${total ?? 0}`);
    console.log(`Already archived: ${alreadyArchived ?? 0}`);
    console.log(`Would set: is_archived=true, archive_note="${note}" for ALL rows`);
    console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);

    if (!apply) {
        console.log('\nPass --apply to write. Optional: --note="your note"');
        return;
    }

    const { data, error } = await admin
        .from('booked_service')
        .update({
            is_archived: true,
            archive_note: note,
        })
        .gte('createdAt', '1970-01-01T00:00:00.000Z')
        .select('id');

    if (error) fail(error, MIGRATION_HINT);

    console.log(`\nUpdated ${data?.length ?? 0} booking(s).`);
}

main().catch((error: unknown) => {
    fail(error instanceof Error ? error : String(error));
});
