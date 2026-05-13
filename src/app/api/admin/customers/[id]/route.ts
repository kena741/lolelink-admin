import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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
    try {
        const id = await getIdFromParams(context.params);
        if (!id) return NextResponse.json({ error: 'Invalid customer id' }, { status: 400 });

        const body = (await request.json()) as PatchBody;
        const action = body.action;
        if (action !== 'archive' && action !== 'restore')
            return NextResponse.json({ error: 'action must be archive or restore' }, { status: 400 });

        const archived_at = action === 'archive' ? new Date().toISOString() : null;
        const { error } = await supabaseAdmin.from('customer').update({ archived_at }).eq('id', id);
        if (error) return NextResponse.json({ error: columnHintMessage(error.message) }, { status: 500 });

        return NextResponse.json({ ok: true, archived_at });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(_request: Request, context: { params: Promise<RouteParams> }) {
    try {
        const id = await getIdFromParams(context.params);
        if (!id) return NextResponse.json({ error: 'Invalid customer id' }, { status: 400 });

        const { error } = await supabaseAdmin.from('customer').delete().eq('id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
