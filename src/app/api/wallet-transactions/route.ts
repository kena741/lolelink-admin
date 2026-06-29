import { NextResponse } from 'next/server';
import { sanitizePersonDisplayName } from '@/lib/booking-display';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import {
    buildWalletBookingEnrichmentById,
    collectBookingIdsFromWalletRows,
} from '@/lib/wallet-transaction-booking-enrichment';
import {
    formatWalletTransactionEventLabel,
    parseWalletTransactionEvent,
    resolveWalletPaymentDisplayLabel,
} from '@/lib/wallet-transaction-display';
import {
    resolveWalletAuthUserId,
} from '@/lib/wallet-transaction-auth-resolve';
import { buildWalletProfileLookupsByProfileId } from '@/lib/wallet-transaction-profile';
import {
    buildAuthUserLookup,
    buildWalletProfileLookupByAuthUserId,
    isCustomerWalletTransactionType,
    readAuthUserId,
} from '@/lib/wallet-transaction-user';

export const runtime = 'nodejs';

interface WalletTransactionRow {
    userId?: string | null;
    provider_id?: string | null;
    customer_id?: string | null;
    type?: string | null;
    note?: string | null;
    isCredit?: boolean | null;
    paymentType?: string | null;
    transactionId?: string | null;
}

function emptyProfile() {
    return { name: '', email: '', phone: '', profileId: '', authUserId: '' };
}

function emptyAuthUser() {
    return { name: '', email: '', phone: '' };
}

function collectAuthUserIdsForLookup(
    rows: WalletTransactionRow[],
    providerById: Record<string, { authUserId: string }>,
    customerById: Record<string, { authUserId: string }>
): string[] {
    const ids = new Set<string>();

    for (const row of rows) {
        const raw = readAuthUserId(row.userId);
        if (raw) ids.add(raw);
    }

    for (const profile of Object.values(providerById)) {
        const authUserId = readAuthUserId(profile.authUserId);
        if (authUserId) ids.add(authUserId);
    }

    for (const profile of Object.values(customerById)) {
        const authUserId = readAuthUserId(profile.authUserId);
        if (authUserId) ids.add(authUserId);
    }

    return [...ids];
}

export async function GET(request: Request) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const { data, error } = await supabaseAdmin
            .from('wallet_transaction')
            .select('*')
            .order('createdDate', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const rows = (data ?? []) as WalletTransactionRow[];

        const { providerById, customerById } = await buildWalletProfileLookupsByProfileId(supabaseAdmin, rows);

        const preliminaryAuthIds = collectAuthUserIdsForLookup(rows, providerById, customerById);
        const authUserById = await buildAuthUserLookup(supabaseAdmin, preliminaryAuthIds);
        const knownAuthUserIds = new Set(Object.keys(authUserById));

        const profileByAuthUserId = await buildWalletProfileLookupByAuthUserId(supabaseAdmin, rows);
        const bookingById = await buildWalletBookingEnrichmentById(
            supabaseAdmin,
            collectBookingIdsFromWalletRows(rows)
        );

        const enriched = rows.map((row) => {
            const providerProfileId =
                typeof row.provider_id === 'string' && row.provider_id.trim() ? row.provider_id.trim() : '';
            const customerProfileId =
                typeof row.customer_id === 'string' && row.customer_id.trim() ? row.customer_id.trim() : '';

            const providerFromProfile = providerProfileId ? providerById[providerProfileId] : undefined;
            const customerFromProfile = customerProfileId ? customerById[customerProfileId] : undefined;

            const rawUserId = readAuthUserId(row.userId);
            const authLookup = rawUserId ? profileByAuthUserId[rawUserId] : undefined;

            const provider =
                providerFromProfile ??
                (!isCustomerWalletTransactionType(row.type) ? authLookup : undefined);
            const customer =
                customerFromProfile ??
                (isCustomerWalletTransactionType(row.type) ? authLookup : undefined);

            const providerInfo = provider
                ? {
                      profileId: provider.profileId,
                      authUserId: provider.authUserId,
                      name: provider.name,
                      email: provider.email,
                      phone: provider.phone,
                  }
                : emptyProfile();

            const customerInfo = customer
                ? {
                      profileId: customer.profileId,
                      authUserId: customer.authUserId,
                      name: customer.name,
                      email: customer.email,
                      phone: customer.phone,
                  }
                : emptyProfile();

            const { authUserId: resolvedAuthUserId, userIdStoredAsProfile } = resolveWalletAuthUserId({
                rawUserId: row.userId,
                customerProfile: customerInfo.profileId
                    ? { profileId: customerInfo.profileId, authUserId: customerInfo.authUserId }
                    : null,
                providerProfile: providerInfo.profileId
                    ? { profileId: providerInfo.profileId, authUserId: providerInfo.authUserId }
                    : null,
                knownAuthUserIds,
            });

            const authUser = resolvedAuthUserId ? authUserById[resolvedAuthUserId] : undefined;
            const authUserInfo = authUser
                ? {
                      name: sanitizePersonDisplayName(authUser.name),
                      email: authUser.email,
                      phone: authUser.phone,
                  }
                : emptyAuthUser();

            const transactionId = typeof row.transactionId === 'string' ? row.transactionId.trim() : '';
            const booking = transactionId ? bookingById[transactionId] : undefined;
            const walletEvent = parseWalletTransactionEvent({
                note: row.note,
                isCredit: row.isCredit,
                type: row.type,
                paymentType: row.paymentType,
                transactionId,
            });

            const resolvedCustomerName =
                sanitizePersonDisplayName(customerInfo.name) || booking?.customerName || '';
            const resolvedCustomerEmail = customerInfo.email || booking?.customerEmail || '';

            return {
                ...row,
                providerName: sanitizePersonDisplayName(providerInfo.name),
                providerEmail: providerInfo.email,
                providerPhone: providerInfo.phone,
                providerProfileId: providerInfo.profileId,
                customerName: resolvedCustomerName,
                customerEmail: resolvedCustomerEmail,
                customerPhone: customerInfo.phone,
                customerProfileId: customerInfo.profileId,
                authUserId: resolvedAuthUserId,
                authUserName: authUserInfo.name,
                authUserEmail: authUserInfo.email,
                authUserPhone: authUserInfo.phone,
                userIdStoredAsProfile,
                bookingServiceName: booking?.serviceName ?? '',
                bookingCustomerName: booking?.customerName ?? '',
                bookingTotalAmount: booking?.totalAmount ?? null,
                bookingAdminCommission: booking?.adminCommission ?? null,
                walletEvent,
                walletEventLabel: formatWalletTransactionEventLabel(walletEvent),
                paymentDisplayLabel: resolveWalletPaymentDisplayLabel({
                    paymentType: row.paymentType,
                    note: row.note,
                    isCredit: row.isCredit,
                    type: row.type,
                }),
            };
        });

        return NextResponse.json({ data: enriched });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch wallet transactions';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
