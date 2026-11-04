/**
 * Customer app login: phone → customer.email → email/password auth.
 * Admin-created accounts must always store an email the app can resolve.
 */

export function normalizeLocalEthiopianPhone(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 9 && digits.startsWith('9')) return digits;
    if (digits.length === 10 && digits.startsWith('09')) return digits.slice(1);
    if (digits.length === 12 && digits.startsWith('251') && digits[3] === '9') return digits.slice(3);
    if (digits.length === 13 && digits.startsWith('2510') && digits[4] === '9') return digits.slice(4);
    return null;
}

/** Same pattern as ADMIN_BOOKER / organic phone-linked emails. */
export function phoneLoginEmail(local9: string): string {
    return `251${local9}@phone.zemen.app`;
}

/** Email used for auth + customer.email when admin omits a real email. */
export function resolveCustomerLoginEmail(
    providedEmail: string | null | undefined,
    phone: string
): { email: string; localPhone: string } | null {
    const localPhone = normalizeLocalEthiopianPhone(phone);
    if (!localPhone) return null;
    const trimmed = (providedEmail ?? '').trim().toLowerCase();
    return {
        localPhone,
        email: trimmed || phoneLoginEmail(localPhone),
    };
}
