import {
    SECURITY_ERROR_MESSAGES,
    validateSecureNumericInput,
    validateSecurePhoneInput,
    validateSecureTextInput,
} from '@/lib/input-security';

/** Shared create-booking field limits (UI + API). */
export const BOOKING_FIELD_LIMITS = {
    quantityMin: 1,
    quantityMax: 99,
    addressMax: 300,
    localityMin: 2,
    localityMax: 120,
    landmarkMax: 120,
    descriptionMax: 1000,
    /** Display/input room for +251 / spaces; digit rules are separate. */
    phoneMax: 20,
    /** Admin may schedule up to this many days ahead. */
    bookingDateMaxDaysAhead: 365,
    /** Admin custom unit price (ETB). */
    unitPriceMin: 0.01,
    unitPriceMax: 1_000_000,
} as const;

export function clampBookingQuantity(raw: string): string {
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) return '';
    const value = Number.parseInt(digits, 10);
    if (!Number.isFinite(value)) return '';
    return String(Math.min(BOOKING_FIELD_LIMITS.quantityMax, Math.max(0, value)));
}

export function bookingSecureTextError(label: string, value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!validateSecureTextInput(trimmed)) {
        return `${label} contains unsafe content`;
    }
    return null;
}

export function bookingSecurePhoneError(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!validateSecurePhoneInput(trimmed)) {
        return SECURITY_ERROR_MESSAGES.INVALID_PHONE_FORMAT;
    }
    return null;
}

export function bookingSecureQuantityError(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!validateSecureNumericInput(trimmed)) {
        return SECURITY_ERROR_MESSAGES.INVALID_NUMERIC_FORMAT;
    }
    return null;
}

export function assertBookingSecureTextFields(fields: {
    address?: string;
    locality?: string;
    landmark?: string;
    description?: string;
}): void {
    const checks: Array<[string, string | undefined]> = [
        ['Address', fields.address],
        ['Locality', fields.locality],
        ['Landmark', fields.landmark],
        ['Description', fields.description],
    ];
    for (const [label, value] of checks) {
        if (!value?.trim()) continue;
        const error = bookingSecureTextError(label, value);
        if (error) throw new Error(error);
    }
}
