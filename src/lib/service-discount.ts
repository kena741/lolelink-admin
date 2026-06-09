export function filterServiceDiscountInput(next: string, previous: string): string {
    const cleaned = next.replace(/[^\d.]/g, '');
    if (cleaned === '') return '';

    const dotParts = cleaned.split('.');
    const normalized =
        dotParts.length <= 2 ? cleaned : `${dotParts[0]}.${dotParts.slice(1).join('')}`;

    if (normalized === '.' || normalized.endsWith('.')) {
        const whole = normalized.slice(0, -1);
        if (whole && Number(whole) >= 100) return previous;
        return normalized;
    }

    const value = Number(normalized);
    if (!Number.isFinite(value)) return previous;
    if (value < 0 || value >= 100) return previous;

    return normalized;
}

export function getServiceDiscountError(raw: string | null | undefined): string | null {
    const result = validateServiceDiscount(raw);
    return result.ok ? null : result.error;
}

export function parseServiceDiscountInput(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const normalized = trimmed.endsWith('%') ? trimmed.slice(0, -1).trim() : trimmed;
    if (!normalized) return null;

    const value = Number(normalized);
    if (!Number.isFinite(value)) return null;

    return value;
}

export type ServiceDiscountValidationResult =
    | { ok: true; value: string | undefined }
    | { ok: false; error: string };

export function validateServiceDiscount(raw: string | null | undefined): ServiceDiscountValidationResult {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) {
        return { ok: true, value: undefined };
    }

    const value = parseServiceDiscountInput(trimmed);
    if (value === null) {
        return { ok: false, error: 'Discount must be a valid percentage.' };
    }

    if (value < 0) {
        return { ok: false, error: 'Discount cannot be negative.' };
    }

    if (value >= 100) {
        return { ok: false, error: 'Discount must be less than 100%.' };
    }

    return { ok: true, value: String(value) };
}

export function formatServiceDiscountLabel(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '0%';
    const trimmed = String(value).trim();
    if (!trimmed) return '0%';
    if (trimmed.endsWith('%')) return trimmed;
    return `${trimmed}%`;
}
