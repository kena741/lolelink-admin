import { NextResponse } from 'next/server';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { requireAdminPermission } from '@/lib/admin-auth';
import {
    computeBookingAmounts,
    resolveServiceImage,
    resolveServiceName,
    resolveServiceUnitPrice,
} from '@/lib/booking-pricing';
import { sendBookingCreatedNotifications } from '@/lib/booking-notifications';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface CreateBookingBody {
    provider_id?: string;
    service_id?: string;
    customer_id?: string;
    bookingDate?: string;
    quantity?: string;
    description?: string;
    payment_path?: 'pay_now' | 'pay_later';
}

interface CustomerRow {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    phoneNumber?: string | null;
    mobile_number?: string | null;
}

function readCustomerField(row: CustomerRow, keys: Array<keyof CustomerRow>): string {
    for (const key of keys) {
        const value = row[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
}

function readCustomerName(row: CustomerRow): string {
    const first = readCustomerField(row, ['firstName', 'first_name']);
    const last = readCustomerField(row, ['lastName', 'last_name']);
    return [first, last].filter(Boolean).join(' ').trim();
}

export async function POST(request: Request) {
    const auth = await requireAdminPermission(request, 'bookings:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);

    try {
        const body = (await request.json()) as CreateBookingBody;
        const providerId = (body.provider_id ?? '').trim();
        const serviceId = (body.service_id ?? '').trim();
        const customerId = (body.customer_id ?? '').trim();
        const paymentPath = body.payment_path === 'pay_now' ? 'pay_now' : 'pay_later';
        const quantityRaw = (body.quantity ?? '1').trim() || '1';
        const quantity = parseInt(quantityRaw, 10);

        if (!providerId) return NextResponse.json({ error: 'provider_id is required' }, { status: 400 });
        if (!serviceId) return NextResponse.json({ error: 'service_id is required' }, { status: 400 });
        if (!customerId) return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });
        if (!Number.isFinite(quantity) || quantity < 1) {
            return NextResponse.json({ error: 'quantity must be at least 1' }, { status: 400 });
        }

        const { data: customerRaw, error: customerError } = await supabaseAdmin
            .from('customer')
            .select('*')
            .eq('id', customerId)
            .maybeSingle();

        if (customerError) {
            return NextResponse.json({ error: customerError.message }, { status: 500 });
        }
        if (!customerRaw) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        const customer = customerRaw as CustomerRow;
        const customerName = readCustomerName(customer) || 'Customer';

        const { data: serviceRaw, error: serviceError } = await supabaseAdmin
            .from('service')
            .select('*')
            .eq('id', serviceId)
            .eq('provider_id', providerId)
            .maybeSingle();

        if (serviceError) {
            return NextResponse.json({ error: serviceError.message }, { status: 500 });
        }
        if (!serviceRaw) {
            return NextResponse.json({ error: 'Service not found for this provider' }, { status: 404 });
        }

        const service = serviceRaw as Record<string, unknown>;
        if (service.isArchived === true) {
            return NextResponse.json({ error: 'Service is archived' }, { status: 400 });
        }
        if (service.status === false) {
            return NextResponse.json({ error: 'Service is inactive' }, { status: 400 });
        }

        const unitPrice = resolveServiceUnitPrice(service.price);
        if (unitPrice <= 0) {
            return NextResponse.json({ error: 'Service price is invalid' }, { status: 400 });
        }

        const discountRaw = typeof service.discount === 'string' ? service.discount : undefined;
        const amounts = computeBookingAmounts(unitPrice, discountRaw, quantity);
        const now = new Date().toISOString();
        const bookingId = crypto.randomUUID();

        const insertRow = {
            id: bookingId,
            provider_id: providerId,
            customer_id: customerId,
            firstName: readCustomerField(customer, ['firstName', 'first_name']),
            lastName: readCustomerField(customer, ['lastName', 'last_name']),
            email: readCustomerField(customer, ['email']),
            phoneNumber: readCustomerField(customer, ['phoneNumber', 'mobile_number', 'phone']),
            service_id: serviceId,
            serviceName: resolveServiceName(service),
            serviceImage: resolveServiceImage(service),
            price: unitPrice,
            discount: amounts.discount,
            subTotal: amounts.subTotal,
            totalAmount: amounts.totalAmount,
            quantity: String(quantity),
            bookingDate: body.bookingDate?.trim() || now,
            description: body.description?.trim() || null,
            status: 'booked',
            payment_status: 'pending_payment',
            paymentCompleted: false,
            createdAt: now,
        };

        const { data: created, error: insertError } = await supabaseAdmin
            .from('booked_service')
            .insert(insertRow)
            .select('*')
            .single();

        if (insertError) {
            return NextResponse.json({ error: insertError.message || 'Failed to create booking' }, { status: 500 });
        }

        await sendBookingCreatedNotifications(supabaseAdmin, {
            bookingId,
            providerId,
            customerId,
            serviceName: resolveServiceName(service) || 'Service',
            customerName,
            paymentPath,
        });

        await logAdminActivity({
            request,
            action: 'create',
            resource_type: 'booking',
            resource_id: bookingId,
            summary: `Created booking for ${customerName} (${paymentPath === 'pay_now' ? 'pay now' : 'pay later'})`,
            metadata: {
                provider_id: providerId,
                service_id: serviceId,
                customer_id: customerId,
                payment_path: paymentPath,
                total_amount: amounts.totalAmount,
            },
        });

        return NextResponse.json({ data: created });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
