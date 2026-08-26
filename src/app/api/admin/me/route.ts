import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
    const auth = await requireAdminSession(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    return NextResponse.json({
        data: {
            adminId: auth.context.adminId,
            role: auth.context.role,
            permissions: auth.context.permissions,
        },
    });
}
