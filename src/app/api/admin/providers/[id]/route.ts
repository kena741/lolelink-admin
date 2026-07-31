import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { buildChangeMetadata } from '@/lib/activity-log-changes';

export const runtime = 'nodejs';

const ARCHIVE_COLUMN_SQL =
    'ALTER TABLE customer ADD COLUMN IF NOT EXISTS archived_at timestamptz; ALTER TABLE provider ADD COLUMN IF NOT EXISTS archived_at timestamptz;';

const PROVIDER_UPDATE_KEYS = [
    'firstName',
    'lastName',
    'phoneNumber',
    'address',
    'location',
    'banner',
    'profileImage',
    'profileBio',
    'companyName',
    'countryCode',
    'admin_note',
] as const;

type RouteParams = { id: string };

async function getIdFromParams(params: Promise<RouteParams> | RouteParams): Promise<string | null> {
    const resolved = await Promise.resolve(params);
    const id = resolved?.id?.trim();
    return id && id.length > 0 ? id : null;
}

interface PatchBody {
    action?: 'archive' | 'restore';
}

function columnHintMessage(raw: string): string {
    if (raw.includes('archived_at') || raw.includes('column') || raw.includes('schema'))
        return `${raw} Run in SQL editor: ${ARCHIVE_COLUMN_SQL}`;
    return raw;
}

export async function PUT(request: Request, context: { params: Promise<RouteParams> }) {
    const auth = await requireAdminPermission(request, 'providers:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const id = await getIdFromParams(context.params);
        if (!id) return NextResponse.json({ error: 'Invalid provider id' }, { status: 400 });

        const body = (await request.json()) as Record<string, unknown>;
        const updates: Record<string, unknown> = {};
        for (const key of PROVIDER_UPDATE_KEYS) {
            if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
                updates[key] = body[key];
            }
        }
        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const { data: existingProvider, error: existingError } = await supabaseAdmin
            .from('provider')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
        if (!existingProvider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });

        const { data, error } = await supabaseAdmin
            .from('provider')
            .update(updates)
            .eq('id', id)
            .select('*')
            .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const providerName =
            [data.firstName, data.lastName].filter(Boolean).join(' ').trim()
            || (data.userName as string | undefined)?.trim()
            || id;

        await logAdminActivity({
            request,
            action: 'update',
            resource_type: 'provider',
            resource_id: id,
            summary: `Updated provider ${providerName}`,
            metadata: buildChangeMetadata(
                existingProvider as Record<string, unknown>,
                data as Record<string, unknown>,
                Object.keys(updates)
            ),
        });

        return NextResponse.json({ ok: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: { params: Promise<RouteParams> }) {
    const auth = await requireAdminPermission(request, 'providers:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const id = await getIdFromParams(context.params);
        if (!id) return NextResponse.json({ error: 'Invalid provider id' }, { status: 400 });

        const body = (await request.json()) as PatchBody;
        const action = body.action;
        if (action !== 'archive' && action !== 'restore')
            return NextResponse.json({ error: 'action must be archive or restore' }, { status: 400 });

        const archived_at = action === 'archive' ? new Date().toISOString() : null;

        const { data: providerRow, error: providerFetchError } = await supabaseAdmin
            .from('provider')
            .select('id, firstName, lastName, userName, archived_at')
            .eq('id', id)
            .maybeSingle();

        if (providerFetchError) return NextResponse.json({ error: providerFetchError.message }, { status: 500 });
        if (!providerRow) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });

        const providerName =
            [providerRow.firstName, providerRow.lastName].filter(Boolean).join(' ').trim()
            || (providerRow.userName as string | undefined)?.trim()
            || id;

        const { error } = await supabaseAdmin.from('provider').update({ archived_at }).eq('id', id);
        if (error) return NextResponse.json({ error: columnHintMessage(error.message) }, { status: 500 });

        await logAdminActivity({
            request,
            action: action,
            resource_type: 'provider',
            resource_id: id,
            summary: `${action === 'archive' ? 'Archived' : 'Restored'} provider ${providerName}`,
            metadata: buildChangeMetadata(
                providerRow as Record<string, unknown>,
                { ...providerRow, archived_at } as Record<string, unknown>,
                ['archived_at']
            ),
        });

        return NextResponse.json({ ok: true, archived_at });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: Promise<RouteParams> }) {
    const auth = await requireAdminPermission(request, 'providers:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const id = await getIdFromParams(context.params);
        if (!id) return NextResponse.json({ error: 'Invalid provider id' }, { status: 400 });

        const { data: providerRow, error: providerFetchError } = await supabaseAdmin
            .from('provider')
            .select('firstName, lastName, userName')
            .eq('id', id)
            .maybeSingle();

        if (providerFetchError) return NextResponse.json({ error: providerFetchError.message }, { status: 500 });
        if (!providerRow) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });

        const providerName =
            [providerRow.firstName, providerRow.lastName].filter(Boolean).join(' ').trim()
            || (providerRow.userName as string | undefined)?.trim()
            || id;

        const { error } = await supabaseAdmin.from('provider').delete().eq('id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await logAdminActivity({
            request,
            action: 'delete',
            resource_type: 'provider',
            resource_id: id,
            summary: `Deleted provider ${providerName}`,
        });

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
