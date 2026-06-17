import type { SupabaseClient } from '@supabase/supabase-js';

interface BookingNotificationInput {
    bookingId: string;
    providerId: string;
    customerId: string;
    serviceName: string;
    customerName: string;
    paymentPath: 'pay_now' | 'pay_later';
}

export async function sendBookingCreatedNotifications(
    admin: SupabaseClient,
    input: BookingNotificationInput
): Promise<void> {
    const { bookingId, providerId, customerId, serviceName, customerName, paymentPath } = input;

    const customerDescription =
        paymentPath === 'pay_later'
            ? `Your booking for ${serviceName} has been created. Payment will be required after the provider accepts.`
            : `Your booking for ${serviceName} has been created. Complete payment in the admin session or via the customer app.`;

    const providerDescription = `New booking for ${serviceName} from ${customerName}.`;

    await admin.from('notification').insert([
        {
            title: 'New Booking',
            description: providerDescription,
            type: 'booking_created',
            provider_id: providerId,
            customer_id: null,
            booking_id: bookingId,
            is_read: false,
        },
        {
            title: 'Booking Created',
            description: customerDescription,
            type: 'booking_created',
            provider_id: null,
            customer_id: customerId,
            booking_id: bookingId,
            is_read: false,
        },
    ]);
}

export async function sendBookingPaymentConfirmedNotifications(
    admin: SupabaseClient,
    input: {
        bookingId: string;
        providerId: string;
        customerId: string;
        serviceName: string;
        amount: number;
    }
): Promise<void> {
    const { bookingId, providerId, customerId, serviceName, amount } = input;
    const amountLabel = `ETB ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    await admin.from('notification').insert([
        {
            title: 'Booking Payment Received',
            description: `Payment of ${amountLabel} received for ${serviceName}.`,
            type: 'booking_payment_confirmed',
            provider_id: providerId,
            customer_id: null,
            booking_id: bookingId,
            is_read: false,
        },
        {
            title: 'Payment Confirmed',
            description: `Your payment of ${amountLabel} for ${serviceName} has been confirmed.`,
            type: 'booking_payment_confirmed',
            provider_id: null,
            customer_id: customerId,
            booking_id: bookingId,
            is_read: false,
        },
    ]);
}
