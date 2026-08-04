import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { verifyChapaWebhookSignature } from '@/lib/chapa-config';

describe('verifyChapaWebhookSignature', () => {
    it('accepts valid x-chapa-signature over payload', () => {
        const secret = 'test-webhook-secret';
        process.env.CHAPA_WEBHOOK_SECRET = secret;
        const rawBody = '{"tx_ref":"act-1","status":"success"}';
        const mac = createHmac('sha256', secret).update(rawBody).digest('hex');
        const headers = new Headers({ 'x-chapa-signature': mac });
        expect(verifyChapaWebhookSignature(rawBody, headers)).toBe(true);
    });

    it('rejects missing or wrong signature', () => {
        process.env.CHAPA_WEBHOOK_SECRET = 'test-webhook-secret';
        const rawBody = '{"tx_ref":"act-1"}';
        expect(verifyChapaWebhookSignature(rawBody, new Headers())).toBe(false);
        expect(
            verifyChapaWebhookSignature(rawBody, new Headers({ 'x-chapa-signature': 'deadbeef' }))
        ).toBe(false);
    });

    it('rejects when secret env is unset', () => {
        delete process.env.CHAPA_WEBHOOK_SECRET;
        const rawBody = '{}';
        const headers = new Headers({
            'x-chapa-signature': createHmac('sha256', 'x').update(rawBody).digest('hex'),
        });
        expect(verifyChapaWebhookSignature(rawBody, headers)).toBe(false);
    });
});
