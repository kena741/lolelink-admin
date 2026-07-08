import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import {
    normalizeColumnType,
    slugifyColumnLabel,
    type MarketingTrackerColumn,
} from '@/lib/marketing-tracker';

export const runtime = 'nodejs';

interface AddColumnBody {
    sheet_id?: string;
    label?: string;
    column_type?: string;
}

async function nextUniqueKey(
    supabaseAdmin: ReturnType<typeof getSupabaseAdminFromRequest>,
    sheetId: string,
    baseKey: string
): Promise<string> {
    let candidate = baseKey;
    let suffix = 2;
    while (true) {
        const { data } = await supabaseAdmin
            .from('marketing_tracker_column')
            .select('id')
            .eq('sheet_id', sheetId)
            .eq('key', candidate)
            .maybeSingle();
        if (!data) return candidate;
        candidate = `${baseKey}_${suffix}`;
        suffix += 1;
    }
}

export async function POST(request: Request) {
    const auth = await requireAdminSession(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as AddColumnBody;
    const sheetId = (body.sheet_id ?? '').trim();
    const label = (body.label ?? '').trim();
    const columnType = normalizeColumnType((body.column_type ?? '').trim());

    if (!sheetId) {
        return NextResponse.json({ error: 'sheet_id is required' }, { status: 400 });
    }
    if (!label) {
        return NextResponse.json({ error: 'label is required' }, { status: 400 });
    }
    if (!columnType) {
        return NextResponse.json({ error: 'column_type must be text, yes-no, or date' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    const { data: lastColumn, error: lastColumnError } = await supabaseAdmin
        .from('marketing_tracker_column')
        .select('position')
        .eq('sheet_id', sheetId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (lastColumnError) {
        return NextResponse.json({ error: lastColumnError.message }, { status: 500 });
    }

    const key = await nextUniqueKey(supabaseAdmin, sheetId, slugifyColumnLabel(label));
    const position = ((lastColumn as { position?: number } | null)?.position ?? 0) + 1;

    const { data: created, error: createError } = await supabaseAdmin
        .from('marketing_tracker_column')
        .insert({
            sheet_id: sheetId,
            key,
            label,
            column_type: columnType,
            position,
            is_system: false,
        })
        .select('*')
        .single();

    if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    await logAdminActivity({
        request,
        action: 'create',
        resource_type: 'marketing_tracker_column',
        resource_id: (created as MarketingTrackerColumn).id,
        summary: `Added marketing tracker column "${label}"`,
        metadata: { sheet_id: sheetId, key, column_type: columnType, position },
    });

    return NextResponse.json({ column: created as MarketingTrackerColumn }, { status: 201 });
}
