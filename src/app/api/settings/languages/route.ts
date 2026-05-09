import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface LanguageUpsertRow {
    id: string;
    code: string;
    name: string;
    active: boolean;
}

interface LanguageInsertRow {
    code: string;
    name: string;
    active: boolean;
}

interface LanguagesBody {
    upserts?: LanguageUpsertRow[];
    inserts?: LanguageInsertRow[];
    deleteIds?: string[];
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as LanguagesBody;

        if (body.upserts && body.upserts.length > 0) {
            const { error } = await supabaseAdmin
                .from('languages')
                .upsert(body.upserts, { onConflict: 'id' });
            if (error)
                return NextResponse.json({ error: error.message || 'Failed to upsert languages' }, { status: 500 });
        }

        if (body.inserts && body.inserts.length > 0) {
            const { error } = await supabaseAdmin.from('languages').insert(body.inserts);
            if (error)
                return NextResponse.json({ error: error.message || 'Failed to insert languages' }, { status: 500 });
        }

        if (body.deleteIds && body.deleteIds.length > 0) {
            const ids = body.deleteIds.filter((id) => id.trim().length > 0);
            if (ids.length > 0) {
                const { error } = await supabaseAdmin.from('languages').delete().in('id', ids);
                if (error)
                    return NextResponse.json({ error: error.message || 'Failed to delete languages' }, { status: 500 });
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
