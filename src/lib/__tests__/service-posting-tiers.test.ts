import { describe, expect, it } from 'vitest';
import {
    ADMIN_UNPAID_SERVICE_TAG,
    formatServicePostingTierLabel,
    isAdminUnpaidService,
    parseServicePostingTiers,
    providerWouldExceedServiceTier,
    resolvePlanPriceForServiceTierMax,
    resolveServicePostingTierByPrice,
    stripAdminUnpaidServiceTag,
    withAdminUnpaidServiceTag,
} from '@/lib/service-posting-tiers';

describe('service-posting-tiers', () => {
    it('parses configured tiers and falls back to defaults', () => {
        expect(parseServicePostingTiers(null)).toHaveLength(4);
        expect(
            parseServicePostingTiers([
                { total_price: 99, max_services: 1 },
                { total_price: '249', max_services: 4 },
            ])
        ).toEqual([
            { total_price: 99, max_services: 1 },
            { total_price: 249, max_services: 4 },
        ]);
    });

    it('resolves tier by price', () => {
        const tiers = parseServicePostingTiers(null);
        expect(resolveServicePostingTierByPrice(tiers, 499)?.max_services).toBe(10);
        expect(resolveServicePostingTierByPrice(tiers, 999)?.max_services).toBe(-1);
        expect(resolveServicePostingTierByPrice(tiers, 0)).toBeNull();
    });

    it('maps a paid tier max to its plan price and skips an unpaid provider', () => {
        const tiers = parseServicePostingTiers(null);
        expect(resolvePlanPriceForServiceTierMax(tiers, 0)).toBeNull();
        expect(resolvePlanPriceForServiceTierMax(tiers, null)).toBeNull();
        expect(resolvePlanPriceForServiceTierMax(tiers, 1)).toBe(99);
        expect(resolvePlanPriceForServiceTierMax(tiers, 4)).toBe(249);
        expect(resolvePlanPriceForServiceTierMax(tiers, 10)).toBe(499);
        expect(resolvePlanPriceForServiceTierMax(tiers, -1)).toBe(999);
    });

    it('formats labels', () => {
        expect(formatServicePostingTierLabel({ total_price: 99, max_services: 1 })).toContain('1 service');
        expect(formatServicePostingTierLabel({ total_price: 999, max_services: -1 })).toContain('Unlimited');
    });

    it('flags next service when over paid tier', () => {
        expect(providerWouldExceedServiceTier(0, 0)).toBe(true);
        expect(providerWouldExceedServiceTier(1, 0)).toBe(false);
        expect(providerWouldExceedServiceTier(1, 1)).toBe(true);
        expect(providerWouldExceedServiceTier(-1, 99)).toBe(false);
    });

    it('tags and strips admin-unpaid service descriptions', () => {
        const tagged = withAdminUnpaidServiceTag('Deep clean');
        expect(isAdminUnpaidService(tagged)).toBe(true);
        expect(tagged).toContain(ADMIN_UNPAID_SERVICE_TAG);
        expect(stripAdminUnpaidServiceTag(tagged)).toBe('Deep clean');
    });
});
