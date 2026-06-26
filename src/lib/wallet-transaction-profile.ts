import type { SupabaseClient } from '@supabase/supabase-js';
import { readAuthUserId } from '@/lib/wallet-transaction-user';

export interface WalletProfileDisplay {
    profileId: string;
    name: string;
    email: string;
    phone: string;
    authUserId: string;
}

function readProfileId(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    return value.trim();
}

function providerDisplayName(raw: Record<string, unknown>): string {
    const first =
        (typeof raw.firstName === 'string' && raw.firstName) ||
        (typeof raw.first_name === 'string' && raw.first_name) ||
        '';
    const last =
        (typeof raw.lastName === 'string' && raw.lastName) ||
        (typeof raw.last_name === 'string' && raw.last_name) ||
        '';
    const full = [first, last].filter(Boolean).join(' ');
    if (full) return full;
    if (typeof raw.userName === 'string' && raw.userName.trim()) return raw.userName.trim();
    return '';
}

function providerDisplayPhone(raw: Record<string, unknown>): string {
    if (typeof raw.phoneNumber === 'string' && raw.phoneNumber) return raw.phoneNumber;
    if (typeof raw.phone === 'string' && raw.phone) return raw.phone;
    return '';
}

function customerDisplayName(raw: Record<string, unknown>): string {
    const first =
        (typeof raw.first_name === 'string' && raw.first_name) ||
        (typeof raw.firstName === 'string' && raw.firstName) ||
        '';
    const last =
        (typeof raw.last_name === 'string' && raw.last_name) ||
        (typeof raw.lastName === 'string' && raw.lastName) ||
        '';
    const full = [first, last].filter(Boolean).join(' ');
    if (full) return full;
    if (typeof raw.user_name === 'string' && raw.user_name.trim()) return raw.user_name.trim();
    return '';
}

function customerDisplayPhone(raw: Record<string, unknown>): string {
    const candidates = [raw.phoneNumber, raw.phone, raw.mobile_number, raw.mobileNumber];
    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
}

function displayEmail(raw: Record<string, unknown>): string {
    if (typeof raw.email === 'string' && raw.email.trim()) return raw.email.trim();
    return '';
}

function toProviderDisplay(raw: Record<string, unknown>): WalletProfileDisplay | null {
    const profileId = readProfileId(raw.id);
    const authUserId = readAuthUserId(raw.user_id);
    if (!profileId) return null;
    return {
        profileId,
        authUserId: authUserId ?? '',
        name: providerDisplayName(raw),
        email: displayEmail(raw),
        phone: providerDisplayPhone(raw),
    };
}

function toCustomerDisplay(raw: Record<string, unknown>): WalletProfileDisplay | null {
    const profileId = readProfileId(raw.id);
    const authUserId = readAuthUserId(raw.user_id);
    if (!profileId) return null;
    return {
        profileId,
        authUserId: authUserId ?? '',
        name: customerDisplayName(raw),
        email: displayEmail(raw),
        phone: customerDisplayPhone(raw),
    };
}

export interface WalletProfileLookups {
    providerById: Record<string, WalletProfileDisplay>;
    customerById: Record<string, WalletProfileDisplay>;
}

export async function buildWalletProfileLookupsByProfileId(
    admin: SupabaseClient,
    rows: { provider_id?: string | null; customer_id?: string | null }[]
): Promise<WalletProfileLookups> {
    const providerIds = [
        ...new Set(
            rows
                .map((row) => readProfileId(row.provider_id))
                .filter((id): id is string => Boolean(id))
        ),
    ];
    const customerIds = [
        ...new Set(
            rows
                .map((row) => readProfileId(row.customer_id))
                .filter((id): id is string => Boolean(id))
        ),
    ];

    const providerById: Record<string, WalletProfileDisplay> = {};
    const customerById: Record<string, WalletProfileDisplay> = {};

    if (providerIds.length > 0) {
        const { data, error } = await admin.from('provider').select('*').in('id', providerIds);
        if (error) throw error;
        for (const row of (data ?? []) as Record<string, unknown>[]) {
            const display = toProviderDisplay(row);
            if (display) providerById[display.profileId] = display;
        }
    }

    if (customerIds.length > 0) {
        const { data, error } = await admin.from('customer').select('*').in('id', customerIds);
        if (error) throw error;
        for (const row of (data ?? []) as Record<string, unknown>[]) {
            const display = toCustomerDisplay(row);
            if (display) customerById[display.profileId] = display;
        }
    }

    return { providerById, customerById };
}

export function walletTransactionProfileColumns(params: {
    type: string;
    authUserId: string;
    customerId?: string;
    providerId?: string;
}): { userId: string; customer_id: string | null; provider_id: string | null } {
    const normalizedType = params.type.trim().toLowerCase();
    const customerId = readProfileId(params.customerId);
    const providerId = readProfileId(params.providerId);

    if (normalizedType === 'customer') {
        return {
            userId: params.authUserId,
            customer_id: customerId,
            provider_id: null,
        };
    }

    return {
        userId: params.authUserId,
        customer_id: null,
        provider_id: providerId,
    };
}
