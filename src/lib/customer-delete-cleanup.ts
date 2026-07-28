import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Clears rows / FKs that block deleting a customer.
 * payments ↔ booked_service is cyclic; payment_id must be nulled before payments delete.
 */
export async function clearCustomerDeleteBlockers(
    admin: SupabaseClient,
    customerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
    const id = customerId.trim();
    if (!id) return { ok: false, error: 'customerId is required' };

    const { data: bookings, error: bookingsError } = await admin
        .from('booked_service')
        .select('id')
        .eq('customer_id', id);
    if (bookingsError) return { ok: false, error: bookingsError.message };

    const bookingIds = ((bookings ?? []) as Array<{ id?: string }>)
        .map((row) => (row.id ?? '').trim())
        .filter(Boolean);

    if (bookingIds.length > 0) {
        const { error: clearPaymentRefError } = await admin
            .from('booked_service')
            .update({ payment_id: null })
            .in('id', bookingIds);
        if (clearPaymentRefError) return { ok: false, error: clearPaymentRefError.message };
    }

    const { error: paymentsByCustomerError } = await admin
        .from('payments')
        .delete()
        .eq('customer_id', id);
    if (paymentsByCustomerError) return { ok: false, error: paymentsByCustomerError.message };

    if (bookingIds.length > 0) {
        const { error: paymentsByBookingError } = await admin
            .from('payments')
            .delete()
            .in('booking_id', bookingIds);
        if (paymentsByBookingError) return { ok: false, error: paymentsByBookingError.message };

        const { error: detachBookingsError } = await admin
            .from('booked_service')
            .update({ customer_id: null, customer_user_id: null })
            .in('id', bookingIds);
        if (detachBookingsError) return { ok: false, error: detachBookingsError.message };
    }

    const { error: walletError } = await admin
        .from('wallet_transaction')
        .update({ customer_id: null })
        .eq('customer_id', id);
    if (walletError) return { ok: false, error: walletError.message };

    const softDeletes: Array<{ table: string; column: string }> = [
        { table: 'notification', column: 'customer_id' },
        { table: 'provider_customer', column: 'customer_id' },
        { table: 'customers_service', column: 'customer_id' },
        { table: 'review_customer', column: 'customerId' },
        { table: 'notifications', column: 'customerId' },
    ];

    for (const { table, column } of softDeletes) {
        const { error } = await admin.from(table).delete().eq(column, id);
        // Table may not exist in every env — ignore missing-relation errors.
        if (error && !/does not exist|schema cache/i.test(error.message)) {
            return { ok: false, error: `${table}: ${error.message}` };
        }
    }

    return { ok: true };
}
