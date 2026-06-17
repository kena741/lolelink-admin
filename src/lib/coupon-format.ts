export interface CouponDisplayInput {
    code?: string | null;
    title?: string | null;
    amount?: number | null;
    isFix?: boolean | null;
    minAmount?: number | null;
}

export function formatCouponDiscountLabel(coupon: CouponDisplayInput): string {
    const amount = Number(coupon.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return 'No discount';

    if (coupon.isFix) {
        return `ETB ${amount.toFixed(2)} off`;
    }

    return `${amount}% off`;
}

export function formatCouponSelectLabel(coupon: CouponDisplayInput): string {
    const code = (coupon.code ?? '').trim() || (coupon.title ?? '').trim() || 'Coupon';
    return `${code} · ${formatCouponDiscountLabel(coupon)}`;
}

export function formatCouponSelectDescription(coupon: CouponDisplayInput): string | undefined {
    const minAmount = Number(coupon.minAmount ?? 0);
    const parts: string[] = [];

    if ((coupon.title ?? '').trim() && (coupon.code ?? '').trim()) {
        parts.push(coupon.title?.trim() ?? '');
    }

    parts.push(coupon.isFix ? 'Fixed amount' : 'Percentage');

    if (Number.isFinite(minAmount) && minAmount > 0) {
        parts.push(`Min order ETB ${minAmount.toFixed(2)}`);
    }

    return parts.filter(Boolean).join(' · ') || undefined;
}
