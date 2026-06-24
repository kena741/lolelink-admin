import { describe, expect, it } from 'vitest';
import {
    buildChangeMetadata,
    buildFieldChanges,
    buildUpdateSummary,
    changeItemsHaveBeforeValues,
    extractActivityDetails,
    formatActivityValue,
    hasActivityDetails,
} from '@/lib/activity-log-changes';

describe('formatActivityValue', () => {
    it('formats empty values as em dash', () => {
        expect(formatActivityValue(null)).toBe('—');
        expect(formatActivityValue(undefined)).toBe('—');
        expect(formatActivityValue('')).toBe('—');
    });

    it('formats hidden and changed placeholders', () => {
        expect(formatActivityValue('[hidden]')).toBe('Hidden');
        expect(formatActivityValue('[changed]')).toBe('Changed');
        expect(formatActivityValue('[reset]')).toBe('Changed');
    });

    it('formats booleans and numbers', () => {
        expect(formatActivityValue(true)).toBe('Yes');
        expect(formatActivityValue(false)).toBe('No');
        expect(formatActivityValue(42)).toBe('42');
    });

    it('formats string arrays and mixed arrays', () => {
        expect(formatActivityValue(['a', 'b'])).toBe('a, b');
        expect(formatActivityValue([])).toBe('[]');
        expect(formatActivityValue([1, 2])).toBe('[1,2]');
    });
});

describe('buildFieldChanges', () => {
    it('detects changed fields', () => {
        const changes = buildFieldChanges(
            { name: 'Old', active: true },
            { name: 'New', active: true },
            ['name', 'active']
        );
        expect(changes).toEqual([{ field: 'name', before: 'Old', after: 'New' }]);
    });

    it('ignores timestamp fields', () => {
        const changes = buildFieldChanges(
            { updated_at: '2024-01-01', name: 'A' },
            { updated_at: '2024-06-01', name: 'A' },
            ['updated_at', 'created_at', 'createdAt', 'name']
        );
        expect(changes).toEqual([]);
    });

    it('detects nested object changes via JSON equality', () => {
        const changes = buildFieldChanges(
            { config: { a: 1 } },
            { config: { a: 2 } },
            ['config']
        );
        expect(changes).toHaveLength(1);
        expect(changes[0].field).toBe('config');
    });

    it('supports password-style hidden values', () => {
        const changes = buildFieldChanges(
            { password: '[hidden]' },
            { password: '[changed]' },
            ['password']
        );
        expect(changes[0]).toEqual({
            field: 'password',
            before: '[hidden]',
            after: '[changed]',
        });
    });
});

describe('buildChangeMetadata', () => {
    it('returns empty object when nothing changed', () => {
        expect(buildChangeMetadata({ a: 1 }, { a: 1 }, ['a'])).toEqual({});
    });

    it('wraps changes array when fields differ', () => {
        expect(buildChangeMetadata({ a: 1 }, { a: 2 }, ['a'])).toEqual({
            changes: [{ field: 'a', before: 1, after: 2 }],
        });
    });
});

describe('buildUpdateSummary', () => {
    it('appends changed field names', () => {
        const summary = buildUpdateSummary('Updated category', [
            { field: 'categoryName', before: 'A', after: 'B' },
            { field: 'active', before: true, after: false },
        ]);
        expect(summary).toBe('Updated category (categoryName, active)');
    });

    it('returns base summary when no changes', () => {
        expect(buildUpdateSummary('Updated category', [])).toBe('Updated category');
    });
});

describe('extractActivityDetails', () => {
    it('parses modern changes metadata', () => {
        const items = extractActivityDetails({
            changes: [
                { field: 'name', before: 'Old', after: 'New' },
            ],
        });
        expect(items).toEqual([
            { kind: 'change', field: 'name', label: undefined, before: 'Old', after: 'New' },
        ]);
    });

    it('parses legacy flat metadata as info items', () => {
        const items = extractActivityDetails({
            role: 'editor',
            full_name: 'Jane Doe',
        });
        expect(items).toEqual([
            { kind: 'info', field: 'role', value: 'editor' },
            { kind: 'info', field: 'full_name', value: 'Jane Doe' },
        ]);
    });

    it('expands password_reset flag', () => {
        const items = extractActivityDetails({ password_reset: true });
        expect(items).toContainEqual({ kind: 'info', field: 'password', value: 'Reset' });
    });
});

describe('changeItemsHaveBeforeValues', () => {
    it('returns true when change items include before values', () => {
        expect(
            changeItemsHaveBeforeValues([
                { kind: 'change', field: 'name', before: 'Old', after: 'New' },
            ])
        ).toBe(true);
    });

    it('returns false for legacy info-only items', () => {
        expect(
            changeItemsHaveBeforeValues([
                { kind: 'info', field: 'role', value: 'editor' },
            ])
        ).toBe(false);
    });
});

describe('hasActivityDetails', () => {
    it('returns false for empty metadata', () => {
        expect(hasActivityDetails(null)).toBe(false);
        expect(hasActivityDetails({})).toBe(false);
    });

    it('returns true when details exist', () => {
        expect(hasActivityDetails({ changes: [{ field: 'x', before: 1, after: 2 }] })).toBe(true);
    });
});
