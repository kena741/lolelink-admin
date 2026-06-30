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
    customer_id?: string | null;
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
    const customerId = id.trim();
    if (!customerId) {
        return NextResponse.json({ error: 'Customer id is required' }, { status: 400 });
    }

    try {
        const supabaseAdmin = getSupabaseAdminFromRequest(request);

        const { data: customerRow, error: customerError } = await supabaseAdmin
            .from('customer')
            .select('wallet_amount, user_id')
            .eq('id', customerId)
            .maybeSingle();

        if (customerError) {
            return NextResponse.json({ error: customerError.message }, { status: 500 });
        }
        if (!customerRow) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        const authUserId = readAuthUserId((customerRow as { user_id?: string | null }).user_id);
        const orFilters = [`customer_id.eq.${customerId}`, `userId.eq.${customerId}`];
        if (authUserId) orFilters.push(`userId.eq.${authUserId}`);

        const walletResult = await supabaseAdmin
            .from('wallet_transaction')
            .select('id, amount, createdDate, isCredit, note, paymentType, transactionId, type, userId, customer_id')
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

        const providerIds = [
            ...new Set(
                Object.values(bookingById)
                    .map((booking) => booking.providerId)
                    .filter((value) => value.length > 0)
            ),
        ];
        const providerNameById: Record<string, string> = {};
        if (providerIds.length > 0) {
            const { data: providers } = await supabaseAdmin
                .from('provider')
                .select('id, firstName, lastName, first_name, last_name, name, userName')
                .in('id', providerIds);
            for (const provider of (providers ?? []) as Record<string, unknown>[]) {
                const providerId = typeof provider.id === 'string' ? provider.id : '';
                if (!providerId) continue;
                const first =
                    (typeof provider.firstName === 'string' ? provider.firstName : null)
                    ?? (typeof provider.first_name === 'string' ? provider.first_name : null)
                    ?? '';
                const last =
                    (typeof provider.lastName === 'string' ? provider.lastName : null)
                    ?? (typeof provider.last_name === 'string' ? provider.last_name : null)
                    ?? '';
                const full = [first, last].filter(Boolean).join(' ').trim();
                providerNameById[providerId] =
                    full
                    || (typeof provider.name === 'string' ? provider.name : '')
                    || (typeof provider.userName === 'string' ? provider.userName : '')
                    || providerId;
            }
        }

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
                bookingProviderName: booking?.providerId ? providerNameById[booking.providerId] ?? '' : '',
                bookingStatus: booking?.status ?? '',
            };
        });

        const storedWalletAmount = Number(
            (customerRow as { wallet_amount?: string | number }).wallet_amount ?? 0
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
        const message = error instanceof Error ? error.message : 'Failed to fetch customer wallet history';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
