import { NextResponse } from 'next/server';
import { hasPermission } from '@/lib/admin-permissions';
import { requireAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export interface NavActionCounts {
    '/admin/finance/payout-request': number;
    '/admin/verify-documents': number;
    '/admin/services/approve': number;
    '/admin/bookings': number;
    '/admin/customers/job-requests': number;
}

async function countExact(
    query: PromiseLike<{ count: number | null; error: { message: string } | null }>
): Promise<number> {
    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return count ?? 0;
}

export async function GET(request: Request) {
    const auth = await requireAdminSession(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const admin = getSupabaseAdminFromRequest(request);
    const permissions = auth.context.permissions;
    const counts: NavActionCounts = {
        '/admin/finance/payout-request': 0,
        '/admin/verify-documents': 0,
        '/admin/services/approve': 0,
        '/admin/bookings': 0,
        '/admin/customers/job-requests': 0,
    };

    try {
        const tasks: Promise<void>[] = [];

        if (hasPermission(permissions, 'finance:read')) {
            tasks.push(
                (async () => {
                    counts['/admin/finance/payout-request'] = await countExact(
                        admin
                            .from('withdrawal_history')
                            .select('id', { count: 'exact', head: true })
                            .ilike('paymentStatus', 'pending')
                    );
                })()
            );
        }

        if (hasPermission(permissions, 'providers:verify')) {
            tasks.push(
                (async () => {
                    counts['/admin/verify-documents'] = await countExact(
                        admin
                            .from('verify_documents')
                            .select('id', { count: 'exact', head: true })
                            .is('isVerify', null)
                    );
                })()
            );
        }

        if (hasPermission(permissions, 'services:read')) {
            tasks.push(
                (async () => {
                    const [unapproved, featuredPending] = await Promise.all([
                        countExact(
                            admin
                                .from('service')
                                .select('id', { count: 'exact', head: true })
                                .eq('status', true)
                                .neq('isArchived', true)
                                .or('approved.is.null,approved.eq.false')
                        ),
                        countExact(
                            admin
                                .from('service')
                                .select('id', { count: 'exact', head: true })
                                .eq('status', true)
                                .neq('isArchived', true)
                                .ilike('feature_requested_status', 'pending')
                        ),
                    ]);
                    counts['/admin/services/approve'] = unapproved + featuredPending;
                })()
            );
        }

        if (hasPermission(permissions, 'bookings:read')) {
            tasks.push(
                (async () => {
                    counts['/admin/bookings'] = await countExact(
                        admin
                            .from('booked_service')
                            .select('id', { count: 'exact', head: true })
                            .in('status', ['pending', 'pending_approval'])
                    );
                })()
            );
        }

        if (hasPermission(permissions, 'customers:read')) {
            tasks.push(
                (async () => {
                    // Matches job-requests page: pending when not accepted and status is pending/empty.
                    const { data, error } = await admin
                        .from('job_request')
                        .select('id, status, accepted');
                    if (error) throw new Error(error.message);
                    counts['/admin/customers/job-requests'] = (data ?? []).filter((row) => {
                        if (row.accepted === true) return false;
                        const status = String(row.status ?? 'pending').toLowerCase();
                        return status === 'pending';
                    }).length;
                })()
            );
        }

        await Promise.all(tasks);
        return NextResponse.json({ counts });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load action counts';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
