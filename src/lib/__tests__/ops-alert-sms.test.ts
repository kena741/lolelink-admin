import { describe, expect, it } from 'vitest';
import { formatOpsAlertSms, resolveOpsAlertPhone } from '@/lib/ops-alert-sms';

describe('ops-alert-sms', () => {
    it('formats single and batch messages', () => {
        expect(formatOpsAlertSms({ title: 'Payout waiting', body: 'Amina · ETB 500' })).toBe(
            'Zemen Ops: Payout waiting — Amina · ETB 500'
        );
        expect(
            formatOpsAlertSms({ title: 'Doc review', body: 'Mikael', count: 3 })
        ).toMatch(/3 items/);
    });

    it('resolves phone from env or default', () => {
        expect(resolveOpsAlertPhone()).toMatch(/^\+?\d+/);
    });
});
