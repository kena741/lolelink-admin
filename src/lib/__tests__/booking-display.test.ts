import { describe, expect, it } from 'vitest';
import {
    getBookingAnomalies,
    hasBookingCustomerRefund,
    hasBookingPaymentFlagConflict,
    isSameOwnerBooking,
} from '@/lib/booking-display';

describe('hasBookingPaymentFlagConflict', () => {
    it('suppresses wallet escrow pattern (status paid, boolean false)', () => {
        expect(hasBookingPaymentFlagConflict('payment_completed', false)).toBe(false);
    });

    it('flags boolean paid while status is unpaid', () => {
        expect(hasBookingPaymentFlagConflict('pending_payment', true)).toBe(true);
    });

    it('flags boolean paid while status is cancelled', () => {
        expect(hasBookingPaymentFlagConflict('payment_cancelled', true)).toBe(true);
    });

    it('allows both fields aligned as paid', () => {
        expect(hasBookingPaymentFlagConflict('payment_completed', true)).toBe(false);
    });

    it('allows both fields aligned as unpaid', () => {
        expect(hasBookingPaymentFlagConflict('pending_payment', false)).toBe(false);
    });
});

describe('isSameOwnerBooking', () => {
    it('detects matching profile ids', () => {
        expect(
            isSameOwnerBooking({
                customer_id: 'uuid-1',
                provider_id: 'uuid-1',
            })
        ).toBe(true);
    });

    it('detects matching auth user ids', () => {
        expect(
            isSameOwnerBooking({
                customer_id: 'cust-1',
                provider_id: 'prov-1',
                customer_user_id: 'auth-1',
                provider_user_id: 'auth-1',
            })
        ).toBe(true);
    });

    it('does not flag unrelated accounts', () => {
        expect(
            isSameOwnerBooking({
                customer_id: 'cust-1',
                provider_id: 'prov-1',
                customer_user_id: 'auth-1',
                provider_user_id: 'auth-2',
            })
        ).toBe(false);
    });
});

describe('getBookingAnomalies', () => {
    it('does not flag providerMySelf as an issue', () => {
        const anomalies = getBookingAnomalies({
            providerMySelf: true,
            status: 'accepted',
            payment_status: 'pending_payment',
            paymentCompleted: false,
            serviceName: 'Cleaning',
        });

        expect(anomalies).toHaveLength(0);
    });

    it('does not flag wallet escrow payment mismatch', () => {
        const anomalies = getBookingAnomalies({
            status: 'pending',
            payment_status: 'payment_completed',
            paymentCompleted: false,
            serviceName: 'Cleaning',
        });

        expect(anomalies.some((item) => item.id === 'payment-flag-mismatch')).toBe(false);
        expect(anomalies.some((item) => item.id === 'pending-but-paid')).toBe(false);
    });

    it('flags same-owner booking as critical integrity issue', () => {
        const anomalies = getBookingAnomalies({
            customer_id: 'shared',
            provider_id: 'shared',
            status: 'pending',
            payment_status: 'pending_payment',
            paymentCompleted: false,
            serviceName: 'Cleaning',
        });

        expect(anomalies.some((item) => item.id === 'same-owner-booking' && item.severity === 'error')).toBe(true);
    });

    it('resolves service name from serviceDetails', () => {
        const anomalies = getBookingAnomalies({
            status: 'pending',
            payment_status: 'pending_payment',
            paymentCompleted: false,
            serviceDetails: { serviceName: 'Catering service' },
        });

        expect(anomalies.some((item) => item.id === 'missing-service-name')).toBe(false);
    });

    it('does not flag rejected paid booking when refund is recorded', () => {
        const anomalies = getBookingAnomalies({
            id: '7d1c7d56-3111-4e9c-b0f1-1a5285038734',
            status: 'rejected',
            payment_status: 'payment_completed',
            paymentCompleted: true,
            serviceName: 'Cleaning',
            customer_refund_recorded: true,
        });

        expect(anomalies.some((item) => item.id === 'rejected-refund-missing')).toBe(false);
    });

    it('flags rejected paid booking when refund is missing', () => {
        const anomalies = getBookingAnomalies({
            id: 'ac9c289d-5731-4499-ab19-9749522e0826',
            status: 'rejected',
            payment_status: 'payment_completed',
            paymentCompleted: true,
            serviceName: 'Cleaning',
            customer_refund_recorded: false,
        });

        expect(anomalies.some((item) => item.id === 'rejected-refund-missing')).toBe(true);
    });
});

describe('hasBookingCustomerRefund', () => {
    it('detects decline refund notes with short booking id', () => {
        expect(
            hasBookingCustomerRefund('7d1c7d56-3111-4e9c-b0f1-1a5285038734', [
                {
                    isCredit: true,
                    note: 'Order #7d1c7d decline refund (escrow + gateway fee)',
                    transactionId: '7d1c7d56-3111-4e9c-b0f1-1a5285038734',
                },
            ])
        ).toBe(true);
    });

    it('ignores unrelated debits', () => {
        expect(
            hasBookingCustomerRefund('ac9c289d-5731-4499-ab19-9749522e0826', [
                {
                    isCredit: false,
                    note: 'Service fee debited',
                    transactionId: 'ac9c289d-5731-4499-ab19-9749522e0826',
                },
            ])
        ).toBe(false);
    });
});
