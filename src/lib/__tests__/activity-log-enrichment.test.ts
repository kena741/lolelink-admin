import { describe, expect, it } from 'vitest';
import {
    buildActivityDisplaySummary,
    resolveActivityResourceLabel,
} from '@/lib/activity-log-enrichment';

describe('resolveActivityResourceLabel', () => {
    it('uses firstName + lastName and ignores duplicate userName', () => {
        expect(
            resolveActivityResourceLabel({
                firstName: 'Yabssera',
                lastName: 'Tadesse',
                userName: 'Yabssera Tadesse',
            })
        ).toBe('Yabssera Tadesse');
    });

    it('falls back to userName when first/last are missing', () => {
        expect(resolveActivityResourceLabel({ userName: 'solo_provider' })).toBe('solo_provider');
    });
});

describe('buildActivityDisplaySummary', () => {
    it('keeps summary as-is when name is already present and no metadata', () => {
        expect(
            buildActivityDisplaySummary(
                'Updated provider Yabssera Tadesse',
                'uuid',
                'Yabssera Tadesse'
            )
        ).toBe('Updated provider Yabssera Tadesse');
    });

    it('does not append resource name (resource column already shows it)', () => {
        expect(buildActivityDisplaySummary('Updated provider', 'uuid', 'Yabssera Tadesse')).toBe(
            'Updated provider'
        );
    });

    it('uses change-only text from metadata', () => {
        expect(
            buildActivityDisplaySummary(
                'Updated provider Nardos Ketsela',
                'uuid',
                'Nardos Ketsela',
                {
                    changes: [{ field: 'admin_note', before: null, after: 'Interested' }],
                }
            )
        ).toBe('admin note: Interested');
    });
});
