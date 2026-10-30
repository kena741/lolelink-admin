import { sendSmsUpstream } from '@/lib/broadcast-notify';

export function buildRecipient(phone?: string | null, countryCode?: string | null): string {
    let p = (phone ?? '').toString().trim();
    const cc = (countryCode ?? '').toString().trim();
    if (!p) return '';
    p = p.replace(/\s+/g, '');
    if (p.startsWith('+')) return p;
    if (cc) {
        let ccClean = cc.replace(/\s+/g, '');
        if (!ccClean.startsWith('+')) ccClean = `+${ccClean}`;
        return `${ccClean}${p}`;
    }
    return p;
}

export async function sendSms(
    recipient: string,
    message: string
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
    if (!recipient) return { success: false, error: 'No recipient provided' };

    // Browser → same-origin admin proxy (shared upstream + SMS_API_KEY).
    if (typeof window !== 'undefined') {
        try {
            const res = await fetch('/api/sms/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient, message, callback: '' }),
            });
            if (res.ok) {
                try {
                    const data = await res.json();
                    return { success: true, data };
                } catch {
                    return { success: true };
                }
            }
            const payload = (await res.json().catch(() => null)) as { error?: string } | null;
            return {
                success: false,
                error: payload?.error || `SMS send failed: ${res.status}`,
            };
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'SMS send failed';
            return { success: false, error: msg };
        }
    }

    const result = await sendSmsUpstream(recipient, message);
    return result.ok
        ? { success: true }
        : { success: false, error: result.error };
}
