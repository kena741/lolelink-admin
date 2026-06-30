import { CHAPA_DOMESTIC_FEE_RATE } from './chapa-config';

export const CHAPA_WITHDRAWAL_FEE_RATE = CHAPA_DOMESTIC_FEE_RATE;

export interface WithdrawalPayoutBreakdown {
    grossAmount: number;
    chapaFee: number;
    netTransferAmount: number;
}

export function parseWithdrawalAmount(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateWithdrawalPayoutBreakdown(
    grossAmount: string | number | null | undefined
): WithdrawalPayoutBreakdown {
    const gross = Math.round(parseWithdrawalAmount(grossAmount) * 100) / 100;
    const chapaFee = Math.round(gross * CHAPA_WITHDRAWAL_FEE_RATE * 100) / 100;
    const netTransferAmount = Math.round((gross - chapaFee) * 100) / 100;

    return {
        grossAmount: gross,
        chapaFee,
        netTransferAmount: netTransferAmount > 0 ? netTransferAmount : 0,
    };
}

export function formatWithdrawalPayoutBreakdownNote(
    breakdown: WithdrawalPayoutBreakdown
): string {
    return `gross=ETB ${breakdown.grossAmount.toFixed(2)} fee=ETB ${breakdown.chapaFee.toFixed(2)} (${(CHAPA_WITHDRAWAL_FEE_RATE * 100).toFixed(1)}%) net=ETB ${breakdown.netTransferAmount.toFixed(2)}`;
}
