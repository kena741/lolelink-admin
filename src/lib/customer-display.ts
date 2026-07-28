import { formatDisplayPhone } from '@/lib/phone-display';

interface CustomerAddressLike {
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
}

interface CustomerNameLike {
    first_name?: string | null;
    last_name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    user_name?: string | null;
}

export function getCustomerDisplayName(customer: CustomerNameLike | null | undefined): string {
    if (!customer) return '—';
    const first = customer.first_name ?? customer.firstName ?? '';
    const last = customer.last_name ?? customer.lastName ?? '';
    const full = [first, last].filter(Boolean).join(' ').trim();
    if (full) return full;
    const userName = customer.user_name?.trim();
    return userName || '—';
}

export function getCustomerPhone(customer: Record<string, unknown> | null | undefined): string {
    if (!customer) return '';
    const candidates = [customer.phoneNumber, customer.phone, customer.mobile_number, customer.mobileNumber];
    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) return formatDisplayPhone(value);
    }
    return '';
}

function parseAddressObject(value: unknown): CustomerAddressLike | null {
    if (!value) return null;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value) as unknown;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as CustomerAddressLike;
            }
        } catch {
            return null;
        }
        return null;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
        return value as CustomerAddressLike;
    }
    return null;
}

export function formatCustomerAddress(customer: {
    default_address?: unknown;
    address?: string | null;
} | null | undefined): string {
    if (!customer) return '—';

    const parsed = parseAddressObject(customer.default_address);
    if (parsed) {
        const parts = [parsed.city, parsed.state, parsed.country, parsed.postal_code].filter(
            (part): part is string => typeof part === 'string' && part.length > 0
        );
        if (parts.length > 0) return parts.join(', ');
    }

    if (typeof customer.default_address === 'string' && customer.default_address.trim()) {
        return customer.default_address.trim();
    }

    if (typeof customer.address === 'string' && customer.address.trim()) {
        return customer.address.trim();
    }

    return '—';
}

export function customerIsArchived(customer: {
    archived_at?: string | null;
    archivedAt?: string | null;
} | null | undefined): boolean {
    const value = customer?.archived_at ?? customer?.archivedAt;
    return typeof value === 'string' && value.length > 0;
}
