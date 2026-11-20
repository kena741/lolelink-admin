import { describe, expect, it } from 'vitest';
import {
    paidPercentage,
    remainingServiceBalance,
    resolveBookingPaymentSettlement,
} from '@/lib/booking-payment-progress';
import { formatBookingPaymentStatusLabel } from '@/lib/booking-status';

describe('booking payment progress', () => {
    it('treats unpaid flag as 0% even if totalAmount looks full', () => {
        const row = {
            paymentCompleted: false,
            totalAmount: 1000,
            subTotal: 1000,
            status: 'accepted',
        };
        expect(paidPercentage(row)).toBe(0);
        expect(resolveBookingPaymentSettlement(row)).toBe('unpaid');
        expect(formatBookingPaymentStatusLabel('pending_payment', false, row)).toBe('Unpaid');
    });

    it('labels partial when flag is on but totalAmount < obligation', () => {
        const row = {
            paymentCompleted: true,
            payment_status: 'payment_completed',
            totalAmount: 300,
            subTotal: 1000,
            status: 'accepted',
        };
        expect(paidPercentage(row)).toBe(30);
        expect(remainingServiceBalance(row)).toBe(700);
        expect(resolveBookingPaymentSettlement(row)).toBe('partial');
        expect(formatBookingPaymentStatusLabel('payment_completed', true, row)).toBe(
            'Partially paid (30%)'
        );
    });

    it('labels paid when collected amount covers obligation', () => {
        const row = {
            paymentCompleted: true,
            totalAmount: 1000,
            subTotal: 1000,
            status: 'accepted',
        };
        expect(paidPercentage(row)).toBe(100);
        expect(remainingServiceBalance(row)).toBe(0);
        expect(resolveBookingPaymentSettlement(row)).toBe('paid');
        expect(formatBookingPaymentStatusLabel('payment_completed', true, row)).toBe('Paid');
    });

    it('labels recurring period down payment as partial', () => {
        const row = {
            paymentCompleted: true,
            payment_status: 'payment_completed',
            totalAmount: 6000,
            subTotal: 12000,
            price: 12000,
            status: 'accepted',
            currentPeriodStart: '2026-11-15T12:00:00.000Z',
            currentPeriodEnd: '2026-12-15T12:00:00.000Z',
        };
        expect(paidPercentage(row)).toBe(50);
        expect(remainingServiceBalance(row)).toBe(6000);
        expect(resolveBookingPaymentSettlement(row)).toBe('partial');
        expect(formatBookingPaymentStatusLabel('payment_completed', true, row)).toBe(
            'Partially paid (50%)'
        );
    });
});

