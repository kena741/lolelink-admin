export interface PayoutPaymentMethodDetails {
    accountNumber?: string | null;
    holderName?: string | null;
    bankName?: string | null;
    bankCode?: string | null;
}

/** Same required fields Chapa transfer rejects when missing. */
export function hasUsablePayoutPaymentMethod(
    details: PayoutPaymentMethodDetails | null | undefined
): boolean {
    if (!details) return false;
    const accountNumber = (details.accountNumber ?? '').trim();
    const holderName = (details.holderName ?? '').trim();
    const bankLabel = (details.bankName ?? '').trim() || (details.bankCode ?? '').trim();
    return Boolean(accountNumber && holderName && bankLabel);
}

export function isMissingPaymentMethodPayout(
    paymentStatus: string | null | undefined,
    details: PayoutPaymentMethodDetails | null | undefined
): boolean {
    const status = (paymentStatus ?? '').trim().toLowerCase();
    if (!['pending', 'approved'].includes(status)) return false;
    return !hasUsablePayoutPaymentMethod(details);
}
