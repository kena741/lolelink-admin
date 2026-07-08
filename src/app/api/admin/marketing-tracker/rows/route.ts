import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import type { MarketingTrackerRow } from '@/lib/marketing-tracker';

export const runtime = 'nodejs';

interface AddRowBody {
    sheet_id?: string;
    after_row_id?: string;
}

export async function POST(request: Request) {
    const auth = await requireAdminSession(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as AddRowBody;
    const sheetId = (body.sheet_id ?? '').trim();
    const afterRowId = (body.after_row_id ?? '').trim();
    if (!sheetId) {
        return NextResponse.json({ error: 'sheet_id is required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    const now = new Date().toISOString();
    let position = 1;

    if (afterRowId) {
        const { data: afterRow, error: afterRowError } = await supabaseAdmin
            .from('marketing_tracker_row')
            .select('id, position')
            .eq('id', afterRowId)
            .eq('sheet_id', sheetId)
            .maybeSingle();

        if (afterRowError) {
            return NextResponse.json({ error: afterRowError.message }, { status: 500 });
        }
        if (!afterRow) {
            return NextResponse.json({ error: 'after_row_id not found' }, { status: 404 });
        }

        position = (afterRow as { position: number }).position + 1;

        const { data: rowsToShift, error: shiftListError } = await supabaseAdmin
            .from('marketing_tracker_row')
            .select('id, position')
            .eq('sheet_id', sheetId)
            .gte('position', position)
            .order('position', { ascending: false });

        if (shiftListError) {
            return NextResponse.json({ error: shiftListError.message }, { status: 500 });
        }

        for (const row of rowsToShift ?? []) {
            const { error: shiftError } = await supabaseAdmin
                .from('marketing_tracker_row')
                .update({
                    position: (row as { position: number }).position + 1,
                    updated_at: now,
                })
                .eq('id', (row as { id: string }).id);
            if (shiftError) {
                return NextResponse.json({ error: shiftError.message }, { status: 500 });
            }
        }
    } else {
        const { data: lastRow, error: lastRowError } = await supabaseAdmin
            .from('marketing_tracker_row')
            .select('position')
            .eq('sheet_id', sheetId)
            .order('position', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lastRowError) {
            return NextResponse.json({ error: lastRowError.message }, { status: 500 });
        }

        position = ((lastRow as { position?: number } | null)?.position ?? 0) + 1;
    }

    const { data: created, error: createError } = await supabaseAdmin
        .from('marketing_tracker_row')
        .insert({
            sheet_id: sheetId,
            position,
            values: {},
            updated_at: now,
        })
        .select('*')
        .single();

    if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    await logAdminActivity({
        request,
        action: 'create',
        resource_type: 'marketing_tracker_row',
        resource_id: (created as MarketingTrackerRow).id,
        summary: 'Added marketing tracker row',
        metadata: { sheet_id: sheetId, position, after_row_id: afterRowId || null },
    });

    return NextResponse.json({ row: created as MarketingTrackerRow }, { status: 201 });
}
