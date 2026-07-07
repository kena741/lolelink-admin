import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import {
    computeDashboardRevenueBreakdown,
    type DashboardBookingCommissionRow,
    type DashboardJobRequestRow,
    type DashboardWalletRow,
} from '@/lib/dashboard-revenue-metrics';

type DashboardRange = 'today' | '7d' | '30d' | 'all';

function parseRange(value: string | null): DashboardRange {
    if (value === 'today' || value === '7d' || value === '30d' || value === 'all') return value;
    return '30d';
}

function isDateInRange(range: DashboardRange, value?: string | null): boolean {
    if (range === 'all') return true;
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    if (range === 'today') {
        return (
            date.getFullYear() === now.getFullYear() &&
            date.getMonth() === now.getMonth() &&
            date.getDate() === now.getDate()
        );
    }
    const days = range === '7d' ? 7 : 30;
    const from = new Date();
    from.setDate(now.getDate() - days);
    return date >= from;
}

export async function GET(request: Request) {
    const auth = await requireAdminSession(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const url = new URL(request.url);
    const range = parseRange(url.searchParams.get('range'));
    const supabaseAdmin = getSupabaseAdminFromRequest(request);

    const [{ data: walletRows }, { data: bookings }, { data: jobRequests }] = await Promise.all([
        supabaseAdmin.from('wallet_transaction').select('*'),
        supabaseAdmin.from('booked_service').select('*'),
        supabaseAdmin.from('job_request').select('id, createdAt, is_paid, price, title, status'),
    ]);

    const rangedWalletRows = ((walletRows ?? []) as DashboardWalletRow[]).filter((row) =>
        isDateInRange(range, row.createdDate ?? null)
    );
    const rangedBookings = ((bookings ?? []) as DashboardBookingCommissionRow[]).filter((row) =>
        isDateInRange(range, row.createdAt ?? null)
    );
    const rangedJobRequests = ((jobRequests ?? []) as DashboardJobRequestRow[]).filter((row) =>
        isDateInRange(range, row.createdAt ?? null)
    );

    const revenueBreakdown = computeDashboardRevenueBreakdown({
        walletRows: rangedWalletRows,
        bookings: rangedBookings,
        jobRequests: rangedJobRequests,
    });

    return NextResponse.json({
        data: {
            range,
            revenueBreakdown,
            totals: {
                walletRows: rangedWalletRows.length,
                bookings: rangedBookings.length,
                jobRequests: rangedJobRequests.length,
            },
        },
    });
}
