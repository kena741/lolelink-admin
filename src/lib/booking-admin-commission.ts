import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdminCommissionConfig {
    value: number;
    isFix: boolean;
    active: boolean;
}

function parseAmount(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}

function parseObjectValue(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'string') {
        try {
            return (JSON.parse(value) as Record<string, unknown>) ?? {};
        } catch {
            return {};
        }
    }
    if (typeof value === 'object') return value as Record<string, unknown>;
    return {};
}

export function parseAdminCommissionConfig(data: unknown): AdminCommissionConfig {
    const row = parseObjectValue(data);
    const rawValue = row.value;
    let value = 0;
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) value = rawValue;
    else if (typeof rawValue === 'string') {
        const parsed = parseFloat(rawValue);
        if (Number.isFinite(parsed)) value = parsed;
    }

    return {
        value,
        isFix: row.isFix === true,
        active: row.active !== false,
    };
}

/** Platform fee in ETB taken from booking gross. */
export function computeAdminCommissionFee(
    gross: number,
    commission: Pick<AdminCommissionConfig, 'value' | 'isFix' | 'active'>
): number {
    if (!(gross > 0) || commission.active === false) return 0;
    if (!(commission.value > 0)) return 0;
    if (commission.isFix) return roundMoney(Math.min(commission.value, gross));
    return roundMoney((gross * commission.value) / 100);
}

export function computePercentCommissionFee(gross: number, percent: number): number {
    if (!(gross > 0) || !(percent > 0)) return 0;
    return roundMoney((gross * percent) / 100);
}

export function clampCommissionPercent(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, value));
}

export async function loadAdminCommissionConfig(
    admin: SupabaseClient
): Promise<AdminCommissionConfig> {
    const { data } = await admin
        .from('app_settings')
        .select('data')
        .eq('id', 'admin_commission')
        .maybeSingle();

    return parseAdminCommissionConfig((data as { data?: unknown } | null)?.data);
}

/** Prefer live settings computation; fall back to stored booking fee. */
export function resolveBookingAdminCommissionAmount(
    booking: {
        adminCommission?: string | number | null;
        totalAmount?: string | number | null;
        price?: string | number | null;
    },
    commission?: Pick<AdminCommissionConfig, 'value' | 'isFix' | 'active'> | null
): number {
    const gross = parseAmount(booking.totalAmount);
    const amount = gross > 0 ? gross : parseAmount(booking.price);

    if (commission) {
        const computed = computeAdminCommissionFee(amount, commission);
        if (computed > 0) return computed;
    }

    const stored = parseAmount(booking.adminCommission);
    return stored > 0 ? roundMoney(stored) : 0;
}
