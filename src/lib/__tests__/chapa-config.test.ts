import { describe, expect, it } from 'vitest';
import {
    CHAPA_DOMESTIC_FEE_RATE,
    resolveChapaWalletCreditAmount,
} from '../chapa-config';

describe('resolveChapaWalletCreditAmount', () => {
    it('uses API charge when provided', () => {
        expect(
            resolveChapaWalletCreditAmount({ amount: 512.5, charge: 12.5 }, '0')
        ).toBe('500.00');
    });

    it('infers net from current 2.5% domestic fee markup', () => {
        expect(
            resolveChapaWalletCreditAmount({ amount: 512.5 }, '0')
        ).toBe('500.00');
    });

    it('falls back to legacy 3.5% markup for older payments', () => {
        expect(
            resolveChapaWalletCreditAmount({ amount: 517.5 }, '0')
        ).toBe('500.00');
    });
});

describe('CHAPA_DOMESTIC_FEE_RATE', () => {
    it('matches Chapa published domestic pricing', () => {
        expect(CHAPA_DOMESTIC_FEE_RATE).toBe(0.025);
    });
});
