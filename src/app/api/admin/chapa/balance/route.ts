import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { fetchChapaEtbBalance, loadChapaSecretKey } from '@/lib/chapa-config';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
    const auth = await requireAdminPermission(request, 'finance:read');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    try {
        const supabaseAdmin = getSupabaseAdminFromRequest(request);
        const secretKey = await loadChapaSecretKey(supabaseAdmin);

        if (!secretKey) {
            return NextResponse.json({ error: 'Missing Chapa secret key' }, { status: 500 });
        }

        const balance = await fetchChapaEtbBalance(secretKey);

        return NextResponse.json({
            data: {
                currency: balance.currency,
                available_balance: balance.availableBalance,
                ledger_balance: balance.ledgerBalance,
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch Chapa balance';
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
