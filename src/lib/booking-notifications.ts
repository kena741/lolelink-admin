import type { SupabaseClient } from '@supabase/supabase-js';
import { formatBookingJobStatusLabel } from '@/lib/booking-status';
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

function statusNotificationCopy(input: {
    status: string;
    serviceName: string;
    payoutAmount?: number;
}): {
    providerTitle: string;
    providerBody: string;
    customerTitle: string;
    customerBody: string;
    type: string;
} {
    const serviceName = input.serviceName || 'Service';
    const statusLabel = formatBookingJobStatusLabel(input.status);

    if (input.status === 'completed') {
        const payoutLabel =
            typeof input.payoutAmount === 'number' && input.payoutAmount > 0
                ? ` ETB ${input.payoutAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} was credited to your wallet.`
                : '';
        return {
            providerTitle: 'Booking Completed',
            providerBody: `Booking for ${serviceName} was marked completed by admin.${payoutLabel}`,
            customerTitle: 'Booking Completed',
            customerBody: `Your booking for ${serviceName} has been completed.`,
            type: 'booking_completed',
        };
    }

    if (input.status === 'rejected') {
        return {
            providerTitle: 'Booking Rejected',
            providerBody: `Booking for ${serviceName} was rejected by admin.`,
            customerTitle: 'Booking Rejected',
            customerBody: `Your booking for ${serviceName} was rejected.`,
            type: 'booking_rejected',
        };
    }

    if (input.status === 'accepted') {
        return {
            providerTitle: 'Booking Accepted',
            providerBody: `Booking for ${serviceName} was marked accepted by admin.`,
            customerTitle: 'Booking Accepted',
            customerBody: `Your booking for ${serviceName} has been accepted.`,
            type: 'booking_accepted',
        };
    }

    return {
        providerTitle: 'Booking Updated',
        providerBody: `Booking for ${serviceName} status is now ${statusLabel}.`,
        customerTitle: 'Booking Updated',
        customerBody: `Your booking for ${serviceName} is now ${statusLabel}.`,
        type: 'booking_status_updated',
    };
}

/** Who gets push + in-app rows for a given admin status change. */
export function defaultBookingStatusNotifyTargets(status: string): {
    notifyProvider: boolean;
    notifyCustomer: boolean;
} {
    switch (status) {
        case 'completed':
        case 'rejected':
        case 'accepted':
        case 'on_the_way':
        case 'in_progress':
        case 'hold':
        case 'pending_approval':
            return { notifyProvider: true, notifyCustomer: true };
        case 'pending':
        case 'admin_paid':
            return { notifyProvider: true, notifyCustomer: false };
        case 'pending_extra_payment':
            return { notifyProvider: false, notifyCustomer: true };
        default:
            return { notifyProvider: true, notifyCustomer: true };
    }
}

export async function sendBookingStatusUpdatedNotifications(
    admin: SupabaseClient,
    input: {
        bookingId: string;
        providerId?: string | null;
        customerId?: string | null;
        serviceName: string;
        status: string;
        payoutAmount?: number;
        notifyProvider?: boolean;
        notifyCustomer?: boolean;
    }
): Promise<void> {
    const defaults = defaultBookingStatusNotifyTargets(input.status);
    const notifyProvider = input.notifyProvider ?? defaults.notifyProvider;
    const notifyCustomer = input.notifyCustomer ?? defaults.notifyCustomer;
    const providerId = (input.providerId ?? '').trim();
    const customerId = (input.customerId ?? '').trim();

    const copy = statusNotificationCopy({
        status: input.status,
        serviceName: input.serviceName,
        payoutAmount: input.payoutAmount,
    });

    const rows = [];
    if (notifyProvider && providerId) {
        rows.push({
            title: copy.providerTitle,
            description: copy.providerBody,
            type: copy.type,
            provider_id: providerId,
            customer_id: null,
            booking_id: input.bookingId,
            is_read: false,
        });
    }
    if (notifyCustomer && customerId) {
        rows.push({
            title: copy.customerTitle,
            description: copy.customerBody,
            type: copy.type,
            provider_id: null,
            customer_id: customerId,
            booking_id: input.bookingId,
            is_read: false,
        });
    }
    if (rows.length > 0) {
        await admin.from('notification').insert(rows);
    }

    if (notifyProvider && providerId) {
        await sendProviderPush({
            serviceClient: admin,
            providerId,
            input: {
                title: copy.providerTitle,
                body: copy.providerBody,
                route: '/bookings',
                type: 'booking',
            },
        });
    }

    if (notifyCustomer && customerId) {
        await sendCustomerPush({
            serviceClient: admin,
            customerId,
            input: {
                title: copy.customerTitle,
                body: copy.customerBody,
                route: '/bookings',
                type: 'booking',
            },
        });
    }
}
