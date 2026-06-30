import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { analyzeProviderPayoutWallet } from '@/lib/provider-payout-analysis';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { readAuthUserId } from '@/lib/wallet-transaction-user';

export const runtime = 'nodejs';

function hasChapaTransferStarted(adminNote: string): boolean {
    const note = adminNote.toLowerCase();
    return (
        note.includes('chapa transfer sent.')
        || note.includes('chapa transfer reference:')
        || note.includes('reference=')
    );
}

function parseAmount(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatProviderName(raw: Record<string, unknown>): string {
    const first = typeof raw.firstName === 'string' ? raw.firstName.trim() : '';
    const last = typeof raw.lastName === 'string' ? raw.lastName.trim() : '';
    const full = [first, last].filter(Boolean).join(' ').trim();
    if (full) return full;
    if (typeof raw.userName === 'string' && raw.userName.trim()) return raw.userName.trim();
    return 'Unknown provider';
}

export async function GET(request: Request) {
    const auth = await requireAdminPermission(request, 'finance:read');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(request.url);
    const providerId = (url.searchParams.get('providerId') ?? '').trim();
    const withdrawalId = (url.searchParams.get('withdrawalId') ?? '').trim();

    if (!providerId) {
        return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
    }

    try {
        const supabaseAdmin = getSupabaseAdminFromRequest(request);

        const providerResult = await supabaseAdmin
            .from('provider')
            .select('id, email, firstName, lastName, userName, walletAmount, user_id')
            .eq('id', providerId)
            .maybeSingle();

        if (providerResult.error) {
            return NextResponse.json({ error: providerResult.error.message }, { status: 500 });
        }
        if (!providerResult.data) {
            return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
        }

        const provider = providerResult.data as Record<string, unknown>;
        const providerAuthUserId = readAuthUserId(provider.user_id);
        if (!providerAuthUserId) {
            return NextResponse.json({ error: 'Provider is not linked to an auth account' }, { status: 400 });
        }

        const [walletResult, bookingsResult] = await Promise.all([
            supabaseAdmin
                .from('wallet_transaction')
                .select('id, amount, isCredit, note, paymentType, transactionId, createdDate')
                .eq('userId', providerAuthUserId)
                .order('createdDate', { ascending: false }),
            supabaseAdmin
                .from('booked_service')
                .select('id, customer_id, customer_user_id, status, totalAmount, payment_status, paymentCompleted')
                .eq('provider_id', providerId),
        ]);

        if (walletResult.error) {
            return NextResponse.json({ error: walletResult.error.message }, { status: 500 });
        }
        if (bookingsResult.error) {
            return NextResponse.json({ error: bookingsResult.error.message }, { status: 500 });
        }

        const bookings = bookingsResult.data ?? [];
        const customerIds = Array.from(
            new Set(
                bookings
                    .map((booking) => booking.customer_id)
                    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
            )
        );

        let requestedWithdrawalAmount: number | null = null;
        let withdrawalStatus: string | null = null;
        let transferStarted = false;
        if (withdrawalId) {
            const { data: withdrawal, error: withdrawalError } = await supabaseAdmin
                .from('withdrawal_history')
                .select('id, amount, providerId, paymentStatus, adminNote')
                .eq('id', withdrawalId)
                .maybeSingle();

            if (withdrawalError) {
                return NextResponse.json({ error: withdrawalError.message }, { status: 500 });
            }
            if (!withdrawal) {
                return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 });
            }
            if ((withdrawal as { providerId?: string }).providerId !== providerId) {
                return NextResponse.json({ error: 'Withdrawal does not belong to this provider' }, { status: 400 });
            }
            requestedWithdrawalAmount = parseAmount((withdrawal as { amount?: string | number }).amount);
            withdrawalStatus =
                typeof (withdrawal as { paymentStatus?: string }).paymentStatus === 'string'
                    ? (withdrawal as { paymentStatus: string }).paymentStatus
                    : null;
            transferStarted = hasChapaTransferStarted(
                typeof (withdrawal as { adminNote?: string | null }).adminNote === 'string'
                    ? (withdrawal as { adminNote: string }).adminNote
                    : ''
            );
        }

        const [customersResult, customerWalletResult] = customerIds.length
            ? await (async () => {
                const customersResultInner = await supabaseAdmin
                    .from('customer')
                    .select('id, user_id')
                    .in('id', customerIds);

                if (customersResultInner.error) {
                    return [customersResultInner, { data: [], error: null }] as const;
                }

                const customerAuthUserIds = Array.from(
                    new Set(
                        (customersResultInner.data ?? [])
                            .map((customer) => readAuthUserId((customer as { user_id?: string | null }).user_id))
                            .filter((id): id is string => Boolean(id))
                    )
                );

                const customerWalletResultInner =
                    customerAuthUserIds.length > 0
                        ? await supabaseAdmin
                              .from('wallet_transaction')
                              .select('userId, isCredit, note, transactionId')
                              .in('userId', customerAuthUserIds)
                              .eq('isCredit', true)
                        : { data: [], error: null };

                return [customersResultInner, customerWalletResultInner] as const;
            })()
            : [{ data: [], error: null }, { data: [], error: null }];

        if (customersResult.error) {
            return NextResponse.json({ error: customersResult.error.message }, { status: 500 });
        }
        if (customerWalletResult.error) {
            return NextResponse.json({ error: customerWalletResult.error.message }, { status: 500 });
        }

        const analysis = analyzeProviderPayoutWallet({
            providerId,
            providerName: formatProviderName(provider),
            providerEmail: typeof provider.email === 'string' ? provider.email : null,
            providerUserId: typeof provider.user_id === 'string' ? provider.user_id : null,
            storedWalletAmount: parseAmount(provider.walletAmount),
            walletTransactions: walletResult.data ?? [],
            bookings,
            customers: customersResult.data ?? [],
            customerWalletCredits: [...(customerWalletResult.data ?? [])],
            requestedWithdrawalAmount,
            withdrawalStatus,
            hasTransferStarted: transferStarted,
        });

        return NextResponse.json({ data: analysis });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to analyze provider wallet';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
