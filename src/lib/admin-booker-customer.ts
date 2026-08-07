import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Designated customer account used for admin walk-in / internal bookings.
 * Lookup only — do not insert or store passwords here.
 */
export const ADMIN_BOOKER = {
    email: 'support@zemenservice.com',
    phoneDigits: '0951175959',
    first_name: 'Zemen',
    last_name: 'Admin',
    displayName: 'Zemen Admin',
    badge: 'Admin booked',
} as const;

function normalizePhoneDigits(value: string | null | undefined): string {
    return (value ?? '').replace(/\D/g, '');
}

function phonesMatch(a: string, b: string): boolean {
    if (!a || !b) return false;
    if (a === b) return true;
    // ET local vs 251…
    const aTail = a.length >= 9 ? a.slice(-9) : a;
    const bTail = b.length >= 9 ? b.slice(-9) : b;
    return aTail === bTail;
}

export function isAdminBookerEmail(email: string | null | undefined): boolean {
    return (email ?? '').trim().toLowerCase() === ADMIN_BOOKER.email;
}

export function isAdminBookerPhone(phone: string | null | undefined): boolean {
    return phonesMatch(normalizePhoneDigits(phone), normalizePhoneDigits(ADMIN_BOOKER.phoneDigits));
}

export function isAdminBookerCustomer(customer: {
    email?: string | null;
    phoneNumber?: string | null;
    phone?: string | null;
    mobile_number?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
} | null | undefined): boolean {
    if (!customer) return false;
    if (isAdminBookerEmail(customer.email)) return true;
    if (
        isAdminBookerPhone(customer.phoneNumber) ||
        isAdminBookerPhone(customer.phone) ||
        isAdminBookerPhone(customer.mobile_number)
    ) {
        return true;
    }
    const first = (customer.first_name ?? customer.firstName ?? '').trim();
    const last = (customer.last_name ?? customer.lastName ?? '').trim();
    return first === ADMIN_BOOKER.first_name && last === ADMIN_BOOKER.last_name;
}

export function isAdminBookerBooking(booking: {
    email?: string | null;
    phoneNumber?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    customerName?: string | null;
} | null | undefined): boolean {
    if (!booking) return false;
    if (isAdminBookerEmail(booking.email)) return true;
    if (isAdminBookerPhone(booking.phoneNumber)) return true;
    const first = (booking.firstName ?? '').trim();
    const last = (booking.lastName ?? '').trim();
    if (first === ADMIN_BOOKER.first_name && last === ADMIN_BOOKER.last_name) return true;
    const name = (booking.customerName ?? '').trim();
    return name === ADMIN_BOOKER.displayName || name === 'Admin Booker';
}

/**
 * Resolves the Zemen Admin customer used for admin bookings.
 * Does not create the account — it must already exist in `customer`.
 */
export async function ensureAdminBookerCustomer(
    admin: SupabaseClient
): Promise<{ id: string; row: Record<string, unknown> }> {
    const { data: byEmail, error: emailError } = await admin
        .from('customer')
        .select('*')
        .ilike('email', ADMIN_BOOKER.email)
        .maybeSingle();

    if (emailError) throw new Error(emailError.message);

    if (byEmail && typeof (byEmail as { id?: string }).id === 'string') {
        const row = byEmail as Record<string, unknown>;
        const id = row.id as string;
        if (row.archived_at) {
            await admin.from('customer').update({ archived_at: null }).eq('id', id);
            row.archived_at = null;
        }
        return { id, row };
    }

    // Fallback: match phone on common columns (ilike / exact won't work for formatted phones).
    const { data: candidates, error: listError } = await admin
        .from('customer')
        .select('*')
        .or(
            [
                `mobile_number.ilike.%${ADMIN_BOOKER.phoneDigits.slice(-9)}%`,
                `phoneNumber.ilike.%${ADMIN_BOOKER.phoneDigits.slice(-9)}%`,
                `phone.ilike.%${ADMIN_BOOKER.phoneDigits.slice(-9)}%`,
            ].join(',')
        )
        .limit(20);

    if (listError) throw new Error(listError.message);

    const match = (candidates ?? []).find((row) =>
        isAdminBookerCustomer(row as {
            email?: string;
            phoneNumber?: string;
            phone?: string;
            mobile_number?: string;
            first_name?: string;
            last_name?: string;
        })
    ) as Record<string, unknown> | undefined;

    if (match && typeof match.id === 'string') {
        if (match.archived_at) {
            await admin.from('customer').update({ archived_at: null }).eq('id', match.id);
            match.archived_at = null;
        }
        return { id: match.id, row: match };
    }

    throw new Error(
        `Admin booker customer not found. Create/login customer ${ADMIN_BOOKER.displayName} (${ADMIN_BOOKER.email} / ${ADMIN_BOOKER.phoneDigits}) first.`
    );
}
