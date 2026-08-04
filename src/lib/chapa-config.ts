import { createHmac, timingSafeEqual } from 'crypto';
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

function safeEqualHex(received: string | null, expected: string): boolean {
    if (!received || received.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

/** Verify Chapa Payment Webhook using CHAPA_WEBHOOK_SECRET (dashboard secret hash). */
export function verifyChapaWebhookSignature(rawBody: string, headers: Headers): boolean {
    const secret = (process.env.CHAPA_WEBHOOK_SECRET || '').trim();
    if (!secret) return false;

    const xSig = headers.get('x-chapa-signature');
    const chapaSig = headers.get('chapa-signature');
    if (!xSig && !chapaSig) return false;

    const payloadMac = createHmac('sha256', secret).update(rawBody).digest('hex');
    const secretMac = createHmac('sha256', secret).update(secret).digest('hex');

    return (
        safeEqualHex(xSig, payloadMac) ||
        safeEqualHex(chapaSig, secretMac) ||
        safeEqualHex(chapaSig, payloadMac)
    );
}

export const CHAPA_DOMESTIC_FEE_RATE = 0.025;

const CHAPA_LEGACY_DOMESTIC_FEE_RATE = 0.035;

function inferNetFromGrossWithFeeMarkup(gross: number, feeRate: number): number | null {
    const multiplier = 1 + feeRate;
    const net = Math.round((gross / multiplier) * 100) / 100;
    const error = Math.abs(net * multiplier - gross);
    if (error < 0.02) {
        return net;
    }
    return null;
}

function resolveInferredNetFromGross(gross: number): number | null {
    const feeRates = [CHAPA_DOMESTIC_FEE_RATE, CHAPA_LEGACY_DOMESTIC_FEE_RATE];
    let bestNet: number | null = null;
    let bestError = Number.POSITIVE_INFINITY;

    for (const feeRate of feeRates) {
        const net = inferNetFromGrossWithFeeMarkup(gross, feeRate);
        if (net == null) continue;

        const error = Math.abs(net * (1 + feeRate) - gross);
        if (error < bestError) {
            bestError = error;
            bestNet = net;
        }
    }

    return bestNet;
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
        if (Number.isFinite(charge) && charge > 0) {
            return (gross - charge).toFixed(2);
        }

        const inferredNet = resolveInferredNetFromGross(gross);
        if (inferredNet != null) {
            return inferredNet.toFixed(2);
        }

        return gross.toFixed(2);
    }

    const fallback = Number(fallbackAmount);
    return Number.isFinite(fallback) && fallback > 0 ? fallback.toFixed(2) : '0.00';
}

export interface ChapaListTransaction {
    status?: string;
    ref_id?: string;
    type?: string;
    created_at?: string;
    currency?: string;
    amount?: string | number;
    charge?: string | number;
    trans_id?: string;
    payment_method?: string;
    email?: string;
    mobile?: string;
    first_name?: string | null;
    last_name?: string | null;
}

export interface ChapaTransactionsPagination {
    per_page: number;
    current_page: number;
    first_page_url: string;
    next_page_url: string | null;
    prev_page_url: string | null;
}

export interface ChapaTransactionsPage {
    transactions: ChapaListTransaction[];
    pagination: ChapaTransactionsPagination;
}

export interface ChapaTransferListItem {
    account_name?: string;
    account_number?: string;
    currency?: string;
    amount?: number | string;
    charge?: number | string;
    transfer_type?: string;
    chapa_reference?: string;
    bank_code?: number;
    bank_name?: string;
    bank_reference?: string;
    status?: string;
    reference?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface ChapaTransfersPagination {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    next_page_url: string | null;
    prev_page_url: string | null;
}

export interface ChapaTransfersPage {
    transfers: ChapaTransferListItem[];
    pagination: ChapaTransfersPagination;
}

function parseChapaMoney(value: string | number | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveChapaListSettlementAmount(tx: ChapaListTransaction): number {
    const gross = parseChapaMoney(tx.amount);
    const charge = parseChapaMoney(tx.charge);
    if (gross <= 0) return 0;
    if (charge >= 0) return Math.round((gross - charge) * 100) / 100;
    return Math.round(gross * 100) / 100;
}

export function resolveChapaTransferDebitAmount(transfer: ChapaTransferListItem): number {
    const amount = parseChapaMoney(transfer.amount);
    const charge = parseChapaMoney(transfer.charge);
    if (amount <= 0) return 0;
    return Math.round((amount + charge) * 100) / 100;
}

export async function fetchChapaTransactionsPage(
    secretKey: string,
    page = 1
): Promise<ChapaTransactionsPage> {
    const response = await fetch(`https://api.chapa.co/v1/transactions?page=${page}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${secretKey}` },
        cache: 'no-store',
    });

    const payload = (await response.json()) as {
        status?: string;
        message?: string;
        data?: {
            transactions?: ChapaListTransaction[];
            pagination?: ChapaTransactionsPagination;
        };
    };

    if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Failed to fetch Chapa transactions');
    }

    const pagination = payload.data?.pagination;
    if (!pagination) {
        throw new Error('Chapa transactions response missing pagination');
    }

    return {
        transactions: payload.data?.transactions ?? [],
        pagination,
    };
}

export async function fetchAllChapaTransactions(
    secretKey: string,
    options?: { onPage?: (page: number, count: number) => void }
): Promise<ChapaListTransaction[]> {
    const all: ChapaListTransaction[] = [];
    let page = 1;

    while (page <= 500) {
        const { transactions, pagination } = await fetchChapaTransactionsPage(secretKey, page);
        options?.onPage?.(page, transactions.length);
        all.push(...transactions);
        if (!pagination.next_page_url || transactions.length === 0) break;
        page += 1;
    }

    return all;
}

export async function fetchChapaTransfersPage(
    secretKey: string,
    page = 1
): Promise<ChapaTransfersPage> {
    const response = await fetch(`https://api.chapa.co/v1/transfers?page=${page}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${secretKey}` },
        cache: 'no-store',
    });

    const payload = (await response.json()) as {
        status?: string;
        message?: string;
        data?: ChapaTransferListItem[];
        meta?: ChapaTransfersPagination;
    };

    if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Failed to fetch Chapa transfers');
    }

    const pagination = payload.meta;
    if (!pagination) {
        throw new Error('Chapa transfers response missing pagination');
    }

    return {
        transfers: payload.data ?? [],
        pagination,
    };
}

export async function fetchAllChapaTransfers(
    secretKey: string,
    options?: { onPage?: (page: number, count: number) => void }
): Promise<ChapaTransferListItem[]> {
    const all: ChapaTransferListItem[] = [];
    let page = 1;

    while (page <= 500) {
        const { transfers, pagination } = await fetchChapaTransfersPage(secretKey, page);
        options?.onPage?.(page, transfers.length);
        all.push(...transfers);
        if (!pagination.next_page_url || page >= pagination.last_page || transfers.length === 0) break;
        page += 1;
    }

    return all;
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
