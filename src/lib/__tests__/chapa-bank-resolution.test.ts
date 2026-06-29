import { describe, expect, it } from 'vitest';
import {
    pickBankForAccountLength,
    resolveChapaBankForPayout,
    type ChapaBank,
} from '@/lib/chapa-bank-resolution';

const cbeBank: ChapaBank = {
    id: '96e41186-29ba-4e30-b013-2ca36d7e7025',
    swift: 'CBETETAA',
    name: 'Commercial Bank of Ethiopia (CBE)',
    acct_length: 13,
    currency: 'ETB',
    active: 1,
};

const telebirrBank: ChapaBank = {
    id: 'telebirr-id',
    swift: 'TELEBIRR',
    name: 'telebirr',
    acct_length: 10,
    currency: 'ETB',
    active: 1,
    is_mobilemoney: 1,
};

const dashenBank: ChapaBank = {
    id: 'dashen-id',
    swift: 'DASHETAA',
    name: 'Dashen Bank',
    acct_length: 13,
    currency: 'ETB',
    active: 1,
};

const etbBanks = [cbeBank, telebirrBank, dashenBank];

describe('resolveChapaBankForPayout', () => {
    it('keeps telebirr when account has 10 digits', () => {
        const resolved = resolveChapaBankForPayout(etbBanks, {
            storedBankCode: '',
            swiftCode: 'TELEBIRR',
            bankName: 'telebirr',
            accountNumber: '0912345678',
        });

        expect(resolved.bank.id).toBe('telebirr-id');
        expect(resolved.correctedFrom).toBeNull();
    });

    it('auto-corrects telebirr to CBE for 13-digit accounts', () => {
        const resolved = resolveChapaBankForPayout(etbBanks, {
            storedBankCode: '',
            swiftCode: 'TELEBIRR',
            bankName: 'telebirr',
            accountNumber: '1000123456789',
        });

        expect(resolved.bank.id).toBe(cbeBank.id);
        expect(resolved.correctedFrom).toBe('telebirr');
        expect(resolved.bankName).toBe('Commercial Bank of Ethiopia (CBE)');
    });

    it('prefers CBE over Dashen when payment method says telebirr but account is 13 digits', () => {
        const picked = pickBankForAccountLength(etbBanks, 13, 'telebirr', telebirrBank);
        expect(picked?.id).toBe(cbeBank.id);
    });
});
