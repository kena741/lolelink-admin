/** Display-only Ethiopian phone — drop +251 dial code. */
export function formatDisplayPhone(phone?: string | null): string {
    const raw = (phone ?? '').trim();
    if (!raw) return '';
    return raw.replace(/^\+?251[\s-]*/i, '').trim() || raw;
}
