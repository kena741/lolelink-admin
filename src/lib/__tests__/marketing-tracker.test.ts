import { describe, expect, it } from 'vitest';
import {
    clampColumnWidthPx,
    normalizeColumnType,
    resolveColumnWidthPx,
    slugifyColumnLabel,
    stripColumnKeyFromValues,
    computeSheetAnalytics,
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

    it('computes per-sheet analytics including assignee performance', () => {
        const analytics = computeSheetAnalytics([
            {
                id: '1',
                sheet_id: 's1',
                position: 1,
                values: { assignee: 'Hana', contacted: true, onboarded: false, are_trainers: true },
                created_at: '',
                updated_at: '',
            },
            {
                id: '2',
                sheet_id: 's1',
                position: 2,
                values: { assignee: 'Hana', contacted: true, onboarded: true },
                created_at: '',
                updated_at: '',
            },
            {
                id: '3',
                sheet_id: 's1',
                position: 3,
                values: { contacted: false },
                created_at: '',
                updated_at: '',
            },
        ]);

        expect(analytics.total).toBe(3);
        expect(analytics.contacted).toBe(2);
        expect(analytics.onboarded).toBe(1);
        expect(analytics.trainers).toBe(1);
        expect(analytics.unassigned).toBe(1);
        expect(analytics.contactRate).toBe(67);
        expect(analytics.assignees[0]).toMatchObject({
            assignee: 'Hana',
            leads: 2,
            contacted: 2,
            onboarded: 1,
            contactRate: 100,
            onboardRate: 50,
        });
    });
});
