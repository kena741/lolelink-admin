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
import { resolveProviderAuthUserId } from '@/lib/wallet-transaction-user';

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

    const { id: providerId } = await context.params;
    const normalizedProviderId = providerId.trim();
    if (!normalizedProviderId) {
        return NextResponse.json({ error: 'Provider id is required' }, { status: 400 });
    }

    try {
        const supabaseAdmin = getSupabaseAdminFromRequest(request);
        const authUser = await resolveProviderAuthUserId(supabaseAdmin, normalizedProviderId);
        if (!authUser.ok) {
            return NextResponse.json({ error: authUser.error }, { status: authUser.status });
        }

        const walletResult = await supabaseAdmin
            .from('wallet_transaction')
            .select('id, amount, createdDate, isCredit, note, paymentType, transactionId, type, userId, provider_id')
            .or(
                [
                    `userId.eq.${authUser.authUserId}`,
                    `userId.eq.${normalizedProviderId}`,
                    `provider_id.eq.${normalizedProviderId}`,
                ].join(',')
            )
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

        const providerResult = await supabaseAdmin
            .from('provider')
            .select('walletAmount')
            .eq('id', normalizedProviderId)
            .maybeSingle();

        const storedWalletAmount = Number(
            (providerResult.data as { walletAmount?: string | number } | null)?.walletAmount ?? 0
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
