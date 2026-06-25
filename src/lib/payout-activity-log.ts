import type { SupabaseClient } from '@supabase/supabase-js';

export interface WithdrawalActivityContext {
    withdrawal_id: string;
    provider_id: string;
    provider_name: string;
    provider_email: string | null;
    amount: string;
    amount_etb: string;
}

function formatPersonName(...parts: (string | null | undefined)[]): string {
    return parts
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        .join(' ')
        .trim();
}

export function formatProviderDisplayName(row: Record<string, unknown> | null | undefined): string {
    if (!row) return 'Unknown provider';
    const full = formatPersonName(
        row.firstName as string | undefined,
        row.lastName as string | undefined,
        row.first_name as string | undefined,
        row.last_name as string | undefined
    );
    if (full) return full;
    if (typeof row.userName === 'string' && row.userName.trim()) return row.userName.trim();
    if (typeof row.user_name === 'string' && row.user_name.trim()) return row.user_name.trim();
    if (typeof row.email === 'string' && row.email.trim()) return row.email.trim();
    return 'Unknown provider';
}

export function formatWithdrawalAmountEtb(amount: string | number | null | undefined): string {
    const parsed = Number(amount ?? 0);
    if (!Number.isFinite(parsed)) return 'ETB 0.00';
    return `ETB ${parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function loadWithdrawalActivityContext(
    admin: SupabaseClient,
    withdrawalId: string
): Promise<WithdrawalActivityContext | null> {
    const { data: withdrawal, error } = await admin
        .from('withdrawal_history')
        .select('id, providerId, amount')
        .eq('id', withdrawalId)
        .maybeSingle();

    if (error || !withdrawal) return null;

    const providerId = typeof withdrawal.providerId === 'string' ? withdrawal.providerId : '';
    if (!providerId) return null;

    const { data: provider } = await admin
        .from('provider')
        .select('id, email, firstName, lastName, userName')
        .eq('id', providerId)
        .maybeSingle();

    const amount = String(withdrawal.amount ?? '0');

    return {
        withdrawal_id: withdrawalId,
        provider_id: providerId,
        provider_name: formatProviderDisplayName(provider as Record<string, unknown> | null),
        provider_email: typeof provider?.email === 'string' ? provider.email : null,
        amount,
        amount_etb: formatWithdrawalAmountEtb(amount),
    };
}

export function buildPayoutActivityMetadata(
    context: WithdrawalActivityContext,
    extra?: Record<string, unknown>
): Record<string, unknown> {
    return {
        withdrawal_id: context.withdrawal_id,
        provider_id: context.provider_id,
        provider_name: context.provider_name,
        provider_email: context.provider_email,
        amount: context.amount,
        amount_etb: context.amount_etb,
        ...extra,
    };
}

export function buildPayoutActivitySummary(
    verb: string,
    context: WithdrawalActivityContext,
    suffix?: string
): string {
    const base = `${verb} for ${context.provider_name} (${context.amount_etb})`;
    return suffix ? `${base} — ${suffix}` : base;
}

export function withdrawalActivityLabel(context: WithdrawalActivityContext): string {
    return `${context.provider_name} (${context.amount_etb})`;
}
