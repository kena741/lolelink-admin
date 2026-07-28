import { describe, expect, it } from 'vitest';
import {
    formatBroadcastSmsMessage,
    parseBroadcastChannel,
    resolveBroadcastPhone,
    wantsPush,
    wantsSms,
} from '@/lib/broadcast-notify';

describe('broadcast-notify', () => {
    it('parses channels', () => {
        expect(parseBroadcastChannel(undefined)).toBe('push');
        expect(parseBroadcastChannel('sms')).toBe('sms');
        expect(parseBroadcastChannel('both')).toBe('both');
        expect(parseBroadcastChannel('email')).toBeNull();
        expect(wantsPush('both')).toBe(true);
        expect(wantsSms('push')).toBe(false);
    });

    it('formats sms and phone', () => {
        expect(formatBroadcastSmsMessage('Hello', 'World')).toBe('Hello\nWorld');
        expect(resolveBroadcastPhone({ phoneNumber: '911', countryCode: '251' })).toBe('+251911');
        expect(resolveBroadcastPhone({ phone: '+251911' })).toBe('+251911');
    });
});
