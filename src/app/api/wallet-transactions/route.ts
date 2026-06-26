import { NextResponse } from 'next/server';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
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
}

function emptyProfile() {
    return { name: '', email: '', phone: '', profileId: '' };
}

function emptyAuthUser() {
    return { name: '', email: '', phone: '' };
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
        const authUserIds = rows
            .map((row) => readAuthUserId(row.userId))
            .filter((id): id is string => Boolean(id));

        const [{ providerById, customerById }, profileByAuthUserId, authUserById] = await Promise.all([
            buildWalletProfileLookupsByProfileId(supabaseAdmin, rows),
            buildWalletProfileLookupByAuthUserId(supabaseAdmin, rows),
            buildAuthUserLookup(supabaseAdmin, authUserIds),
        ]);

        const enriched = rows.map((row) => {
            const providerProfileId =
                typeof row.provider_id === 'string' && row.provider_id.trim() ? row.provider_id.trim() : '';
            const customerProfileId =
                typeof row.customer_id === 'string' && row.customer_id.trim() ? row.customer_id.trim() : '';

            const providerFromProfile = providerProfileId ? providerById[providerProfileId] : undefined;
            const customerFromProfile = customerProfileId ? customerById[customerProfileId] : undefined;

            const authUserId = readAuthUserId(row.userId);
            const authLookup = authUserId ? profileByAuthUserId[authUserId] : undefined;

            const provider =
                providerFromProfile ??
                (!isCustomerWalletTransactionType(row.type) ? authLookup : undefined);
            const customer =
                customerFromProfile ??
                (isCustomerWalletTransactionType(row.type) ? authLookup : undefined);

            const providerInfo = provider
                ? {
                      profileId: provider.profileId,
                      name: provider.name,
                      email: provider.email,
                      phone: provider.phone,
                  }
                : emptyProfile();

            const customerInfo = customer
                ? {
                      profileId: customer.profileId,
                      name: customer.name,
                      email: customer.email,
                      phone: customer.phone,
                  }
                : emptyProfile();

            const authUser = authUserId ? authUserById[authUserId] : undefined;
            const authUserInfo = authUser
                ? {
                      name: authUser.name,
                      email: authUser.email,
                      phone: authUser.phone,
                  }
                : emptyAuthUser();

            return {
                ...row,
                providerName: providerInfo.name,
                providerEmail: providerInfo.email,
                providerPhone: providerInfo.phone,
                providerProfileId: providerInfo.profileId,
                customerName: customerInfo.name,
                customerEmail: customerInfo.email,
                customerPhone: customerInfo.phone,
                customerProfileId: customerInfo.profileId,
                authUserName: authUserInfo.name,
                authUserEmail: authUserInfo.email,
                authUserPhone: authUserInfo.phone,
            };
        });

        return NextResponse.json({ data: enriched });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch wallet transactions';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
