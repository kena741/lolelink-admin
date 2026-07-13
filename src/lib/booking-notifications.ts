import type { SupabaseClient } from '@supabase/supabase-js';
import { sendProviderPush } from '@/lib/push/sendProviderPush';
import { sendCustomerPush } from '@/lib/push/sendCustomerPush';

interface BookingNotificationInput {
    bookingId: string;
    providerId: string;
    customerId: string;
    serviceName: string;
    customerName: string;
    paymentPath: 'pay_now' | 'pay_later';
    notifyProvider?: boolean;
    notifyCustomer?: boolean;
}

export async function sendBookingCreatedNotifications(
    admin: SupabaseClient,
    input: BookingNotificationInput
): Promise<void> {
    const {
        bookingId,
        providerId,
        customerId,
        serviceName,
        customerName,
        paymentPath,
        notifyProvider = true,
        notifyCustomer = true,
    } = input;

    const customerDescription =
        paymentPath === 'pay_later'
            ? `Your booking for ${serviceName} has been created. Payment will be required after the provider accepts.`
            : `Your booking for ${serviceName} has been created. Complete payment to confirm the booking.`;

    const providerDescription = `New booking for ${serviceName} from ${customerName}.`;

    const rows = [];

    if (notifyProvider) {
        rows.push({
            title: 'New Booking',
            description: providerDescription,
            type: 'booking_created',
            provider_id: providerId,
            customer_id: null,
            booking_id: bookingId,
            is_read: false,
        });
    }

    if (notifyCustomer) {
        rows.push({
            title: 'Booking Created',
            description: customerDescription,
            type: 'booking_created',
            provider_id: null,
            customer_id: customerId,
            booking_id: bookingId,
            is_read: false,
        });
    }

    if (rows.length > 0) {
        await admin.from('notification').insert(rows);
    }

    if (notifyProvider) {
        await sendProviderPush({
            serviceClient: admin,
            providerId,
            input: {
                title: 'New Booking',
                body: providerDescription,
                route: '/bookings',
                type: 'booking',
            },
        });
    }

    if (notifyCustomer) {
        await sendCustomerPush({
            serviceClient: admin,
            customerId,
            input: {
                title: 'Booking Created',
                body: customerDescription,
                route: '/bookings',
                type: 'booking',
            },
        });
    }
}

export async function providerBookingNotificationExists(
    admin: SupabaseClient,
    bookingId: string,
    providerId: string
): Promise<boolean> {
    const { data, error } = await admin
        .from('notification')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('provider_id', providerId)
        .eq('type', 'booking_created')
        .limit(1);

    if (error) return false;
    return (data ?? []).length > 0;
}

export async function sendProviderNewBookingNotification(
    admin: SupabaseClient,
    input: {
        bookingId: string;
        providerId: string;
        serviceName: string;
        customerName: string;
    }
): Promise<void> {
    const { bookingId, providerId, serviceName, customerName } = input;
    const body = `New booking for ${serviceName} from ${customerName}.`;

    await admin.from('notification').insert({
        title: 'New Booking',
        description: body,
        type: 'booking_created',
        provider_id: providerId,
        customer_id: null,
        booking_id: bookingId,
        is_read: false,
    });

    await sendProviderPush({
        serviceClient: admin,
        providerId,
        input: {
            title: 'New Booking',
            body,
            route: '/bookings',
            type: 'booking',
        },
    });
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
    const providerBody = `Payment of ${amountLabel} received for ${serviceName}.`;
    const customerBody = `Your payment of ${amountLabel} for ${serviceName} has been confirmed.`;

    await admin.from('notification').insert([
        {
            title: 'Booking Payment Received',
            description: providerBody,
            type: 'booking_payment_confirmed',
            provider_id: providerId,
            customer_id: null,
            booking_id: bookingId,
            is_read: false,
        },
        {
            title: 'Payment Confirmed',
            description: customerBody,
            type: 'booking_payment_confirmed',
            provider_id: null,
            customer_id: customerId,
            booking_id: bookingId,
            is_read: false,
        },
    ]);

    await sendProviderPush({
        serviceClient: admin,
        providerId,
        input: {
            title: 'Booking Payment Received',
            body: providerBody,
            route: '/bookings',
            type: 'booking',
        },
    });

    await sendCustomerPush({
        serviceClient: admin,
        customerId,
        input: {
            title: 'Payment Confirmed',
            body: customerBody,
            route: '/bookings',
            type: 'booking',
        },
    });
}
