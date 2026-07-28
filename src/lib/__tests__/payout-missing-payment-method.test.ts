import { describe, expect, it } from 'vitest';
import {
    hasUsablePayoutPaymentMethod,
    isMissingPaymentMethodPayout,
} from '@/lib/payout-missing-payment-method';

describe('payout-missing-payment-method', () => {
    it('requires account, holder, and bank label', () => {
        expect(hasUsablePayoutPaymentMethod(null)).toBe(false);
        expect(hasUsablePayoutPaymentMethod({})).toBe(false);
        expect(
            hasUsablePayoutPaymentMethod({
                accountNumber: '0912345678',
                holderName: 'Ada',
                bankName: 'CBE',
            })
        ).toBe(true);
        expect(
            hasUsablePayoutPaymentMethod({
                accountNumber: '0912345678',
                holderName: 'Ada',
                bankCode: '946',
            })
        ).toBe(true);
    });

    it('only flags pending/approved without usable method', () => {
        expect(isMissingPaymentMethodPayout('pending', null)).toBe(true);
        expect(isMissingPaymentMethodPayout('approved', {})).toBe(true);
        expect(
            isMissingPaymentMethodPayout('completed', null)
        ).toBe(false);
        expect(
            isMissingPaymentMethodPayout('pending', {
                accountNumber: '0912345678',
                holderName: 'Ada',
                bankName: 'CBE',
            })
        ).toBe(false);
    });
});
