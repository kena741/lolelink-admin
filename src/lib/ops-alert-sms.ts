import { sendSmsUpstream } from '@/lib/broadcast-notify';

// ponytail: single personal ops phone; override with OPS_ALERT_SMS_TO if the number changes
const DEFAULT_OPS_ALERT_PHONE = '+251941024355';

export function resolveOpsAlertPhone(): string {
    const fromEnv = (process.env.OPS_ALERT_SMS_TO ?? '').trim();
    return fromEnv || DEFAULT_OPS_ALERT_PHONE;
}

export function isOpsAlertSmsEnabled(): boolean {
    const flag = (process.env.OPS_ALERT_SMS_ENABLED ?? '1').trim().toLowerCase();
    return flag !== '0' && flag !== 'false' && flag !== 'off';
}

export function formatOpsAlertSms(input: {
    title: string;
    body?: string;
    count?: number;
}): string {
    const title = input.title.trim() || 'Ops alert';
    const body = (input.body ?? '').trim();
    if (input.count && input.count > 1) {
        return `Zemen Ops: ${input.count} items need attention. First: ${title}${body ? ` — ${body}` : ''}`;
    }
    return body ? `Zemen Ops: ${title} — ${body}` : `Zemen Ops: ${title}`;
}

export async function sendOpsAlertSms(
    message: string
): Promise<{ ok: true } | { ok: false; error: string } | { ok: true; skipped: string }> {
    if (!isOpsAlertSmsEnabled()) {
        return { ok: true, skipped: 'disabled' };
    }
    const recipient = resolveOpsAlertPhone();
    if (!recipient) {
        return { ok: false, error: 'OPS_ALERT_SMS_TO is empty' };
    }
    // SMS providers often cap around 160–480 chars; keep readable.
    const trimmed = message.replace(/\s+/g, ' ').trim().slice(0, 400);
    if (!trimmed) return { ok: false, error: 'message is empty' };

    const result = await sendSmsUpstream(recipient, trimmed);
    if ('error' in result && !result.ok) {
        return { ok: false, error: result.error };
    }
    return { ok: true };
}
