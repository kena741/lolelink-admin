import { describe, expect, it } from 'vitest';
import {
    computeAdminCommissionFee,
    parseAdminCommissionConfig,
    resolveBookingAdminCommissionAmount,
} from '@/lib/booking-admin-commission';

describe('booking-admin-commission', () => {
    it('computes percent and fixed fees', () => {
        expect(computeAdminCommissionFee(100, { value: 10, isFix: false, active: true })).toBe(10);
        expect(computeAdminCommissionFee(361.4, { value: 10, isFix: false, active: true })).toBe(36.14);
        expect(computeAdminCommissionFee(100, { value: 15, isFix: true, active: true })).toBe(15);
    });

    it('returns zero when inactive', () => {
        expect(computeAdminCommissionFee(100, { value: 10, isFix: false, active: false })).toBe(0);
    });

    it('parses app_settings shape', () => {
        expect(parseAdminCommissionConfig({ value: '10', isFix: false, active: true })).toEqual({
            value: 10,
            isFix: false,
            active: true,
        });
        expect(parseAdminCommissionConfig({ value: 5, isFix: true })).toEqual({
            value: 5,
            isFix: true,
            active: true,
        });
    });

    it('resolves display amount from settings over stale stored rate', () => {
        expect(
            resolveBookingAdminCommissionAmount(
                { totalAmount: 100, adminCommission: 10 },
                { value: 10, isFix: false, active: true }
            )
        ).toBe(10);
        expect(
            resolveBookingAdminCommissionAmount(
                { totalAmount: 200, adminCommission: null },
                { value: 10, isFix: false, active: true }
            )
        ).toBe(20);
        expect(
            resolveBookingAdminCommissionAmount({ totalAmount: 200, adminCommission: '33.5' }, null)
        ).toBe(33.5);
    });
});
