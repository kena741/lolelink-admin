import { describe, expect, it } from 'vitest';
import { distanceKm } from '@/lib/provider-location';

describe('distanceKm', () => {
    it('returns ~0 for the same point', () => {
        expect(distanceKm(9.03, 38.74, 9.03, 38.74)).toBeLessThan(0.001);
    });

    it('orders nearer points correctly (Addis)', () => {
        const customer = { lat: 9.03, lng: 38.74 };
        const near = distanceKm(customer.lat, customer.lng, 9.035, 38.745);
        const far = distanceKm(customer.lat, customer.lng, 9.15, 38.9);
        expect(near).toBeLessThan(far);
        expect(near).toBeGreaterThan(0);
    });
});
