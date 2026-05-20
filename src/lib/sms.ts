const SMS_UPSTREAM = 'https://betegna-ai.vercel.app/sms/send';

function getSmsEndpoint(): string {
    if (typeof window !== 'undefined') return '/api/sms/send';
    return SMS_UPSTREAM;
}

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

    try {
        const res = await fetch(getSmsEndpoint(), {
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

        return { success: false, error: `SMS send failed: ${res.status}` };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'SMS send failed';
        return { success: false, error: msg };
    }
}
