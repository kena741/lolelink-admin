/**
 * Soft-archive all booked_service rows tied to Fozia Kassa
 * (customer accounts + provider account).
 *
 *   npx tsx scripts/archive-fozia-bookings.ts
 *   npx tsx scripts/archive-fozia-bookings.ts --apply
 *   npx tsx scripts/archive-fozia-bookings.ts --apply --note="Fozia Kassa cleanup"
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';

const KNOWN_CUSTOMER_IDS = [
    '8a8f7b79-d371-4a7e-b140-162da35cc5cc', // foziakassa07@gmail.com
    'b6653709-a566-4c4b-b1ba-a31945376bef', // foziakassa@gmail.com
] as const;
const KNOWN_PROVIDER_ID = '2e59797a-db9b-4485-afa8-69a54c9bd42f'; // foziaka&/ssa@gmail.com
const DEFAULT_NOTE = 'Fozia Kassa — archived';

function hasFlag(name: string): boolean {
    return process.argv.includes(name);
}

function readNote(): string {
    const arg = process.argv.find((value) => value.startsWith('--note='));
    if (!arg) return DEFAULT_NOTE;
    return arg.slice('--note='.length).trim() || DEFAULT_NOTE;
}

async function main(): Promise<void> {
    loadEnvLocal();

    const apply = hasFlag('--apply');
    const note = readNote();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    const admin = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: customers, error: custErr } = await admin
        .from('customer')
        .select('id, email, first_name, last_name, user_name')
        .or(
            [
                `id.in.(${KNOWN_CUSTOMER_IDS.join(',')})`,
                'email.ilike.%foziakassa%',
                'and(first_name.ilike.fozia,last_name.ilike.kassa)',
            ].join(',')
        );
    if (custErr) {
        console.error(custErr.message);
        process.exit(1);
    }

    const { data: providers, error: provErr } = await admin
        .from('provider')
        .select('id, email, firstName, lastName, userName')
        .or(
            [
                `id.eq.${KNOWN_PROVIDER_ID}`,
                'email.ilike.%foziakassa%',
                'and(firstName.ilike.fozia,lastName.ilike.kassa)',
            ].join(',')
        );
    if (provErr) {
        console.error(provErr.message);
        process.exit(1);
    }

    const customerIds = [...new Set((customers ?? []).map((c) => c.id))];
    const providerIds = [...new Set((providers ?? []).map((p) => p.id))];

    console.log('Matched customers:', customers?.length ?? 0);
    for (const c of customers ?? []) {
        console.log(`  ${c.id} | ${c.email} | ${c.first_name} ${c.last_name}`);
    }
    console.log('Matched providers:', providers?.length ?? 0);
    for (const p of providers ?? []) {
        console.log(`  ${p.id} | ${p.email} | ${p.firstName} ${p.lastName}`);
    }

    if (customerIds.length === 0 && providerIds.length === 0) {
        console.log('No Fozia accounts found.');
        return;
    }

    const byId = new Map<
        string,
        {
            id: string;
            status: string | null;
            payment_status: string | null;
            totalAmount: number | null;
            email: string | null;
            firstName: string | null;
            lastName: string | null;
            customer_id: string | null;
            provider_id: string | null;
            is_archived: boolean | null;
            archive_note: string | null;
            createdAt: string | null;
        }
    >();

    const selectCols =
        'id, status, payment_status, totalAmount, email, firstName, lastName, customer_id, provider_id, is_archived, archive_note, createdAt';

    if (customerIds.length > 0) {
        const { data, error } = await admin
            .from('booked_service')
            .select(selectCols)
            .in('customer_id', customerIds)
            .order('createdAt', { ascending: false });
        if (error) {
            console.error(error.message);
            process.exit(1);
        }
        for (const row of data ?? []) byId.set(row.id, row);
    }

    if (providerIds.length > 0) {
        const { data, error } = await admin
            .from('booked_service')
            .select(selectCols)
            .in('provider_id', providerIds)
            .order('createdAt', { ascending: false });
        if (error) {
            console.error(error.message);
            process.exit(1);
        }
        for (const row of data ?? []) byId.set(row.id, row);
    }

    const { data: byEmail, error: emailErr } = await admin
        .from('booked_service')
        .select(selectCols)
        .or('email.ilike.%foziakassa%,and(firstName.ilike.fozia,lastName.ilike.kassa)')
        .order('createdAt', { ascending: false });
    if (emailErr) {
        console.error(emailErr.message);
        process.exit(1);
    }
    for (const row of byEmail ?? []) byId.set(row.id, row);

    const all = [...byId.values()];
    const already = all.filter((b) => b.is_archived === true);
    const toArchive = all.filter((b) => b.is_archived !== true);

    console.log(`\nTotal unique Fozia-related bookings: ${all.length}`);
    console.log(`Already archived: ${already.length}`);
    console.log(`To archive: ${toArchive.length}`);
    console.log(`Note: "${note}"`);
    console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);

    for (const b of toArchive) {
        console.log(
            `  ${b.id} | ${b.status} | ${b.payment_status} | ${b.totalAmount} | ${b.email} | ${b.firstName} ${b.lastName} | ${b.createdAt}`
        );
    }

    if (!apply) {
        console.log('\nPass --apply to soft-archive (is_archived=true).');
        return;
    }

    if (toArchive.length === 0) {
        console.log('\nNothing to update.');
        return;
    }

    const ids = toArchive.map((b) => b.id);
    const { data, error } = await admin
        .from('booked_service')
        .update({ is_archived: true, archive_note: note })
        .in('id', ids)
        .select('id');

    if (error) {
        console.error(error.message);
        process.exit(1);
    }

    console.log(`\nArchived ${data?.length ?? 0} booking(s).`);
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
