import { parseServiceDiscountInput } from '@/lib/service-discount';

export interface CouponPricingInput {
    amount?: number | null;
    minAmount?: number | null;
    isFix?: boolean | null;
    active?: boolean | null;
    expiredAt?: string | null;
}

export interface BookingAmounts {
    subTotal: number;
    serviceDiscountAmount: number;
    afterServiceDiscount: number;
    totalAmount: number;
    discount?: string;
    couponAmount: number;
}

function resolveCouponAmount(
    afterDiscount: number,
    coupon?: CouponPricingInput | null
): number {
    if (!coupon || coupon.active === false) return 0;
    if (coupon.expiredAt) {
        const expires = new Date(coupon.expiredAt);
        if (!Number.isNaN(expires.getTime()) && expires.getTime() < Date.now()) return 0;
    }

    const minAmount = Number(coupon.minAmount ?? 0);
    if (afterDiscount < minAmount) return 0;

    const rawAmount = Number(coupon.amount ?? 0);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) return 0;

    if (coupon.isFix) {
        return Math.min(rawAmount, afterDiscount);
    }

    return Math.min((afterDiscount * rawAmount) / 100, afterDiscount);
}

export function computeBookingAmounts(
    unitPrice: number,
    discountRaw: string | null | undefined,
    quantity: number,
    coupon?: CouponPricingInput | null
): BookingAmounts {
    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    const subTotal = unitPrice * safeQuantity;
    const discountPct = parseServiceDiscountInput(discountRaw ?? '') ?? 0;
    const afterDiscount = subTotal * (1 - discountPct / 100);
    const couponAmount = resolveCouponAmount(afterDiscount, coupon);
    const totalAmount = Math.max(0, afterDiscount - couponAmount);
    const serviceDiscountAmount = subTotal - afterDiscount;

    return {
        subTotal: Math.round(subTotal * 100) / 100,
        serviceDiscountAmount: Math.round(serviceDiscountAmount * 100) / 100,
        afterServiceDiscount: Math.round(afterDiscount * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        discount: discountPct > 0 ? String(discountPct) : undefined,
        couponAmount: Math.round(couponAmount * 100) / 100,
    };
}

export function resolveServiceUnitPrice(raw: unknown): number {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
        const parsed = parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

export function resolveServiceImage(row: Record<string, unknown>): string | undefined {
    const candidates: unknown[] = [
        row.serviceImage,
        row.image,
        row.image_url,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
        if (Array.isArray(candidate) && typeof candidate[0] === 'string' && candidate[0].trim()) {
            return candidate[0].trim();
        }
    }

    const arrayFields = [row.images, row.image_urls, row.serviceImages, row.gallery];
    for (const field of arrayFields) {
        if (Array.isArray(field) && typeof field[0] === 'string' && field[0].trim()) {
            return field[0].trim();
        }
    }

    return undefined;
}

export function resolveServiceName(row: Record<string, unknown>): string {
    if (typeof row.serviceName === 'string' && row.serviceName.trim()) return row.serviceName.trim();
    if (typeof row.name === 'string' && row.name.trim()) return row.name.trim();
    return '';
}
