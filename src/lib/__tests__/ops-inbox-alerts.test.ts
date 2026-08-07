import { describe, expect, it } from 'vitest';
import { diffNewOpsItemIds } from '@/lib/ops-inbox-alerts';

describe('ops-inbox-alerts', () => {
    it('skips alerts on first snapshot', () => {
        const result = diffNewOpsItemIds(null, ['a', 'b']);
        expect(result.newcomers).toEqual([]);
        expect([...result.nextSeen]).toEqual(['a', 'b']);
    });

    it('detects only newly arrived ids', () => {
        const first = diffNewOpsItemIds(null, ['a']);
        const second = diffNewOpsItemIds(first.nextSeen, ['a', 'b', 'c']);
        expect(second.newcomers).toEqual(['b', 'c']);
    });

    it('re-alerts when an id leaves and returns', () => {
        let seen = diffNewOpsItemIds(null, ['a', 'b']).nextSeen;
        seen = diffNewOpsItemIds(seen, ['b']).nextSeen;
        const back = diffNewOpsItemIds(seen, ['a', 'b']);
        expect(back.newcomers).toEqual(['a']);
    });
});
