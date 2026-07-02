import { BOOKING_PAYMENT_STATUS, BOOKING_STATUS } from '@/lib/booking-status';

export interface TableWritePreview {
    table: string;
    operation: 'insert' | 'upsert' | 'update';
    fields?: Record<string, unknown>;
    rows?: Record<string, unknown>[];
    skipped?: boolean;
    skip_reason?: string;
}

export interface ChapaDebugFormContext {
    providerId: string;
    serviceId: string;
    customerId: string;
    customerFirstName: string;
    customerLastName: string;
    customerEmail: string;
    customerPhone: string;
    serviceName: string;
    serviceImage: string;
    unitPrice: number;
    quantity: number;
    bookingDateIso: string;
    description: string;
    bookingAddress: {
        address: string;
        locality: string;
        landmark?: string;
    };
    couponSnapshot?: Record<string, unknown> | string | null;
    subTotal: number;
    totalAmount: number;
    discount?: string;
}

function customerDisplayName(ctx: ChapaDebugFormContext): string {
    return [ctx.customerFirstName, ctx.customerLastName].filter(Boolean).join(' ').trim() || 'Customer';
}

export function buildChapaStep1TableWrites(
    ctx: ChapaDebugFormContext,
    bookingId = '<generated uuid>'
): TableWritePreview[] {
    const serviceName = ctx.serviceName || 'Service';
    const customerName = customerDisplayName(ctx);

    return [
        {
            table: 'booked_service',
            operation: 'upsert',
            fields: {
                id: bookingId,
                provider_id: ctx.providerId,
                customer_id: ctx.customerId,
                service_id: ctx.serviceId,
                firstName: ctx.customerFirstName,
                lastName: ctx.customerLastName,
                email: ctx.customerEmail || null,
                phoneNumber: ctx.customerPhone,
                serviceName,
                serviceImage: ctx.serviceImage || null,
                price: String(ctx.unitPrice),
                discount: ctx.discount ?? '',
                subTotal: String(ctx.subTotal),
                totalAmount: String(ctx.totalAmount),
                quantity: String(ctx.quantity),
                bookingDate: ctx.bookingDateIso,
                description: ctx.description || '',
                status: BOOKING_STATUS.AWAITING_PROVIDER,
                payment_status: BOOKING_PAYMENT_STATUS.PENDING,
                paymentCompleted: false,
                paymentType: '',
                postJobPayment: false,
                bookingAddress: ctx.bookingAddress,
                coupon: ctx.couponSnapshot ?? null,
                serviceDetails: '<full service row snapshot>',
                otp: '<6-digit generated>',
                taxList: [],
            },
        },
        {
            table: 'notification',
            operation: 'insert',
            rows: [
                {
                    title: 'Booking Created',
                    description: `Your booking for ${serviceName} has been created. Complete payment to confirm the booking.`,
                    type: 'booking_created',
                    provider_id: null,
                    customer_id: ctx.customerId,
                    booking_id: bookingId,
                    is_read: false,
                },
            ],
        },
        {
            table: 'notification',
            operation: 'insert',
            skipped: true,
            skip_reason: 'Provider booking_created notification deferred until Chapa payment completes.',
            fields: {
                title: 'New Booking',
                description: `New booking for ${serviceName} from ${customerName}.`,
                type: 'booking_created',
                provider_id: ctx.providerId,
                customer_id: null,
                booking_id: bookingId,
                is_read: false,
            },
        },
    ];
}

export function buildChapaStep2TableWrites(
    ctx: ChapaDebugFormContext,
    bookingId = '<id from step 1>',
    paymentId = '<generated uuid>',
    txRef = 'bkg-<booking>-<timestamp>'
): TableWritePreview[] {
    return [
        {
            table: 'booked_service',
            operation: 'update',
            fields: {
                id: bookingId,
                payment_id: paymentId,
                paymentType: 'chapa',
            },
        },
        {
            table: 'payments',
            operation: 'upsert',
            fields: {
                id: paymentId,
                booking_id: bookingId,
                customer_id: ctx.customerId,
                amount: ctx.totalAmount,
                currency: 'ETB',
                status: BOOKING_PAYMENT_STATUS.PENDING,
                payment_method: 'chapa',
                provider: 'chapa',
                provider_ref: txRef,
            },
        },
    ];
}

export function buildChapaStep3TableWrites(
    ctx: ChapaDebugFormContext,
    bookingId = '<id from step 1>',
    paymentId = '<payment uuid from step 2>',
    txRef = '<chapa tx_ref>',
    _chapaReference = '<chapa reference from verify>'
): TableWritePreview[] {
    void _chapaReference;
    const serviceName = ctx.serviceName || 'Service';
    const customerName = customerDisplayName(ctx);
    const amountLabel = `ETB ${ctx.totalAmount.toFixed(2)}`;

    return [
        {
            table: 'booked_service',
            operation: 'update',
            fields: {
                id: bookingId,
                payment_status: BOOKING_PAYMENT_STATUS.COMPLETED,
                paymentCompleted: true,
                payment_id: paymentId,
                paymentType: 'chapa',
            },
        },
        {
            table: 'payments',
            operation: 'update',
            fields: {
                booking_id: bookingId,
                status: BOOKING_PAYMENT_STATUS.COMPLETED,
                provider_ref: txRef,
                payment_method: 'chapa',
                provider: 'chapa',
            },
        },
        {
            table: 'notification',
            operation: 'insert',
            rows: [
                {
                    title: 'Booking Payment Received',
                    description: `Payment of ${amountLabel} received for ${serviceName}.`,
                    type: 'booking_payment_confirmed',
                    provider_id: ctx.providerId,
                    customer_id: null,
                    booking_id: bookingId,
                    is_read: false,
                },
                {
                    title: 'Payment Confirmed',
                    description: `Your payment of ${amountLabel} for ${serviceName} has been confirmed.`,
                    type: 'booking_payment_confirmed',
                    provider_id: null,
                    customer_id: ctx.customerId,
                    booking_id: bookingId,
                    is_read: false,
                },
            ],
        },
        {
            table: 'notification',
            operation: 'insert',
            fields: {
                title: 'New Booking',
                description: `New booking for ${serviceName} from ${customerName}.`,
                type: 'booking_created',
                provider_id: ctx.providerId,
                customer_id: null,
                booking_id: bookingId,
                is_read: false,
            },
            skip_reason: 'Only if provider was not notified yet (first successful payment).',
        },
    ];
}
