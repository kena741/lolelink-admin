import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Designated customer account used for admin walk-in / internal bookings.
 * Wallet is the float that admin bookings debit (no Chapa).
 */
export const ADMIN_BOOKER = {
    email: '251951175959@phone.zemen.app',
    altEmails: ['support@zemenservice.com'] as readonly string[],
    phoneDigits: '0951175959',
    first_name: 'Zemen',
    last_name: 'Admin',
    displayName: 'Zemen Admin',
    badge: 'Admin booked',
    /** Keep this customer wallet topped up to at least this ETB balance. */
    walletFloor: 20_000,
} as const;

function normalizePhoneDigits(value: string | null | undefined): string {
    return (value ?? '').replace(/\D/g, '');
}

function phonesMatch(a: string, b: string): boolean {
    if (!a || !b) return false;
    if (a === b) return true;
    const aTail = a.length >= 9 ? a.slice(-9) : a;
    const bTail = b.length >= 9 ? b.slice(-9) : b;
    return aTail === bTail;
}

export function isAdminBookerEmail(email: string | null | undefined): boolean {
    const normalized = (email ?? '').trim().toLowerCase();
    if (!normalized) return false;
    if (normalized === ADMIN_BOOKER.email.toLowerCase()) return true;
    return ADMIN_BOOKER.altEmails.some((e) => e.toLowerCase() === normalized);
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

function customerPhone(row: Record<string, unknown>): string {
    return String(row.phone ?? row.phoneNumber ?? row.mobile_number ?? '');
}

/**
 * Tops up Zemen Admin wallet to ADMIN_BOOKER.walletFloor when below floor.
 * Leaves a credit row when topped up.
 */
export async function ensureAdminBookerWalletFloor(
    admin: SupabaseClient,
    customerId: string
): Promise<number> {
    const { data, error } = await admin
        .from('customer')
        .select('id, wallet_amount, user_id')
        .eq('id', customerId)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Admin booker customer not found for wallet top-up');

    const current = Number((data as { wallet_amount?: string | number }).wallet_amount ?? 0);
    const balance = Number.isFinite(current) ? current : 0;
    const floor = ADMIN_BOOKER.walletFloor;
    if (balance >= floor) return balance;

    const credit = Math.round((floor - balance) * 100) / 100;
    const next = Math.round((balance + credit) * 100) / 100;
    const now = new Date().toISOString();
    const authUserId = String((data as { user_id?: string | null }).user_id ?? customerId);

    const { error: txError } = await admin.from('wallet_transaction').insert({
        amount: credit.toFixed(2),
        createdDate: now,
        isCredit: true,
        note: `Admin float top-up to ETB ${floor.toFixed(2)}`,
        paymentType: 'admin',
        transactionId: `admin-float-${Date.now()}`,
        type: 'customer',
        userId: authUserId,
        customer_id: customerId,
        provider_id: null,
    });
    if (txError) throw new Error(txError.message);

    const { error: walletError } = await admin
        .from('customer')
        .update({ wallet_amount: next.toFixed(2) })
        .eq('id', customerId);
    if (walletError) throw new Error(walletError.message);

    return next;
}

/**
 * Resolves the Zemen Admin customer used for admin bookings.
 * Does not create the account — it must already exist in `customer`.
 * Ensures wallet is at least ADMIN_BOOKER.walletFloor.
 */
export async function ensureAdminBookerCustomer(
    admin: SupabaseClient
): Promise<{ id: string; row: Record<string, unknown> }> {
    const phoneTail = normalizePhoneDigits(ADMIN_BOOKER.phoneDigits).slice(-9);

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
        const wallet = await ensureAdminBookerWalletFloor(admin, id);
        row.wallet_amount = wallet;
        return { id, row };
    }

    for (const alt of ADMIN_BOOKER.altEmails) {
        const { data } = await admin.from('customer').select('*').ilike('email', alt).maybeSingle();
        if (data && typeof (data as { id?: string }).id === 'string') {
            const row = data as Record<string, unknown>;
            const id = row.id as string;
            if (row.archived_at) {
                await admin.from('customer').update({ archived_at: null }).eq('id', id);
                row.archived_at = null;
            }
            const wallet = await ensureAdminBookerWalletFloor(admin, id);
            row.wallet_amount = wallet;
            return { id, row };
        }
    }

    // customer.phone only in this schema (no phoneNumber / mobile_number columns)
    const { data: candidates, error: listError } = await admin
        .from('customer')
        .select('*')
        .or(`phone.ilike.%${phoneTail}%,first_name.eq.${ADMIN_BOOKER.first_name}`)
        .limit(40);

    if (listError) throw new Error(listError.message);

    const match = (candidates ?? []).find((row) =>
        isAdminBookerCustomer({
            email: row.email as string,
            phone: customerPhone(row as Record<string, unknown>),
            first_name: row.first_name as string,
            last_name: row.last_name as string,
        })
    ) as Record<string, unknown> | undefined;

    if (match && typeof match.id === 'string') {
        if (match.archived_at) {
            await admin.from('customer').update({ archived_at: null }).eq('id', match.id);
            match.archived_at = null;
        }
        const wallet = await ensureAdminBookerWalletFloor(admin, match.id);
        match.wallet_amount = wallet;
        return { id: match.id, row: match };
    }

    throw new Error(
        `Admin booker customer not found. Create customer ${ADMIN_BOOKER.displayName} (phone ${ADMIN_BOOKER.phoneDigits}) first.`
    );
}
