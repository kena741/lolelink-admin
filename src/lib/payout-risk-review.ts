import type { ProviderPayoutAnalysis } from '@/lib/provider-payout-analysis';

export type PayoutRiskReviewAction = 'approve' | 'send';

export function requiresPayoutRiskReview(analysis: ProviderPayoutAnalysis | null | undefined): boolean {
    if (!analysis) return true;
    if (analysis.reviewMode !== 'active') return false;
    return analysis.risk === 'high' || analysis.risk === 'review';
}

export function getPayoutRiskReviewActionLabel(action: PayoutRiskReviewAction): string {
    return action === 'approve' ? 'Approve payout' : 'Send via Chapa';
}
