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

import type { AdminStatusTone } from '@/lib/admin-status-badge';

export function getPayoutStatusLabel(
    paymentStatus: string,
    hasChapaTransferStarted: boolean
): { label: string; tone: AdminStatusTone } {
    const normalized = paymentStatus.trim().toLowerCase();
    if (normalized === 'approved' && hasChapaTransferStarted) {
        return { label: 'Awaiting transfer', tone: 'pending' };
    }
    if (normalized === 'pending') return { label: 'Pending', tone: 'pending' };
    if (normalized === 'approved') return { label: 'Approved', tone: 'info' };
    if (normalized === 'completed') return { label: 'Completed', tone: 'success' };
    if (normalized === 'rejected') return { label: 'Rejected', tone: 'danger' };
    const fallback = paymentStatus.trim();
    return { label: fallback ? fallback.charAt(0).toUpperCase() + fallback.slice(1) : 'Unknown', tone: 'neutral' };
}
