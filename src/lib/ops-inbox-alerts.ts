export interface OpsDeskAlertPrefs {
    sound: boolean;
    desktop: boolean;
    sms: boolean;
}

export const OPS_DESK_ALERTS_KEY = 'ops-inbox-desk-alerts';

const DEFAULT_PREFS: OpsDeskAlertPrefs = {
    sound: false,
    desktop: false,
    sms: false,
};

export function loadOpsDeskAlertPrefs(): OpsDeskAlertPrefs {
    if (typeof window === 'undefined') return { ...DEFAULT_PREFS };
    try {
        const raw = window.localStorage.getItem(OPS_DESK_ALERTS_KEY);
        if (!raw) return { ...DEFAULT_PREFS };
        const parsed = JSON.parse(raw) as Partial<OpsDeskAlertPrefs>;
        return {
            sound: Boolean(parsed.sound),
            desktop: Boolean(parsed.desktop),
            // ponytail: SMS toggle hidden — never auto-SMS ops desk
            sms: false,
        };
    } catch {
        return { ...DEFAULT_PREFS };
    }
}

export function saveOpsDeskAlertPrefs(prefs: OpsDeskAlertPrefs): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(OPS_DESK_ALERTS_KEY, JSON.stringify(prefs));
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
}

export async function requestOpsDesktopPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try {
        return await Notification.requestPermission();
    } catch {
        return Notification.permission;
    }
}

let audioContext: AudioContext | null = null;
let lastSoundAt = 0;

function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!audioContext) audioContext = new Ctx();
    return audioContext;
}

/** Call from a user gesture so later alerts can play under browser autoplay rules. */
export function unlockOpsAlertAudio(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
        void ctx.resume();
    }
}

function tone(
    ctx: AudioContext,
    frequency: number,
    startAt: number,
    duration: number,
    gainValue: number
): void {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
}

export function playOpsInboxSound(options?: { urgent?: boolean }): void {
    const now = Date.now();
    // ponytail: debounce bursty realtime refetch storms
    if (now - lastSoundAt < 1200) return;
    lastSoundAt = now;

    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
        void ctx.resume().then(() => playOpsInboxSound(options));
        return;
    }

    const t0 = ctx.currentTime + 0.01;
    if (options?.urgent) {
        tone(ctx, 880, t0, 0.09, 0.08);
        tone(ctx, 1175, t0 + 0.11, 0.12, 0.07);
        return;
    }
    tone(ctx, 740, t0, 0.1, 0.06);
    tone(ctx, 990, t0 + 0.12, 0.11, 0.055);
}

export interface OpsDesktopNotifyInput {
    title: string;
    body: string;
    href: string;
    tag?: string;
}

export function showOpsDesktopNotification(input: OpsDesktopNotifyInput): boolean {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
    if (Notification.permission !== 'granted') return false;

    try {
        const notification = new Notification(input.title, {
            body: input.body,
            tag: input.tag ?? 'ops-inbox',
            icon: '/logo.png',
            badge: '/logo.png',
            silent: false,
        });
        notification.onclick = () => {
            window.focus();
            if (input.href) {
                window.location.assign(input.href);
            }
            notification.close();
        };
        return true;
    } catch {
        return false;
    }
}

export async function requestOpsAlertSms(input: {
    title: string;
    body?: string;
    count?: number;
}): Promise<void> {
    try {
        await fetch('/api/admin/ops-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
    } catch (error) {
        console.error('Ops SMS alert failed:', error);
    }
}

export function diffNewOpsItemIds(
    previousIds: Set<string> | null,
    currentIds: string[]
): { nextSeen: Set<string>; newcomers: string[] } {
    const nextSeen = new Set(currentIds);
    if (previousIds === null) {
        return { nextSeen, newcomers: [] };
    }
    const newcomers = currentIds.filter((id) => !previousIds.has(id));
    return { nextSeen, newcomers };
}
