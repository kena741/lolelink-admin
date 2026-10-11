import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { logAdminActivity } from '@/lib/admin-activity-log';

export const runtime = 'nodejs';

type RouteContext = {
    params: Promise<{ id: string }>;
};

type CommentRow = {
    id: string;
    post_id: string;
    full_name: string;
    phone: string;
    body: string;
    status: string;
    created_at: string;
};

export async function GET(request: Request, context: RouteContext) {
    const auth = await requireAdminPermission(request, 'catalog:read');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await context.params;
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const { data, error } = await supabaseAdmin
            .from('blog_comment')
            .select('id, post_id, full_name, phone, body, status, created_at')
            .eq('post_id', id)
            .order('created_at', { ascending: false });
        if (error) {
            return NextResponse.json({ error: error.message || 'Failed to fetch comments' }, { status: 500 });
        }
        return NextResponse.json({ data: (data as CommentRow[]) ?? [] });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: RouteContext) {
    const auth = await requireAdminPermission(request, 'catalog:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id: postId } = await context.params;
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as { commentId?: string; status?: string };
        const commentId = body.commentId?.trim();
        const status = body.status;
        if (!commentId || !['approved', 'hidden', 'pending'].includes(status ?? '')) {
            return NextResponse.json({ error: 'commentId and valid status are required' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('blog_comment')
            .update({ status })
            .eq('id', commentId)
            .eq('post_id', postId)
            .select('id, post_id, full_name, phone, body, status, created_at')
            .single();
        if (error) {
            return NextResponse.json({ error: error.message || 'Failed to update comment' }, { status: 500 });
        }

        await logAdminActivity({
            request,
            action: 'update',
            resource_type: 'blog_comment',
            resource_id: commentId,
            summary: `Updated blog comment status to ${status}`,
            metadata: { postId, status },
        });

        return NextResponse.json({ data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: RouteContext) {
    const auth = await requireAdminPermission(request, 'catalog:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id: postId } = await context.params;
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as { commentId?: string };
        const commentId = body.commentId?.trim();
        if (!commentId) {
            return NextResponse.json({ error: 'commentId is required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('blog_comment')
            .delete()
            .eq('id', commentId)
            .eq('post_id', postId);
        if (error) {
            return NextResponse.json({ error: error.message || 'Failed to delete comment' }, { status: 500 });
        }

        await logAdminActivity({
            request,
            action: 'delete',
            resource_type: 'blog_comment',
            resource_id: commentId,
            summary: `Deleted blog comment`,
            metadata: { postId },
        });

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
