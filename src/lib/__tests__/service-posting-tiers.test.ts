import { describe, expect, it } from 'vitest';
import {
    formatServicePostingTierLabel,
    parseServicePostingTiers,
    resolveServicePostingTierByPrice,
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

    it('formats labels', () => {
        expect(formatServicePostingTierLabel({ total_price: 99, max_services: 1 })).toContain('1 service');
        expect(formatServicePostingTierLabel({ total_price: 999, max_services: -1 })).toContain('Unlimited');
    });
});
