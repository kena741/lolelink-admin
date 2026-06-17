import { parseServiceDiscountInput } from '@/lib/service-discount';

export interface BookingAmounts {
    subTotal: number;
    totalAmount: number;
    discount?: string;
}

export function computeBookingAmounts(
    unitPrice: number,
    discountRaw: string | null | undefined,
    quantity: number
): BookingAmounts {
    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    const subTotal = unitPrice * safeQuantity;
    const discountPct = parseServiceDiscountInput(discountRaw ?? '') ?? 0;
    const totalAmount = subTotal * (1 - discountPct / 100);

    return {
        subTotal: Math.round(subTotal * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        discount: discountPct > 0 ? String(discountPct) : undefined,
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
