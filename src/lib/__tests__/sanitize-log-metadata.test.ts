import { describe, expect, it } from 'vitest';
import { sanitizeLogMetadata } from '@/lib/sanitize-log-metadata';

describe('sanitizeLogMetadata', () => {
    it('redacts sensitive top-level keys', () => {
        const result = sanitizeLogMetadata({
            password: 'secret123',
            token: 'abc',
            secret: 'xyz',
            api_key: 'key',
            name: 'visible',
        });
        expect(result).toEqual({
            password: '[redacted]',
            token: '[redacted]',
            secret: '[redacted]',
            api_key: '[redacted]',
            name: 'visible',
        });
    });

    it('redacts nested sensitive keys', () => {
        const result = sanitizeLogMetadata({
            user: {
                email: 'a@b.com',
                newPassword: 'hidden',
            },
        });
        expect(result).toEqual({
            user: {
                email: 'a@b.com',
                newPassword: '[redacted]',
            },
        });
    });

    it('returns empty object for non-object input', () => {
        expect(sanitizeLogMetadata(null)).toEqual({});
        expect(sanitizeLogMetadata('text')).toEqual({});
        expect(sanitizeLogMetadata([])).toEqual({});
    });

    it('preserves arrays and primitives', () => {
        const result = sanitizeLogMetadata({
            ids: ['a', 'b'],
            count: 3,
            active: true,
        });
        expect(result).toEqual({
            ids: ['a', 'b'],
            count: 3,
            active: true,
        });
    });
});
