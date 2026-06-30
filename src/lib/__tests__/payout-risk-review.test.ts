import { describe, expect, it } from 'vitest';
import type { ProviderPayoutAnalysis } from '@/lib/provider-payout-analysis';
import { requiresPayoutRiskReview } from '@/lib/payout-risk-review';

function baseAnalysis(overrides: Partial<ProviderPayoutAnalysis> = {}): ProviderPayoutAnalysis {
    return {
        providerId: 'provider-1',
        providerName: 'Test Provider',
        providerEmail: 'test@example.com',
        storedWalletAmount: 100,
        ledgerNet: 100,
        ledgerMatchesStored: true,
        breakdown: {
            activationCredits: 0,
            legitimateJobPayouts: 100,
            suspiciousJobPayouts: 0,
            erroneousPayouts: 0,
            otherCredits: 0,
            withdrawals: 0,
            declineFees: 0,
            otherDebits: 0,
        },
        defensibleBalance: 100,
        requestedWithdrawalAmount: 50,
        withdrawalCoversRequest: true,
        risk: 'clean',
        riskLabel: 'Clean',
        reviewMode: 'active',
        withdrawalStatus: 'pending',
        findings: [],
        transactions: [],
        stats: { completedBookings: 1, rejectedPaidWithoutRefund: 0 },
        ...overrides,
    };
}

describe('requiresPayoutRiskReview', () => {
    it('requires review for high-risk active requests', () => {
        expect(requiresPayoutRiskReview(baseAnalysis({ risk: 'high' }))).toBe(true);
    });

    it('requires review for review-risk active requests', () => {
        expect(requiresPayoutRiskReview(baseAnalysis({ risk: 'review' }))).toBe(true);
    });

    it('skips review for clean active requests', () => {
        expect(requiresPayoutRiskReview(baseAnalysis({ risk: 'clean' }))).toBe(false);
    });

    it('skips review for completed historical requests', () => {
        expect(
            requiresPayoutRiskReview(
                baseAnalysis({
                    risk: 'high',
                    reviewMode: 'historical',
                    withdrawalStatus: 'completed',
                })
            )
        ).toBe(false);
    });

    it('requires review when analysis is missing', () => {
        expect(requiresPayoutRiskReview(null)).toBe(true);
    });
});
