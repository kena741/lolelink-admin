const SMS_UPSTREAM = 'https://betegna-ai.vercel.app/sms/send';

export type BroadcastChannel = 'push' | 'sms' | 'both';

export interface BroadcastChannelCounts {
    attempted: number;
    sent: number;
    skipped: number;
    failed: number;
}

export function emptyBroadcastCounts(): BroadcastChannelCounts {
    return { attempted: 0, sent: 0, skipped: 0, failed: 0 };
}

export function parseBroadcastChannel(value: unknown): BroadcastChannel | null {
    if (value === 'push' || value === 'sms' || value === 'both') return value;
    if (value == null || value === '') return 'push';
    return null;
}

export function wantsPush(channel: BroadcastChannel): boolean {
    return channel === 'push' || channel === 'both';
}

export function wantsSms(channel: BroadcastChannel): boolean {
    return channel === 'sms' || channel === 'both';
}

export function formatBroadcastSmsMessage(title: string, body: string): string {
    const t = title.trim();
    const b = body.trim();
    if (t && b) return `${t}\n${b}`;
    return t || b;
}

export function resolveBroadcastPhone(row: Record<string, unknown>): string {
    const phoneCandidates = [row.phoneNumber, row.phone, row.mobile_number, row.mobileNumber];
    let phone = '';
    for (const value of phoneCandidates) {
        if (typeof value === 'string' && value.trim()) {
            phone = value.trim();
            break;
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
            phone = String(value).trim();
            break;
        }
    }
    if (!phone) return '';

    const codeRaw = row.countryCode ?? row.country_code;
    const code =
        typeof codeRaw === 'string'
            ? codeRaw.trim()
            : typeof codeRaw === 'number' && Number.isFinite(codeRaw)
              ? String(codeRaw).trim()
              : '';
    const cleanedPhone = phone.replace(/\s+/g, '');
    if (cleanedPhone.startsWith('+')) return cleanedPhone;

    const digitsOnly = cleanedPhone.replace(/\D+/g, '');
    const localEthiopian = /^(?:0?9\d{8})$/.test(digitsOnly);
    if (!code) {
        if (localEthiopian) {
            const local = digitsOnly.length === 10 ? digitsOnly.slice(1) : digitsOnly;
            return `+251${local}`;
        }
        if (/^\d{11,15}$/.test(digitsOnly)) return `+${digitsOnly}`;
        return cleanedPhone;
    }
    const cleanedCode = code.replace(/\s+/g, '');
    const withPlus = cleanedCode.startsWith('+') ? cleanedCode : `+${cleanedCode}`;
    const localPart = digitsOnly.startsWith('0') ? digitsOnly.slice(1) : digitsOnly;
    return `${withPlus}${localPart || cleanedPhone}`;
}

export async function sendSmsUpstream(
    recipient: string,
    message: string
): Promise<{ ok: true } | { ok: false; error: string }> {
    const trimmedRecipient = recipient.trim();
    const trimmedMessage = message.trim();
    if (!trimmedRecipient || !trimmedMessage) {
        return { ok: false, error: 'recipient and message are required' };
    }

    try {
        const upstream = await fetch(SMS_UPSTREAM, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                recipient: trimmedRecipient,
                message: trimmedMessage,
                callback: '',
            }),
        });
        if (!upstream.ok) {
            return { ok: false, error: `SMS upstream failed: ${upstream.status}` };
        }
        return { ok: true };
    } catch (error: unknown) {
        const messageText = error instanceof Error ? error.message : 'SMS send failed';
        return { ok: false, error: messageText };
    }
}
