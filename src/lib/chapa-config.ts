import type { SupabaseClient } from '@supabase/supabase-js';

export interface ChapaConfig {
    enable?: boolean;
    isActive?: boolean | number;
    isSandbox?: boolean;
    publicKey?: string;
    secretKey?: string;
}

export function parseObjectValue(value: unknown): Record<string, unknown> {
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

export function resolveChapaConfig(settingsData: unknown): ChapaConfig {
    const root = parseObjectValue(settingsData);
    const maybeChapa = root.chapa;
    if (!maybeChapa || typeof maybeChapa !== 'object') return {};
    return maybeChapa as ChapaConfig;
}

export function normalizeBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    return false;
}

export function isChapaSuccessStatus(status: string | undefined): boolean {
    const normalized = (status || '').toLowerCase().trim();
    return ['success', 'successful', 'completed', 'paid'].includes(normalized);
}

export async function loadChapaSecretKey(admin: SupabaseClient): Promise<string> {
    const { data: paymentRow } = await admin
        .from('app_settings')
        .select('id, data')
        .eq('id', 'payment')
        .maybeSingle();

    const chapaConfig = resolveChapaConfig((paymentRow as { data?: unknown } | null)?.data);
    return (chapaConfig.secretKey || process.env.CHAPA_SECRET_KEY || '').trim();
}

export interface ChapaEtbBalance {
    availableBalance: number;
    ledgerBalance: number;
    currency: string;
}

interface ChapaBalanceApiRow {
    currency?: string;
    available_balance?: number | string;
    ledger_balance?: number | string;
}

function parseChapaBalanceAmount(value: number | string | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function mapChapaBalanceRow(row: ChapaBalanceApiRow): ChapaEtbBalance | null {
    const currency = String(row.currency ?? '').trim().toUpperCase();
    if (currency && currency !== 'ETB') return null;

    return {
        currency: currency || 'ETB',
        availableBalance: parseChapaBalanceAmount(row.available_balance),
        ledgerBalance: parseChapaBalanceAmount(row.ledger_balance),
    };
}

export interface ChapaVerifyTransaction {
    status?: string;
    amount?: number;
    charge?: number;
    tx_ref?: string;
    reference?: string;
}

export async function verifyChapaTransaction(
    secretKey: string,
    txRef: string
): Promise<{ ok: true; data: ChapaVerifyTransaction } | { ok: false; error: string }> {
    const response = await fetch(
        `https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(txRef)}`,
        {
            method: 'GET',
            headers: { Authorization: `Bearer ${secretKey}` },
            cache: 'no-store',
        }
    );

    const payload = (await response.json()) as {
        status?: string;
        message?: string;
        data?: ChapaVerifyTransaction;
    };

    if (!response.ok || payload.status !== 'success') {
        return { ok: false, error: payload.message || 'Chapa verify failed' };
    }

    const txStatus = String(payload.data?.status ?? '').toLowerCase();
    if (!isChapaSuccessStatus(txStatus)) {
        return { ok: false, error: `Chapa status is ${txStatus || 'unknown'}` };
    }

    return { ok: true, data: payload.data ?? {} };
}

export function resolveChapaSettlementAmount(data: ChapaVerifyTransaction): number | null {
    const gross = Number(data.amount ?? 0);
    const charge = Number(data.charge ?? 0);

    if (!Number.isFinite(gross) || gross <= 0) return null;

    if (Number.isFinite(charge) && charge >= 0) {
        return Math.round((gross - charge) * 100) / 100;
    }

    return Math.round(gross * 100) / 100;
}

export function resolveChapaWalletCreditAmount(
    data: ChapaVerifyTransaction,
    fallbackAmount: string
): string {
    const gross = Number(data.amount ?? 0);
    const charge = Number(data.charge ?? 0);

    if (Number.isFinite(gross) && gross > 0) {
        const inferredFromCustomerFee = Math.round((gross / 1.035) * 100) / 100;
        if (Math.abs(inferredFromCustomerFee * 1.035 - gross) < 0.02) {
            return inferredFromCustomerFee.toFixed(2);
        }
        if (Number.isFinite(charge) && charge > 0) {
            return (gross - charge).toFixed(2);
        }
        return gross.toFixed(2);
    }

    const fallback = Number(fallbackAmount);
    return Number.isFinite(fallback) && fallback > 0 ? fallback.toFixed(2) : '0.00';
}

export async function fetchChapaEtbBalance(secretKey: string): Promise<ChapaEtbBalance> {
    const headers = { Authorization: `Bearer ${secretKey}` };

    const etbResponse = await fetch('https://api.chapa.co/v1/balances/ETB', {
        method: 'GET',
        headers,
        cache: 'no-store',
    });

    const etbPayload = (await etbResponse.json()) as {
        status?: string;
        message?: string;
        data?: ChapaBalanceApiRow | ChapaBalanceApiRow[];
    };

    if (etbResponse.ok && etbPayload.status === 'success') {
        const data = etbPayload.data;
        if (Array.isArray(data)) {
            const row = data.find((item) => String(item.currency ?? '').toUpperCase() === 'ETB') ?? data[0];
            const mapped = row ? mapChapaBalanceRow(row) : null;
            if (mapped) return mapped;
        } else if (data) {
            const mapped = mapChapaBalanceRow(data);
            if (mapped) return mapped;
        }
    }

    const allResponse = await fetch('https://api.chapa.co/v1/balances', {
        method: 'GET',
        headers,
        cache: 'no-store',
    });

    const allPayload = (await allResponse.json()) as {
        status?: string;
        message?: string;
        data?: ChapaBalanceApiRow[];
    };

    if (!allResponse.ok || allPayload.status !== 'success') {
        const message = allPayload.message || etbPayload.message || 'Failed to fetch Chapa balance';
        throw new Error(message);
    }

    const rows = allPayload.data ?? [];
    const etbRow = rows.find((item) => String(item.currency ?? '').toUpperCase() === 'ETB');
    const mapped = etbRow ? mapChapaBalanceRow(etbRow) : rows[0] ? mapChapaBalanceRow(rows[0]) : null;

    if (!mapped) {
        throw new Error('Chapa balance response did not include ETB data');
    }

    return mapped;
}
