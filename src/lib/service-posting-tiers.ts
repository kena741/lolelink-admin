export interface ServicePostingTier {
    total_price: number;
    max_services: number;
}

export const DEFAULT_SERVICE_POSTING_TIERS: ServicePostingTier[] = [
    { total_price: 99, max_services: 1 },
    { total_price: 249, max_services: 4 },
    { total_price: 499, max_services: 10 },
    { total_price: 999, max_services: -1 },
];

function parseAmount(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

export function parseServicePostingTiers(data: unknown): ServicePostingTier[] {
    if (!Array.isArray(data)) return [...DEFAULT_SERVICE_POSTING_TIERS];

    const tiers: ServicePostingTier[] = [];
    for (const row of data) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
        const record = row as Record<string, unknown>;
        const total_price = parseAmount(record.total_price);
        const max_services = parseAmount(record.max_services);
        if (total_price === null || total_price <= 0 || max_services === null) continue;
        tiers.push({
            total_price: Math.round(total_price * 100) / 100,
            max_services: Math.trunc(max_services),
        });
    }

    return tiers.length > 0 ? tiers : [...DEFAULT_SERVICE_POSTING_TIERS];
}

export function resolveServicePostingTierByPrice(
    tiers: ServicePostingTier[],
    price: number
): ServicePostingTier | null {
    if (!(price > 0)) return null;
    const exact = tiers.find((tier) => Math.abs(tier.total_price - price) < 0.01);
    if (exact) return exact;

    // Chapa settlement can be slightly under list price — pick nearest at/under paid amount.
    const eligible = tiers
        .filter((tier) => tier.total_price <= price + 0.01)
        .sort((a, b) => b.total_price - a.total_price);
    return eligible[0] ?? null;
}

export function formatServicePostingTierLabel(tier: ServicePostingTier): string {
    const services =
        tier.max_services < 0
            ? 'Unlimited services'
            : tier.max_services === 1
                ? '1 service'
                : `Up to ${tier.max_services} services`;
    return `ETB ${tier.total_price.toLocaleString('en-US')} · ${services}`;
}
