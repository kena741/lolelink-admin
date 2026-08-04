import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import type { MarketingTrackerSheet } from '@/lib/marketing-tracker';

export const runtime = 'nodejs';

interface CreateSheetBody {
    name?: string;
}

export async function POST(request: Request) {
    const auth = await requireAdminPermission(request, 'catalog:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as CreateSheetBody;
    const supabaseAdmin = getSupabaseAdminFromRequest(request);

    const { data: existingSheets, error: sheetsError } = await supabaseAdmin
        .from('marketing_tracker_sheet')
        .select('id, name, position')
        .order('position', { ascending: true });

    if (sheetsError) {
        return NextResponse.json({ error: sheetsError.message }, { status: 500 });
    }

    const sheetCount = (existingSheets ?? []).length;
    const name = (body.name ?? '').trim() || `Sheet ${sheetCount + 1}`;
    const position = sheetCount + 1;

    const { data: createdSheet, error: createSheetError } = await supabaseAdmin
        .from('marketing_tracker_sheet')
        .insert({ name, position })
        .select('*')
        .single();

    if (createSheetError) {
        return NextResponse.json({ error: createSheetError.message }, { status: 500 });
    }

    const sheet = createdSheet as MarketingTrackerSheet;

    await logAdminActivity({
        request,
        action: 'create',
        resource_type: 'marketing_tracker_sheet',
        resource_id: sheet.id,
        summary: `Added marketing tracker sheet "${name}"`,
        metadata: { position },
    });

    return NextResponse.json(
        {
            sheet,
            columns: [],
            rows: [],
        },
        { status: 201 }
    );
}
