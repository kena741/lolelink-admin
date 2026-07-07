import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import type { MarketingTrackerRow } from '@/lib/marketing-tracker';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    const auth = await requireAdminSession(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    const { data: lastRow, error: lastRowError } = await supabaseAdmin
        .from('marketing_tracker_row')
        .select('position')
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (lastRowError) {
        return NextResponse.json({ error: lastRowError.message }, { status: 500 });
    }

    const position = ((lastRow as { position?: number } | null)?.position ?? 0) + 1;
    const now = new Date().toISOString();

    const { data: created, error: createError } = await supabaseAdmin
        .from('marketing_tracker_row')
        .insert({
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
        metadata: { position },
    });

    return NextResponse.json({ row: created as MarketingTrackerRow }, { status: 201 });
}
