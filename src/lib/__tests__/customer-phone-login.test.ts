import { describe, expect, it } from 'vitest';
import {
    normalizeLocalEthiopianPhone,
    phoneLoginEmail,
    resolveCustomerLoginEmail,
} from '@/lib/customer-phone-login';

describe('customer-phone-login', () => {
    it('normalizes Ethiopian phone variants to 9 local digits', () => {
        expect(normalizeLocalEthiopianPhone('911121836')).toBe('911121836');
        expect(normalizeLocalEthiopianPhone('0911121836')).toBe('911121836');
        expect(normalizeLocalEthiopianPhone('+251911121836')).toBe('911121836');
        expect(normalizeLocalEthiopianPhone('251911121836')).toBe('911121836');
        expect(normalizeLocalEthiopianPhone('123')).toBeNull();
    });

    it('builds phone.zemen.app login email (mobile phone lookup needs this)', () => {
        expect(phoneLoginEmail('911121836')).toBe('251911121836@phone.zemen.app');
    });

    it('always resolves an email for admin create without provided email', () => {
        expect(resolveCustomerLoginEmail(undefined, '911121836')).toEqual({
            localPhone: '911121836',
            email: '251911121836@phone.zemen.app',
        });
        expect(resolveCustomerLoginEmail('  user@example.com ', '0911121836')).toEqual({
            localPhone: '911121836',
            email: 'user@example.com',
        });
    });
});
