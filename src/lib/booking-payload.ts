import type { SupabaseClient } from '@supabase/supabase-js';
import {
    computeBookingAmounts,
    resolveServiceImage,
    resolveServiceName,
    resolveServiceUnitPrice,
} from '@/lib/booking-pricing';
import { resolveInitialBookingStatus, BOOKING_PAYMENT_STATUS, type BookingPaymentMode } from '@/lib/booking-status';
import { readAuthUserId } from '@/lib/wallet-transaction-user';

export type { BookingPaymentMode };

export interface BookingAddressInput {
    address?: string;
    locality?: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
}

export interface CouponInput {
    id?: number;
    code?: string;
}

interface CustomerRow {
    id: string;
    user_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    phoneNumber?: string | null;
    mobile_number?: string | null;
    country_code?: string | null;
    countryCode?: string | null;
    wallet_amount?: number | string | null;
}

interface CouponRow {
    id: number;
    code?: string | null;
    amount?: number | null;
    minAmount?: number | null;
    active?: boolean | null;
    isFix?: boolean | null;
    expiredAt?: string | null;
}

export interface BuildBookingPayloadInput {
    customerId: string;
    serviceId: string;
    providerId: string;
    bookingDate: string;
    description?: string;
    quantity?: string;
    bookingAddress?: BookingAddressInput;
    coupon?: CouponInput | null;
    paymentMode: BookingPaymentMode;
    bookingId?: string;
}

function readField(row: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
        const value = row[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
}

function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function parseObjectValue(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'string') {
        try {
            return (JSON.parse(value) as Record<string, unknown>) ?? {};
        } catch {
            return {};
        }
    }
    if (typeof value === 'object') return value as Record<string, unknown>;
    return {};
}

