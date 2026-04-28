import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('job_request')
            .select('id, createdAt, accepted, is_paid, bidList, price, customerId, description, title, status, serviceModelList')
            .order('createdAt', { ascending: false });

        if (error)
            return NextResponse.json({ error: error.message || 'Failed to fetch job requests' }, { status: 500 });

        return NextResponse.json({ data: data ?? [] });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

interface UpdateJobRequestBody {
    id?: string;
    action?: 'accept' | 'reject' | 'pending';
}

export async function PATCH(request: Request) {
    try {
        const body = (await request.json()) as UpdateJobRequestBody;
        const id = (body.id || '').trim();
        const action = body.action;
        if (!id || !action)
            return NextResponse.json({ error: 'id and action are required' }, { status: 400 });
        const updatePayload = action === 'accept'
            ? { accepted: true, status: 'accepted' }
            : action === 'reject'
                ? { accepted: false, status: 'rejected' }
                : { accepted: false, status: 'pending' };
        const { error } = await supabaseAdmin
            .from('job_request')
            .update(updatePayload)
            .eq('id', id);
        if (error)
            return NextResponse.json({ error: error.message || 'Failed to update job request' }, { status: 500 });
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
