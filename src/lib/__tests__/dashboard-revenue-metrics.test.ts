import { describe, expect, it } from 'vitest';
import {
    buildDashboardRevenueTransactionLines,
    computeDashboardRevenueBreakdown,
    isActivationFeeWalletCredit,
    isBoostFeaturedWalletCredit,
} from '../dashboard-revenue-metrics';

describe('dashboard revenue metrics', () => {
    it('classifies activation vs boost credits', () => {
        expect(
            isActivationFeeWalletCredit({
                isCredit: true,
                note: 'Service listing plan activation (Chapa, net after fee)',
            })
        ).toBe(true);
        expect(
            isBoostFeaturedWalletCredit({
                isCredit: true,
                note: 'Service listing plan upgrade (Chapa, net after fee)',
            })
        ).toBe(true);
        expect(
            isActivationFeeWalletCredit({
                isCredit: true,
                note: 'Service listing plan upgrade (Chapa, net after fee)',
            })
        ).toBe(false);
    });

    it('computes total from revenue buckets', () => {
        const breakdown = computeDashboardRevenueBreakdown({
            walletRows: [
                {
                    isCredit: true,
                    amount: '100',
                    note: 'Service listing plan activation (Chapa, net after fee)',
                },
                {
                    isCredit: true,
                    amount: '50',
                    note: 'Service listing plan upgrade (Chapa, net after fee)',
                },
            ],
            bookings: [
                {
                    status: 'completed',
                    paymentCompleted: true,
                    totalAmount: '200',
                    adminCommission: '20',
                },
            ],
            jobRequests: [{ is_paid: true, price: '15' }],
        });

        expect(breakdown.activationFee).toBe(100);
        expect(breakdown.boostFeatured).toBe(50);
        expect(breakdown.commission).toBe(20);
        expect(breakdown.customerJobPost).toBe(15);
        expect(breakdown.total).toBe(185);
    });

    it('builds transaction lines per category', () => {
        const input = {
            walletRows: [
                {
                    id: 'w1',
                    isCredit: true,
                    amount: '100',
                    note: 'Service listing plan activation (Chapa, net after fee)',
                    createdDate: '2026-06-01T10:00:00.000Z',
                    transactionId: 'act-1',
                },
                {
                    id: 'w2',
                    isCredit: true,
                    amount: '50',
                    note: 'Service listing plan upgrade (Chapa, net after fee)',
                    createdDate: '2026-06-02T10:00:00.000Z',
                    transactionId: 'up-1',
                },
            ],
            bookings: [
                {
                    id: 'b1',
                    status: 'completed',
                    paymentCompleted: true,
                    totalAmount: '200',
                    adminCommission: '20',
                    serviceName: 'Plumbing',
                    createdAt: '2026-06-03T10:00:00.000Z',
                },
            ],
            jobRequests: [
                {
                    id: 'j1',
                    is_paid: true,
                    price: '15',
                    title: 'Fix sink',
                    createdAt: '2026-06-04T10:00:00.000Z',
                },
            ],
        };

        const activationLines = buildDashboardRevenueTransactionLines('activation_fee', input);
        expect(activationLines).toHaveLength(1);
        expect(activationLines[0]?.amount).toBe(100);

        const totalLines = buildDashboardRevenueTransactionLines('total', input);
        expect(totalLines).toHaveLength(4);
        expect(totalLines[0]?.bucket).toBe('customer_job_post');
    });
});
