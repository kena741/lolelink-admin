import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveServiceName } from '@/lib/booking-pricing';
import { sanitizePersonDisplayName } from '@/lib/booking-display';
import { isUuid } from '@/lib/wallet-transaction-display';

export interface WalletBookingEnrichment {
    bookingId: string;
    serviceName: string;
    customerName: string;
    customerEmail: string;
    totalAmount: number | null;
    adminCommission: number | null;
    status: string;
    customerId: string;
    providerId: string;
    customerUserId: string;
    providerUserId: string;
}

function parseAmount(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function bookingCustomerName(row: Record<string, unknown>): string {
    const first = typeof row.firstName === 'string' ? row.firstName.trim() : '';
    const last = typeof row.lastName === 'string' ? row.lastName.trim() : '';
    const full = [first, last].filter(Boolean).join(' ');
    return sanitizePersonDisplayName(full);
}

async function fetchServiceNamesById(
    admin: SupabaseClient,
    serviceIds: string[]
): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (serviceIds.length === 0) return map;

    const { data, error } = await admin
        .from('service')
        .select('id, serviceName')
        .in('id', serviceIds);

    if (error || !data) return map;

    for (const row of data as Record<string, unknown>[]) {
        const id = typeof row.id === 'string' ? row.id : '';
        if (!id) continue;
        const name = resolveServiceName(row);
        if (name) map.set(id, sanitizePersonDisplayName(name));
    }

    return map;
}

export async function buildWalletBookingEnrichmentById(
    admin: SupabaseClient,
    bookingIds: string[]
): Promise<Record<string, WalletBookingEnrichment>> {
    const uniqueIds = [...new Set(bookingIds.filter((id) => isUuid(id)))];
    if (uniqueIds.length === 0) return {};

    const { data, error } = await admin
        .from('booked_service')
        .select(
            'id, serviceName, service_id, firstName, lastName, email, totalAmount, adminCommission, customer_id, provider_id, customer_user_id, provider_user_id, status'
        )
        .in('id', uniqueIds);

    if (error || !data) return {};

    const rows = data as Record<string, unknown>[];
    const serviceIds = rows
        .map((row) => (typeof row.service_id === 'string' ? row.service_id : ''))
        .filter((id) => id.length > 0);
    const serviceNamesById = await fetchServiceNamesById(admin, [...new Set(serviceIds)]);

    const result: Record<string, WalletBookingEnrichment> = {};

    for (const row of rows) {
        const bookingId = typeof row.id === 'string' ? row.id : '';
        if (!bookingId) continue;

        const serviceId = typeof row.service_id === 'string' ? row.service_id : '';
        const directServiceName =
            typeof row.serviceName === 'string' ? sanitizePersonDisplayName(row.serviceName.trim()) : '';
        const serviceName = directServiceName || (serviceId ? serviceNamesById.get(serviceId) ?? '' : '');

        result[bookingId] = {
            bookingId,
            serviceName,
            customerName: bookingCustomerName(row),
            customerEmail: typeof row.email === 'string' ? row.email.trim() : '',
            totalAmount: parseAmount(row.totalAmount),
            adminCommission: parseAmount(row.adminCommission),
            status: typeof row.status === 'string' ? row.status : '',
            customerId: typeof row.customer_id === 'string' ? row.customer_id : '',
            providerId: typeof row.provider_id === 'string' ? row.provider_id : '',
            customerUserId: typeof row.customer_user_id === 'string' ? row.customer_user_id : '',
            providerUserId: typeof row.provider_user_id === 'string' ? row.provider_user_id : '',
        };
    }

    return result;
}

export function collectBookingIdsFromWalletRows(
    rows: { transactionId?: string | null }[]
): string[] {
    return rows
        .map((row) => (typeof row.transactionId === 'string' ? row.transactionId.trim() : ''))
        .filter((id) => isUuid(id));
}
