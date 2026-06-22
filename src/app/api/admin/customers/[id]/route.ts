import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { logAdminActivity } from '@/lib/admin-activity-log';

export const runtime = 'nodejs';

const ARCHIVE_COLUMN_SQL =
    'ALTER TABLE customer ADD COLUMN IF NOT EXISTS archived_at timestamptz; ALTER TABLE provider ADD COLUMN IF NOT EXISTS archived_at timestamptz;';

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

export async function PATCH(request: Request, context: { params: Promise<RouteParams> }) {
    const auth = await requireAdminPermission(request, 'customers:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const id = await getIdFromParams(context.params);
        if (!id) return NextResponse.json({ error: 'Invalid customer id' }, { status: 400 });

        const body = (await request.json()) as PatchBody;
        const action = body.action;
        if (action !== 'archive' && action !== 'restore')
            return NextResponse.json({ error: 'action must be archive or restore' }, { status: 400 });

        const archived_at = action === 'archive' ? new Date().toISOString() : null;

        const { data: customerRow, error: customerFetchError } = await supabaseAdmin
            .from('customer')
            .select('id, first_name, last_name, user_name')
            .eq('id', id)
            .maybeSingle();

        if (customerFetchError) return NextResponse.json({ error: customerFetchError.message }, { status: 500 });
        if (!customerRow) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

        const customerName =
            [customerRow.first_name, customerRow.last_name].filter(Boolean).join(' ').trim()
            || (customerRow.user_name as string | undefined)?.trim()
            || id;

        const { error } = await supabaseAdmin.from('customer').update({ archived_at }).eq('id', id);
        if (error) return NextResponse.json({ error: columnHintMessage(error.message) }, { status: 500 });

        await logAdminActivity({
            request,
            action: action,
            resource_type: 'customer',
            resource_id: id,
            summary: `${action === 'archive' ? 'Archived' : 'Restored'} customer ${customerName}`,
        });

        return NextResponse.json({ ok: true, archived_at });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: Promise<RouteParams> }) {
    const auth = await requireAdminPermission(request, 'customers:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const id = await getIdFromParams(context.params);
        if (!id) return NextResponse.json({ error: 'Invalid customer id' }, { status: 400 });

        const { data: customerRow, error: customerFetchError } = await supabaseAdmin
            .from('customer')
            .select('customer_id, first_name, last_name, user_name')
            .eq('id', id)
            .maybeSingle();

        if (customerFetchError) return NextResponse.json({ error: customerFetchError.message }, { status: 500 });
        if (!customerRow) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

        const customerName =
            [customerRow.first_name, customerRow.last_name].filter(Boolean).join(' ').trim()
            || (customerRow.user_name as string | undefined)?.trim()
            || id;

        const refIds = [id];
        const externalId = customerRow?.customer_id;
        if (typeof externalId === 'string' && externalId.trim().length > 0) refIds.push(externalId.trim());
        const uniqueRefIds = [...new Set(refIds)];

        for (const refId of uniqueRefIds) {
            const { error: jobRequestError } = await supabaseAdmin
                .from('job_request')
                .delete()
                .eq('customerId', refId);
            if (jobRequestError) return NextResponse.json({ error: jobRequestError.message }, { status: 500 });
        }

        const { error } = await supabaseAdmin.from('customer').delete().eq('id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await logAdminActivity({
            request,
            action: 'delete',
            resource_type: 'customer',
            resource_id: id,
            summary: `Deleted customer ${customerName}`,
        });

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
