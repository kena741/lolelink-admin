export function sanitizeDisplayText(value: string | undefined, fallback: string): string {
    if (!value?.trim()) return fallback;
    const match = value.match(/[\p{L}\p{N}][\p{L}\p{N}\s.'-]*/u);
    if (match?.[0]?.trim()) {
        const trimmed = match[0].trim();
        return trimmed.length > 42 ? `${trimmed.slice(0, 39)}…` : trimmed;
    }
    return fallback;
}

export function isReadableDisplayText(value: string | undefined): boolean {
    if (!value?.trim()) return false;
    const weird = (value.match(/[^\p{L}\p{N}\s.,'@+\-/()]/gu) || []).length;
    return weird / value.length < 0.25;
}

export function maskAccountNumber(accountNumber?: string): string {
    if (!accountNumber?.trim()) return '—';
    const normalized = accountNumber.trim();
    if (normalized.length <= 4) return normalized;
    return `•••• ${normalized.slice(-4)}`;
}
