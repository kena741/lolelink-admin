import { describe, expect, it } from 'vitest';
import {
    clampColumnWidthPx,
    normalizeColumnType,
    resolveColumnWidthPx,
    slugifyColumnLabel,
    stripColumnKeyFromValues,
} from '@/lib/marketing-tracker';

describe('marketing-tracker helpers', () => {
    it('slugifies column labels', () => {
        expect(slugifyColumnLabel('Follow Up Date')).toBe('follow_up_date');
        expect(slugifyColumnLabel('  ')).toBe('column');
    });

    it('normalizes column types', () => {
        expect(normalizeColumnType('yes-no')).toBe('boolean');
        expect(normalizeColumnType('date')).toBe('date');
        expect(normalizeColumnType('nope')).toBeNull();
    });

    it('strips deleted column keys from row values', () => {
        expect(stripColumnKeyFromValues({ a: 'x', b: true }, 'a')).toEqual({ b: true });
    });

    it('resolves and clamps column widths', () => {
        expect(resolveColumnWidthPx({ key: 'phone', width_px: null })).toBe(160);
        expect(resolveColumnWidthPx({ key: 'note', width_px: null })).toBe(280);
        expect(resolveColumnWidthPx({ key: 'phone', width_px: 40 })).toBe(80);
        expect(clampColumnWidthPx(900)).toBe(800);
    });
});
