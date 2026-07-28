import { describe, expect, it } from 'vitest';
import { formatDisplayPhone } from '@/lib/phone-display';

describe('formatDisplayPhone', () => {
    it('strips ethiopian dial code', () => {
        expect(formatDisplayPhone('+251 0927429720')).toBe('0927429720');
        expect(formatDisplayPhone('+2510927429720')).toBe('0927429720');
        expect(formatDisplayPhone('251 927429720')).toBe('927429720');
        expect(formatDisplayPhone('0927429720')).toBe('0927429720');
    });

    it('handles empty', () => {
        expect(formatDisplayPhone('')).toBe('');
        expect(formatDisplayPhone(null)).toBe('');
    });
});
