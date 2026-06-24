import { describe, expect, it } from 'vitest';
import { analyzeProviderPayoutWallet } from '@/lib/provider-payout-analysis';

const PROVIDER_ID = '2e59797a-db9b-4485-afa8-69a54c9bd42f';
const CUSTOMER_ID = '8a8f7b79-d371-4a7e-b140-162da35cc5cc';

describe('analyzeProviderPayoutWallet', () => {
    it('flags Fozia-style wallet as high risk for small withdrawal', () => {
        const analysis = analyzeProviderPayoutWallet({
            providerId: PROVIDER_ID,
            providerName: 'Fozia Kassa',
            providerEmail: 'foziaka&/ssa@gmail.com',
            providerUserId: PROVIDER_ID,
            storedWalletAmount: 822.17,
            requestedWithdrawalAmount: 3,
            walletTransactions: [
                {
                    id: '1',
                    amount: '95.53',
                    isCredit: true,
                    note: 'Service listing plan activation (Chapa, net after fee)',
                    paymentType: 'chapa',
                    transactionId: 'activation-1',
                    createdDate: '2026-06-17T08:52:57Z',
                },
                {
                    id: '2',
                    amount: '237.96',
                    isCredit: true,
                    note: 'Order #40d11a completed (payout after admin commission)',
                    paymentType: 'Wallet',
                    transactionId: '40d11a98-bfc5-4f81-8689-da76f5567438',
                    createdDate: '2026-06-23T12:22:53Z',
                },
                {
                    id: '3',
                    amount: '10',
                    isCredit: false,
                    note: 'Withdrawal payout 8bc2ad5c-0aeb-4812-a315-1829c36aa504',
                    paymentType: 'wallet',
                    transactionId: 'withdrawal:8bc2ad5c',
                    createdDate: '2026-06-22T13:14:18Z',
                },
            ],
            bookings: [
                {
                    id: '40d11a98-bfc5-4f81-8689-da76f5567438',
                    customer_id: CUSTOMER_ID,
                    status: 'completed',
                    totalAmount: -177.92,
                    payment_status: 'payment_completed',
                    paymentCompleted: false,
                },
            ],
            customers: [{ id: CUSTOMER_ID, user_id: CUSTOMER_ID }],
            customerWalletCredits: [],
        });

        expect(analysis.risk).toBe('high');
        expect(analysis.findings.some((item) => item.id === 'erroneous-payouts')).toBe(true);
        expect(analysis.breakdown.erroneousPayouts).toBe(237.96);
    });

    it('treats completed job payout as legitimate when provider assigned self as handyman', () => {
        const analysis = analyzeProviderPayoutWallet({
            providerId: 'provider-1',
            providerName: 'Solo Provider',
            providerEmail: 'solo@example.com',
            providerUserId: 'provider-1',
            storedWalletAmount: 25.02,
            walletTransactions: [
                {
                    id: '1',
                    amount: '25.02',
                    isCredit: true,
                    note: 'Order #5eeb44 completed (payout after admin commission)',
                    paymentType: 'Wallet',
                    transactionId: '5eeb4469-0000-0000-0000-000000000001',
                    createdDate: '2026-06-18T10:35:20Z',
                },
            ],
            bookings: [
                {
                    id: '5eeb4469-0000-0000-0000-000000000001',
                    customer_id: 'customer-2',
                    status: 'completed',
                    totalAmount: 27.8,
                    payment_status: 'payment_completed',
                    paymentCompleted: true,
                },
            ],
            customers: [{ id: 'customer-2', user_id: 'customer-2' }],
            customerWalletCredits: [],
        });

        expect(analysis.breakdown.legitimateJobPayouts).toBe(25.02);
        expect(analysis.breakdown.suspiciousJobPayouts).toBe(0);
        expect(analysis.findings.some((item) => item.id === 'suspicious-payouts')).toBe(false);
    });

    it('marks clean provider with only activation balance and no suspicious payouts', () => {
        const analysis = analyzeProviderPayoutWallet({
            providerId: 'provider-1',
            providerName: 'Clean Provider',
            providerEmail: 'clean@example.com',
            providerUserId: 'provider-1',
            storedWalletAmount: 90,
            requestedWithdrawalAmount: 50,
            walletTransactions: [
                {
                    id: '1',
                    amount: '100',
                    isCredit: true,
                    note: 'Service listing plan activation (Chapa, net after fee)',
                    paymentType: 'chapa',
                    transactionId: 'activation-1',
                    createdDate: '2026-06-17T08:52:57Z',
                },
                {
                    id: '2',
                    amount: '10',
                    isCredit: false,
                    note: 'Withdrawal payout abc',
                    paymentType: 'wallet',
                    transactionId: 'withdrawal:abc',
                    createdDate: '2026-06-22T13:14:18Z',
                },
            ],
            bookings: [],
            customers: [],
            customerWalletCredits: [],
        });

        expect(analysis.risk).toBe('clean');
        expect(analysis.defensibleBalance).toBe(90);
        expect(analysis.withdrawalCoversRequest).toBe(true);
    });
});
