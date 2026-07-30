import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import {
    buildWalletBookingEnrichmentById,
    collectBookingIdsFromWalletRows,
} from '@/lib/wallet-transaction-booking-enrichment';
import {
    formatWalletTransactionEventLabel,
    parseWalletTransactionEvent,
} from '@/lib/wallet-transaction-display';
import { walletTransactionMagnitude } from '@/lib/wallet-transaction-metrics';
import { readAuthUserId } from '@/lib/wallet-transaction-user';

export const runtime = 'nodejs';

interface WalletTransactionRow {
    id: string;
    amount?: string | number | null;
    createdDate?: string | null;
    isCredit?: boolean | null;
    note?: string | null;
    paymentType?: string | null;
    transactionId?: string | null;
    type?: string | null;
    userId?: string | null;
    provider_id?: string | null;
}

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminPermission(request, 'finance:read');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const providerId = id.trim();
    if (!providerId) {
        return NextResponse.json({ error: 'Provider id is required' }, { status: 400 });
    }

    try {
        const supabaseAdmin = getSupabaseAdminFromRequest(request);

        const { data: providerRow, error: providerError } = await supabaseAdmin
            .from('provider')
            .select('walletAmount, user_id')
            .eq('id', providerId)
            .maybeSingle();

        if (providerError) {
            return NextResponse.json({ error: providerError.message }, { status: 500 });
        }
        if (!providerRow) {
            return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
        }

        const authUserId = readAuthUserId((providerRow as { user_id?: string | null }).user_id);
        const orFilters = [`provider_id.eq.${providerId}`, `userId.eq.${providerId}`];
        if (authUserId) orFilters.push(`userId.eq.${authUserId}`);

        const walletResult = await supabaseAdmin
            .from('wallet_transaction')
            .select('id, amount, createdDate, isCredit, note, paymentType, transactionId, type, userId, provider_id')
            .or(orFilters.join(','))
            .order('createdDate', { ascending: false });

        if (walletResult.error) {
            return NextResponse.json({ error: walletResult.error.message }, { status: 500 });
        }

        const rows = (walletResult.data ?? []) as WalletTransactionRow[];
        const bookingById = await buildWalletBookingEnrichmentById(
            supabaseAdmin,
            collectBookingIdsFromWalletRows(rows)
        );

        let ledgerNet = 0;
        const data = rows.map((row) => {
            const amount = walletTransactionMagnitude(row.amount);
            const isCredit = row.isCredit === true;
            ledgerNet += isCredit ? amount : -amount;

            const transactionId = typeof row.transactionId === 'string' ? row.transactionId.trim() : '';
            const booking = transactionId ? bookingById[transactionId] : undefined;
            const walletEvent = parseWalletTransactionEvent({
                note: row.note,
                isCredit: row.isCredit,
                type: row.type,
                paymentType: row.paymentType,
                transactionId,
            });

            return {
                id: row.id,
                createdDate: row.createdDate ?? '',
                amount: amount.toFixed(2),
                isCredit,
                note: row.note ?? '',
                transactionId,
                paymentType: row.paymentType ?? '',
                walletEvent,
                walletEventLabel: formatWalletTransactionEventLabel(walletEvent),
                bookingServiceName: booking?.serviceName ?? '',
                bookingCustomerName: booking?.customerName ?? '',
                bookingStatus: booking?.status ?? '',
            };
        });

        const storedWalletAmount = Number(
            (providerRow as { walletAmount?: string | number }).walletAmount ?? 0
        );

        return NextResponse.json({
            data,
            stats: {
                count: data.length,
                ledgerNet: Math.round(ledgerNet * 100) / 100,
                storedWalletAmount: Number.isFinite(storedWalletAmount) ? storedWalletAmount : 0,
                ledgerMatchesStored: Math.abs(ledgerNet - storedWalletAmount) < 0.02,
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch provider wallet history';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
