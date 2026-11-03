import { describe, expect, it } from 'vitest';
import {
    buildProviderDistributionReport,
    nearestPlaceName,
    percentile,
    placeNameFromAddress,
    priceBucketLabel,
    resolvePlaceName,
} from '@/lib/provider-distribution';

describe('provider-distribution', () => {
    it('buckets list prices', () => {
        expect(priceBucketLabel(0)).toBe('<200');
        expect(priceBucketLabel(199.99)).toBe('<200');
        expect(priceBucketLabel(200)).toBe('200–500');
        expect(priceBucketLabel(999)).toBe('500–1000');
        expect(priceBucketLabel(1000)).toBe('1000–2500');
        expect(priceBucketLabel(2500)).toBe('2500+');
    });

    it('resolves human place names from address and GPS', () => {
        expect(placeNameFromAddress('XQXP+JR3, Addis Ababa, Ethiopia')).toBe('Addis Ababa');
        expect(placeNameFromAddress('H776+J7V, Adama, Ethiopia')).toBe('Adama');
        expect(placeNameFromAddress('Bole Road, Addis Ababa')).toMatch(/Bole/i);
        expect(resolvePlaceName(null, '4JFM+7GR, Dese, Ethiopia')).toBe('Dessie');
        expect(resolvePlaceName({ latitude: 8.54, longitude: 39.27 }, 'Adama')).toBe('Adama');
        expect(nearestPlaceName(9.02, 38.80)).toMatch(/Addis|Megenagna|CMC|Bole/i);
        expect(resolvePlaceName(null, '')).toBe('Unknown');
    });

    it('computes percentiles', () => {
        expect(percentile([], 50)).toBeNull();
        expect(percentile([10], 50)).toBe(10);
        expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
        expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1);
        expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5);
    });

    it('builds a report with separate with-services location slice', () => {
        const report = buildProviderDistributionReport({
            now: new Date('2026-11-02T00:00:00.000Z'),
            providers: [
                {
                    id: 'p1',
                    name: 'A',
                    address: 'Bole, Addis Ababa, Ethiopia',
                    location: { latitude: 8.98, longitude: 38.80 },
                    activation_paid: true,
                    service_tier_max: 1,
                    active: true,
                },
                {
                    id: 'p2',
                    name: 'B',
                    address: 'Adama, Ethiopia',
                    activation_paid: false,
                    service_tier_max: 0,
                    active: false,
                },
            ],
            services: [
                {
                    id: 's1',
                    provider_id: 'p1',
                    price: 300,
                    categoryName: 'Cleaning',
                    active: true,
                    archived: false,
                    description: 'ok',
                },
                {
                    id: 's2',
                    provider_id: 'p1',
                    price: 400,
                    categoryName: 'Cleaning',
                    active: true,
                    archived: false,
                    description: '[Admin unpaid] added by admin without provider paying — x',
                },
            ],
            bookings: [
                {
                    id: 'b1',
                    provider_id: 'p1',
                    status: 'completed',
                    amount: 300,
                    createdAt: '2026-10-01T00:00:00.000Z',
                    categoryName: 'Cleaning',
                },
            ],
        });

        expect(report.snapshot.totalProviders).toBe(2);
        expect(report.location.all.providerCount).toBe(2);
        expect(report.location.withServices.providerCount).toBe(1);
        expect(report.location.withServices.topAreas[0]?.key).toMatch(/Bole|Addis/i);
        expect(report.bookingRevenue.byArea[0]?.key).toMatch(/Bole|Addis/i);
        expect(report.tiers.adminUnpaidServices).toBe(1);
        expect(report.tiers.overTierProviders).toBe(1);
    });
});