async function loadAdminCommission(admin: SupabaseClient): Promise<number> {
    const { data } = await admin
        .from('settings')
        .select('data')
        .eq('id', 'admin_commission')
        .maybeSingle();

    const row = parseObjectValue((data as { data?: unknown } | null)?.data);
    const value = row.value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

async function loadExtraChargeGst(admin: SupabaseClient): Promise<boolean> {
    const { data } = await admin
        .from('app_settings')
        .select('data')
        .eq('id', 'constant')
        .maybeSingle();

    const row = parseObjectValue((data as { data?: unknown } | null)?.data);
    return row.extraChargeGst === true || row.extra_charge_gst === true;
}

async function resolveCoupon(
    admin: SupabaseClient,
    coupon?: CouponInput | null
): Promise<CouponRow | null> {
    if (!coupon) return null;

    if (coupon.id) {
        const { data } = await admin.from('coupon').select('*').eq('id', coupon.id).maybeSingle();
        return (data as CouponRow | null) ?? null;
    }

    const code = (coupon.code ?? '').trim();
    if (!code) return null;

    const { data } = await admin.from('coupon').select('*').eq('code', code).maybeSingle();
    return (data as CouponRow | null) ?? null;
}

function buildBookingAddressObject(input?: BookingAddressInput): Record<string, unknown> | null {
    if (!input) return null;
    const address = (input.address ?? '').trim();
    const locality = (input.locality ?? '').trim();
    const landmark = (input.landmark ?? '').trim();
    if (!address && !locality && !landmark) return null;

    const location =
        typeof input.latitude === 'number' && typeof input.longitude === 'number'
            ? { latitude: input.latitude, longitude: input.longitude }
            : undefined;

    return {
        address,
        locality,
        landmark,
        ...(location ? { location } : {}),
    };
}

export async function buildBookingPayload(
    admin: SupabaseClient,
    input: BuildBookingPayloadInput
): Promise<{ row: Record<string, unknown>; couponAmount: number; totalAmountNumber: number }> {
    const quantity = parseInt((input.quantity ?? '1').trim() || '1', 10);
    if (!Number.isFinite(quantity) || quantity < 1) {
        throw new Error('quantity must be at least 1');
    }

    const { data: customerRaw, error: customerError } = await admin
        .from('customer')
        .select('*')
        .eq('id', input.customerId)
        .maybeSingle();

    if (customerError) throw new Error(customerError.message);
    if (!customerRaw) throw new Error('Customer not found');

    const customer = customerRaw as CustomerRow;

    const { data: providerRaw, error: providerError } = await admin
        .from('provider')
        .select('user_id')
        .eq('id', input.providerId)
        .maybeSingle();

    if (providerError) throw new Error(providerError.message);
    if (!providerRaw) throw new Error('Provider not found');

    const providerAuthUserId = readAuthUserId((providerRaw as { user_id?: string | null }).user_id);
    if (!providerAuthUserId) {
        throw new Error('Provider is not linked to an auth account');
    }

    const customerAuthUserId = readAuthUserId(customer.user_id);

    const { data: serviceRaw, error: serviceError } = await admin
        .from('service')
        .select('*')
        .eq('id', input.serviceId)
        .eq('provider_id', input.providerId)
        .maybeSingle();

    if (serviceError) throw new Error(serviceError.message);
    if (!serviceRaw) throw new Error('Service not found for this provider');

    const service = serviceRaw as Record<string, unknown>;
    if (service.isArchived === true) throw new Error('Service is archived');
    if (service.status === false) throw new Error('Service is inactive');

    const unitPrice = resolveServiceUnitPrice(service.price);
    if (unitPrice <= 0) throw new Error('Service price is invalid');

    const discountRaw = typeof service.discount === 'string' ? service.discount : undefined;
    const couponRow = await resolveCoupon(admin, input.coupon);
    const amounts = computeBookingAmounts(unitPrice, discountRaw, quantity, couponRow);
    const adminCommission = await loadAdminCommission(admin);
    const extraChargeGst = await loadExtraChargeGst(admin);
    const now = new Date().toISOString();
    const bookingId = input.bookingId ?? crypto.randomUUID();
    const bookingAddress = buildBookingAddressObject(input.bookingAddress);

    const paymentCompleted = input.paymentMode === 'mark_paid';
    const bookingStatus = resolveInitialBookingStatus(input.paymentMode);
    const paymentType =
        input.paymentMode === 'mark_paid'
            ? 'admin'
            : input.paymentMode === 'wallet'
                ? 'wallet'
                : input.paymentMode === 'chapa'
                    ? 'chapa'
                    : '';

    const row: Record<string, unknown> = {
        id: bookingId,
        customer_id: input.customerId,
        provider_id: input.providerId,
        customer_user_id: customerAuthUserId,
        provider_user_id: providerAuthUserId,
        service_id: input.serviceId,
        firstName: readField(customer as unknown as Record<string, unknown>, ['firstName', 'first_name']),
        lastName: readField(customer as unknown as Record<string, unknown>, ['lastName', 'last_name']),
        email: readField(customer as unknown as Record<string, unknown>, ['email']),
        countryCode: readField(customer as unknown as Record<string, unknown>, ['countryCode', 'country_code']) || '+251',
        phoneNumber: readField(customer as unknown as Record<string, unknown>, ['phoneNumber', 'mobile_number', 'phone']),
        serviceName: resolveServiceName(service),
        serviceImage: resolveServiceImage(service),
        price: String(unitPrice),
        discount: amounts.discount ?? '',
        subTotal: String(amounts.subTotal),
        totalAmount: String(amounts.totalAmount),
        quantity: String(quantity),
        bookingDate: input.bookingDate || now,
        description: input.description?.trim() || '',
        status: bookingStatus,
        paymentCompleted: input.paymentMode === 'mark_paid',
        payment_status: paymentCompleted ? BOOKING_PAYMENT_STATUS.COMPLETED : BOOKING_PAYMENT_STATUS.PENDING,
        paymentType,
        postJobPayment: false,
        extraChargeGst,
        adminCommission,
        otp: generateOtp(),
        serviceDetails: service,
        createdAt: now,
        taxList: [],
    };

    if (bookingAddress) {
        row.bookingAddress = bookingAddress;
    }

    if (couponRow && amounts.couponAmount > 0) {
        row.coupon = couponRow;
    }

    if (paymentCompleted) {
        row.payment_id = crypto.randomUUID();
    }

    return {
        row,
        couponAmount: amounts.couponAmount,
        totalAmountNumber: amounts.totalAmount,
    };
}
