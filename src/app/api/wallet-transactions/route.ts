import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('wallet_transaction')
            .select('*')
            .order('createdDate', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: data ?? [] });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch wallet transactions';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
