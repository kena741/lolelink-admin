import type { SupabaseClient } from '@supabase/supabase-js';

export interface WalletUserProfile {
    name: string;
    phone: string;
    email: string;
    profileId: string;
    authUserId: string;
}

export function readAuthUserId(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    return value.trim();
}

export function isCustomerWalletTransactionType(type: string | undefined | null): boolean {
    return typeof type === 'string' && type.trim().toLowerCase() === 'customer';
}

export async function resolveCustomerAuthUserId(
    admin: SupabaseClient,
    customerId: string
): Promise<{ ok: true; authUserId: string } | { ok: false; error: string; status: number }> {
    const normalizedCustomerId = customerId.trim();
    if (!normalizedCustomerId) {
        return { ok: false, error: 'customerId is required', status: 400 };
    }

    const { data, error } = await admin
        .from('customer')
        .select('user_id')
        .eq('id', normalizedCustomerId)
        .maybeSingle();

    if (error) {
        return { ok: false, error: error.message, status: 500 };
    }

    const authUserId = readAuthUserId((data as { user_id?: string | null } | null)?.user_id);
    if (!authUserId) {
        return {
            ok: false,
            error: 'Customer is not linked to an auth account; cannot record wallet transaction',
            status: 400,
        };
    }

    return { ok: true, authUserId };
}

export async function resolveProviderAuthUserId(
    admin: SupabaseClient,
    providerId: string
): Promise<{ ok: true; authUserId: string } | { ok: false; error: string; status: number }> {
    const normalizedProviderId = providerId.trim();
    if (!normalizedProviderId) {
        return { ok: false, error: 'providerId is required', status: 400 };
    }

    const { data, error } = await admin
        .from('provider')
        .select('user_id')
        .eq('id', normalizedProviderId)
        .maybeSingle();

    if (error) {
        return { ok: false, error: error.message, status: 500 };
    }

    const authUserId = readAuthUserId((data as { user_id?: string | null } | null)?.user_id);
    if (!authUserId) {
        return {
            ok: false,
            error: 'Provider is not linked to an auth account; cannot record wallet transaction',
            status: 400,
        };
    }

    return { ok: true, authUserId };
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

export async function buildWalletProfileLookupByAuthUserId(
    admin: SupabaseClient,
    rows: { userId?: string | null; type?: string | null }[]
): Promise<Record<string, WalletUserProfile>> {
    const customerAuthUserIds = [
        ...new Set(
            rows
                .filter((row) => isCustomerWalletTransactionType(row.type))
                .map((row) => readAuthUserId(row.userId))
                .filter((id): id is string => Boolean(id))
        ),
    ];
    const providerAuthUserIds = [
        ...new Set(
            rows
                .filter((row) => !isCustomerWalletTransactionType(row.type))
                .map((row) => readAuthUserId(row.userId))
                .filter((id): id is string => Boolean(id))
        ),
    ];

    const lookup: Record<string, WalletUserProfile> = {};

    if (providerAuthUserIds.length > 0) {
        const { data: providers, error } = await admin
            .from('provider')
            .select('*')
            .in('user_id', providerAuthUserIds);

        if (error) throw error;

        for (const provider of (providers ?? []) as Record<string, unknown>[]) {
            const authUserId = readAuthUserId(provider.user_id);
            const profileId = typeof provider.id === 'string' ? provider.id : '';
            if (!authUserId || !profileId) continue;
            lookup[authUserId] = {
                authUserId,
                profileId,
                name: providerDisplayName(provider),
                phone: providerDisplayPhone(provider),
                email: displayEmail(provider),
            };
        }
    }

    if (customerAuthUserIds.length > 0) {
        const { data: customers, error } = await admin
            .from('customer')
            .select('*')
            .in('user_id', customerAuthUserIds);

        if (error) throw error;

        for (const customer of (customers ?? []) as Record<string, unknown>[]) {
            const authUserId = readAuthUserId(customer.user_id);
            const profileId = typeof customer.id === 'string' ? customer.id : '';
            if (!authUserId || !profileId) continue;
            lookup[authUserId] = {
                authUserId,
                profileId,
                name: customerDisplayName(customer),
                phone: customerDisplayPhone(customer),
                email: displayEmail(customer),
            };
        }
    }

    return lookup;
}

export interface AuthUserDisplay {
    authUserId: string;
    name: string;
    email: string;
    phone: string;
}

function readMetaString(meta: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
        const value = meta[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
}

function parseAuthUserDisplay(user: {
    id: string;
    email?: string | null;
    phone?: string | null;
    user_metadata?: Record<string, unknown>;
}): AuthUserDisplay {
    const meta = user.user_metadata ?? {};
    const first = readMetaString(meta, ['first_name', 'firstName']);
    const last = readMetaString(meta, ['last_name', 'lastName']);
    const full = readMetaString(meta, ['full_name', 'name', 'user_name', 'userName']);
    const combined = full || [first, last].filter(Boolean).join(' ');
    const email = typeof user.email === 'string' ? user.email.trim() : '';
    const phone =
        (typeof user.phone === 'string' && user.phone.trim() ? user.phone.trim() : '') ||
        readMetaString(meta, ['phone', 'phoneNumber', 'mobile_number', 'mobileNumber']);

    return {
        authUserId: user.id,
        name: combined || (email ? email.split('@')[0] : ''),
        email,
        phone,
    };
}

async function fetchAuthUserDisplay(
    admin: SupabaseClient,
    authUserId: string
): Promise<AuthUserDisplay | null> {
    const { data, error } = await admin.auth.admin.getUserById(authUserId);
    if (error || !data.user) return null;
    return parseAuthUserDisplay(data.user);
}

export async function buildAuthUserLookup(
    admin: SupabaseClient,
    userIds: string[]
): Promise<Record<string, AuthUserDisplay>> {
    const uniqueIds = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
    const lookup: Record<string, AuthUserDisplay> = {};
    const batchSize = 25;

    for (let index = 0; index < uniqueIds.length; index += batchSize) {
        const batch = uniqueIds.slice(index, index + batchSize);
        const results = await Promise.all(batch.map((id) => fetchAuthUserDisplay(admin, id)));
        for (const result of results) {
            if (result) lookup[result.authUserId] = result;
        }
    }

    return lookup;
}
