import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import {
    clampColumnWidthPx,
    stripColumnKeyFromValues,
    type MarketingTrackerColumn,
    type MarketingTrackerRow,
} from '@/lib/marketing-tracker';

export const runtime = 'nodejs';

interface PatchColumnBody {
    label?: string;
    width_px?: number | null;
}

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminPermission(request, 'catalog:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const body = (await request.json()) as PatchColumnBody;
    const updatePayload: { label?: string; width_px?: number | null } = {};

    if (typeof body.label === 'string') {
        const label = body.label.trim();
        if (!label) {
            return NextResponse.json({ error: 'label cannot be empty' }, { status: 400 });
        }
        updatePayload.label = label;
    }

    if (body.width_px === null) {
        updatePayload.width_px = null;
    } else if (typeof body.width_px === 'number' && Number.isFinite(body.width_px)) {
        updatePayload.width_px = clampColumnWidthPx(body.width_px);
    }

    if (Object.keys(updatePayload).length === 0) {
        return NextResponse.json({ error: 'label or width_px is required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    const { data: updated, error } = await supabaseAdmin
        .from('marketing_tracker_column')
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: 'Column not found' }, { status: 404 });

    return NextResponse.json({ column: updated as MarketingTrackerColumn });
}

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminPermission(request, 'catalog:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    const { data: column, error: columnError } = await supabaseAdmin
        .from('marketing_tracker_column')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (columnError) return NextResponse.json({ error: columnError.message }, { status: 500 });
    if (!column) return NextResponse.json({ error: 'Column not found' }, { status: 404 });

    const columnRow = column as MarketingTrackerColumn;
    const { data: rows, error: rowsError } = await supabaseAdmin
        .from('marketing_tracker_row')
        .select('id, values')
        .eq('sheet_id', columnRow.sheet_id);

    if (rowsError) return NextResponse.json({ error: rowsError.message }, { status: 500 });

    for (const row of (rows ?? []) as MarketingTrackerRow[]) {
        const values = row.values ?? {};
        if (!(columnRow.key in values)) continue;
        const nextValues = stripColumnKeyFromValues(values, columnRow.key);
        const { error: updateError } = await supabaseAdmin
            .from('marketing_tracker_row')
            .update({ values: nextValues, updated_at: new Date().toISOString() })
            .eq('id', row.id);
        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
    }

    const { error: deleteError } = await supabaseAdmin
        .from('marketing_tracker_column')
        .delete()
        .eq('id', id);

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    await logAdminActivity({
        request,
        action: 'delete',
        resource_type: 'marketing_tracker_column',
        resource_id: id,
        summary: `Deleted marketing tracker column "${columnRow.label}"`,
        metadata: { key: columnRow.key },
    });

    return NextResponse.json({ ok: true });
}
