import { describe, expect, it } from 'vitest';
import {
    boostFeaturedRevenueAmount,
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
        ).toBe(false);
        expect(
            isActivationFeeWalletCredit({
                isCredit: true,
                note: 'Service listing plan upgrade (Chapa, net after fee)',
            })
        ).toBe(true);
        expect(
            isBoostFeaturedWalletCredit({
                isCredit: true,
                note: 'Featured psot purchase (Chapa, net after fee)',
            })
        ).toBe(true);
        expect(
            isBoostFeaturedWalletCredit({
                isCredit: false,
                note: 'Featured request payment (Chapa) — service=6a9d7863-20fc-4164-9ad5-69f8cb6c8270',
                amount: '500.00',
            })
        ).toBe(true);
        expect(
            isBoostFeaturedWalletCredit({
                isCredit: true,
                note: 'Featured request payment (Chapa) — service=c82933d9-dd51-4443-9294-0d7ccf278501 (Chapa, net after fee)',
                amount: '487.50',
            })
        ).toBe(true);
    });

    it('counts featured request debits in boost/featured revenue', () => {
        const breakdown = computeDashboardRevenueBreakdown({
            walletRows: [
                {
                    isCredit: false,
                    amount: '500.00',
                    note: 'Featured request payment (Chapa) — service=6a9d7863-20fc-4164-9ad5-69f8cb6c8270',
                },
                {
                    isCredit: true,
                    amount: '487.50',
                    note: 'Featured request payment (Chapa) — service=c82933d9-dd51-4443-9294-0d7ccf278501 (Chapa, net after fee)',
                },
            ],
            bookings: [],
            jobRequests: [],
        });

        // 500 gross → 487.50 after 2.5% Chapa fee; second row already net
        expect(breakdown.boostFeatured).toBe(975);
        expect(breakdown.total).toBe(975);
    });

    it('applies 2.5% chapa fee to gross featured payments only', () => {
        expect(
            boostFeaturedRevenueAmount({
                isCredit: false,
                amount: '500.00',
                note: 'Featured request payment (Chapa) — service=abc',
            })
        ).toBe(487.5);
        expect(
            boostFeaturedRevenueAmount({
                isCredit: true,
                amount: '487.50',
                note: 'Featured request payment (Chapa) — service=abc (Chapa, net after fee)',
            })
        ).toBe(487.5);
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

        expect(breakdown.activationFee).toBe(150);
        expect(breakdown.boostFeatured).toBe(0);
        expect(breakdown.commission).toBe(20);
        expect(breakdown.customerJobPost).toBe(15);
        expect(breakdown.total).toBe(185);
    });

    it('counts commission when payment is admin-approved', () => {
        const breakdown = computeDashboardRevenueBreakdown({
            walletRows: [],
            bookings: [
                {
                    status: 'completed',
                    payment_status: 'payment_approved_by_admin',
                    paymentCompleted: false,
                    adminCommission: '33.5',
                    totalAmount: '300',
                },
            ],
            jobRequests: [],
        });

        expect(breakdown.commission).toBe(33.5);
        expect(breakdown.total).toBe(33.5);
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
        expect(activationLines).toHaveLength(2);
        expect(activationLines[0]?.amount).toBe(50);

        const totalLines = buildDashboardRevenueTransactionLines('total', input);
        expect(totalLines).toHaveLength(4);
        expect(totalLines[0]?.bucket).toBe('customer_job_post');
    });
});
