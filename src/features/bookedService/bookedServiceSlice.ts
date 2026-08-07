import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { hasBookingCustomerRefund, resolveBookingServiceId, resolveBookingServiceImage } from '@/lib/booking-display';
import { resolveServiceImage, resolveServiceName } from '@/lib/booking-pricing';
import { BOOKING_PAYMENT_STATUS, resolveBookingPaymentStatus, type BookedServiceStatus } from '@/lib/booking-status';
import { getSupabase } from '@/lib/supabaseClient';
import { readAuthUserId } from '@/lib/wallet-transaction-user';

export interface BookedService {
    id: string;
    provider_id: string;
    customer_id?: string | null;
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    serviceName?: string;
    service_id?: string;
    serviceImage?: string;
    price?: number;
    discount?: string;
    totalAmount?: number;
    subTotal?: number;
    quantity?: string;
    bookingDate?: string;
    createdAt?: string;
    status?:
        | 'pending'
        | 'accepted'
        | 'rejected'
        | 'on_the_way'
        | 'in_progress'
        | 'hold'
        | 'completed'
        | 'pending_extra_payment'
        | 'pending_approval'
        | 'admin_paid';
    description?: string;
    paymentCompleted?: boolean;
    payment_status?: string | null;
    paymentType?: string | null;
    payment_id?: string | null;
    providerName?: string;
    providerEmail?: string;
    providerPhone?: string;
    customerName?: string;
    customer_user_id?: string | null;
    provider_user_id?: string | null;
    customer_refund_recorded?: boolean;
    providerMySelf?: boolean;
    extraChargeAmount?: string | number | null;
    extraChargeModel?: unknown;
    coupon?: string | unknown;
    adminCommission?: string | number | null;
    bookingAddress?: unknown;
    serviceDetails?: unknown;
    otp?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    service_proof?: unknown;
    countryCode?: string | null;
    reason?: string | null;
    is_archived?: boolean | null;
    archive_note?: string | null;
}

interface BookedServiceState {
    items: BookedService[];
    loading: boolean;
    error: string | null;
    single: BookedService | null;
}

const initialState: BookedServiceState = {
    items: [],
    loading: false,
    error: null,
    single: null,
};

// DB row shape (snake_case support)
type BookedServiceRow = BookedService & { created_at?: string };

const normalizeRows = (rows: BookedServiceRow[] | null | undefined): BookedService[] =>
    (rows ?? []).map(({ created_at, ...rest }) => ({
        ...rest,
        createdAt: rest.createdAt ?? created_at,
    }));

function formatPersonName(...parts: (string | null | undefined)[]): string {
    return parts
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        .join(' ')
        .trim();
}

function resolveProviderName(raw: Record<string, unknown>): string {
    const full = formatPersonName(
        raw.firstName as string | undefined,
        raw.lastName as string | undefined,
        raw.first_name as string | undefined,
        raw.last_name as string | undefined
    );
    if (full) return full;
    if (typeof raw.userName === 'string' && raw.userName.trim()) return raw.userName.trim();
    return '';
}

function resolveCustomerName(raw: Record<string, unknown>): string {
    const full = formatPersonName(
        raw.first_name as string | undefined,
        raw.last_name as string | undefined,
        raw.firstName as string | undefined,
        raw.lastName as string | undefined
    );
    if (full) return full;
    if (typeof raw.user_name === 'string' && raw.user_name.trim()) return raw.user_name.trim();
    return '';
}

async function fetchServiceMetaById(
    serviceIds: string[]
): Promise<Map<string, { name: string; image?: string }>> {
    const map = new Map<string, { name: string; image?: string }>();
    if (serviceIds.length === 0) return map;

    const { data, error } = await getSupabase()
        .from('service')
        .select('id, serviceName, serviceImage')
        .in('id', serviceIds);
    if (error) throw error;

    for (const row of (data ?? []) as Record<string, unknown>[]) {
        const id = typeof row.id === 'string' ? row.id : '';
        if (!id) continue;
        const name = resolveServiceName(row);
        const image = resolveServiceImage(row);
        if (name || image) {
            map.set(id, { name, image });
        }
    }

    return map;
}

function bookingNeedsServiceLookup(row: BookedService): boolean {
    const bookingRecord = row as unknown as Record<string, unknown>;
    const hasName = typeof row.serviceName === 'string' && row.serviceName.trim().length > 0;
    const hasImage = Boolean(resolveBookingServiceImage(bookingRecord));
    return (!hasName || !hasImage) && resolveBookingServiceId(bookingRecord).length > 0;
}

async function enrichBookingsWithNames(rows: BookedService[]): Promise<BookedService[]> {
    if (rows.length === 0) return rows;

    const providerIds = Array.from(new Set(rows.map((row) => row.provider_id).filter(Boolean)));
    const customerIds = Array.from(
        new Set(
            rows
                .map((row) => row.customer_id)
                .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        )
    );
    const serviceIds = Array.from(
        new Set(
            rows
                .filter(bookingNeedsServiceLookup)
                .map((row) => resolveBookingServiceId(row as unknown as Record<string, unknown>))
                .filter((id) => id.length > 0)
        )
    );

    const [providersResult, customersResult, serviceMetaById] = await Promise.all([
        providerIds.length > 0
            ? getSupabase()
                  .from('provider')
                  .select('id, firstName, lastName, userName, user_id, email, phoneNumber')
                  .in('id', providerIds)
            : Promise.resolve({ data: [], error: null }),
        customerIds.length > 0
            ? getSupabase().from('customer').select('id, first_name, last_name, user_name, user_id').in('id', customerIds)
            : Promise.resolve({ data: [], error: null }),
        fetchServiceMetaById(serviceIds),
    ]);

    if (providersResult.error) throw providersResult.error;
    if (customersResult.error) throw customersResult.error;

    const providerMetaById = new Map<
        string,
        { name?: string; userId?: string; email?: string; phone?: string }
    >();
    for (const provider of (providersResult.data ?? []) as Record<string, unknown>[]) {
        const id = typeof provider.id === 'string' ? provider.id : '';
        if (!id) continue;
        const name = resolveProviderName(provider);
        const userId = typeof provider.user_id === 'string' && provider.user_id.trim() ? provider.user_id.trim() : undefined;
        const email = typeof provider.email === 'string' && provider.email.trim() ? provider.email.trim() : undefined;
        const phoneRaw =
            (typeof provider.phoneNumber === 'string' && provider.phoneNumber.trim()
                ? provider.phoneNumber.trim()
                : null) ||
            (typeof provider.phone === 'string' && provider.phone.trim() ? provider.phone.trim() : null);
        providerMetaById.set(id, {
            name: name || undefined,
            userId,
            email,
            phone: phoneRaw || undefined,
        });
    }

    const customerMetaById = new Map<string, { name?: string; userId?: string }>();
    for (const customer of (customersResult.data ?? []) as Record<string, unknown>[]) {
        const id = typeof customer.id === 'string' ? customer.id : '';
        if (!id) continue;
        const name = resolveCustomerName(customer);
        const userId = typeof customer.user_id === 'string' && customer.user_id.trim() ? customer.user_id.trim() : undefined;
        customerMetaById.set(id, { name: name || undefined, userId });
    }

    return rows.map((row) => {
        const providerMeta = providerMetaById.get(row.provider_id);
        const customerMeta = row.customer_id ? customerMetaById.get(row.customer_id) : undefined;
        const serviceId = resolveBookingServiceId(row as unknown as Record<string, unknown>);
        const serviceMeta = serviceId ? serviceMetaById.get(serviceId) : undefined;
        const serviceName = row.serviceName?.trim() || serviceMeta?.name;
        const serviceImage =
            resolveBookingServiceImage(row as unknown as Record<string, unknown>) || serviceMeta?.image || undefined;

        return {
            ...row,
            providerName: providerMeta?.name,
            providerEmail: providerMeta?.email,
            providerPhone: providerMeta?.phone,
            customerName: customerMeta?.name,
            provider_user_id: readAuthUserId(row.provider_user_id) ?? providerMeta?.userId ?? null,
            customer_user_id: readAuthUserId(row.customer_user_id) ?? customerMeta?.userId ?? null,
            ...(serviceName ? { serviceName } : {}),
            ...(serviceImage ? { serviceImage } : {}),
        };
    });
}

function isRejectedPaidBookingRow(row: BookedService): boolean {
    if (row.status !== 'rejected') return false;
    return (
        resolveBookingPaymentStatus(row.payment_status ?? '', row.paymentCompleted) ===
        BOOKING_PAYMENT_STATUS.COMPLETED
    );
}

async function enrichRejectedPaidRefundStatus(rows: BookedService[]): Promise<BookedService[]> {
    const rejectedPaid = rows.filter(isRejectedPaidBookingRow);
    if (rejectedPaid.length === 0) return rows;

    const customerAuthUserIds = Array.from(
        new Set(
            rejectedPaid
                .map((row) => readAuthUserId(row.customer_user_id))
                .filter((id): id is string => Boolean(id))
        )
    );

    if (customerAuthUserIds.length === 0) return rows;

    const { data, error } = await getSupabase()
        .from('wallet_transaction')
        .select('userId, isCredit, note, transactionId')
        .in('userId', customerAuthUserIds)
        .eq('isCredit', true);

    if (error) throw error;

    const creditsByAuthUserId = new Map<string, Array<{ isCredit?: boolean | null; note?: string | null; transactionId?: string | null }>>();
    for (const tx of (data ?? []) as Array<{
        userId?: string | null;
        isCredit?: boolean | null;
        note?: string | null;
        transactionId?: string | null;
    }>) {
        const authUserId = readAuthUserId(tx.userId);
        if (!authUserId) continue;
        const existing = creditsByAuthUserId.get(authUserId) ?? [];
        existing.push(tx);
        creditsByAuthUserId.set(authUserId, existing);
    }

    return rows.map((row) => {
        if (!isRejectedPaidBookingRow(row)) {
            return row;
        }

        const customerAuthUserId = readAuthUserId(row.customer_user_id);
        const customerCredits = customerAuthUserId ? creditsByAuthUserId.get(customerAuthUserId) ?? [] : [];
        return {
            ...row,
            customer_refund_recorded: hasBookingCustomerRefund(row.id, customerCredits),
        };
    });
}

async function enrichBookings(rows: BookedService[]): Promise<BookedService[]> {
    const withNames = await enrichBookingsWithNames(rows);
    return enrichRejectedPaidRefundStatus(withNames);
}

export function getBookingProviderDisplayName(booking: BookedService): string {
    return booking.providerName?.trim() || 'Unknown provider';
}

export function getBookingCustomerDisplayName(booking: BookedService): string {
    return (
        booking.customerName?.trim() ||
        formatPersonName(booking.firstName, booking.lastName) ||
        'Unknown customer'
    );
}

export const fetchProviderBookings = createAsyncThunk<
    BookedService[],
    { provider_id?: string; statuses?: string[]; includeArchived?: boolean },
    { rejectValue: string }
>(
    'bookedService/fetchProviderBookings',
    async ({ statuses, includeArchived = false } = {}, { rejectWithValue }) => {
        try {
            // Fetch across all providers (no provider_id filter)
            let query = getSupabase().from('booked_service').select('*');
            if (!includeArchived) {
                query = query.or('is_archived.is.null,is_archived.eq.false');
            }
            if (statuses && statuses.length) {
                query = query.in('status', statuses);
            }
            const { data, error } = await query.order('createdAt', { ascending: false });
            if (error) throw error;
            return enrichBookings(normalizeRows(data as BookedServiceRow[]));
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch bookings';
            return rejectWithValue(msg);
        }
    }
);

export const fetchAllBookings = createAsyncThunk<
    BookedService[],
    { statuses?: string[]; includeArchived?: boolean } | undefined,
    { rejectValue: string }
>(
    'bookedService/fetchAllBookings',
    async (args, { rejectWithValue }) => {
        try {
            let query = getSupabase().from('booked_service').select('*');
            if (!args?.includeArchived) {
                query = query.or('is_archived.is.null,is_archived.eq.false');
            }
            const statuses = args?.statuses;
            if (statuses && statuses.length) {
                query = query.in('status', statuses);
            }
            const { data, error } = await query.order('createdAt', { ascending: false });
            if (error) throw error;
            return enrichBookings(normalizeRows(data as BookedServiceRow[]));
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch bookings';
            return rejectWithValue(msg);
        }
    }
);

export const fetchBookingById = createAsyncThunk<
    BookedService,
    string,
    { rejectValue: string }
>(
    'bookedService/fetchBookingById',
    async (id, { rejectWithValue }) => {
        try {
            const { data, error } = await getSupabase().from('booked_service').select('*').eq('id', id).single();
            if (error) throw error;
            const [enriched] = await enrichBookings(normalizeRows([data as BookedServiceRow]));
            if (!enriched) throw new Error('Booking not found');
            return enriched;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch booking';
            return rejectWithValue(msg);
        }
    }
);

export type PaymentPath = 'pay_now' | 'pay_later' | 'wallet' | 'mark_paid';

export interface BookingAddressInput {
    address?: string;
    locality?: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
}

export interface CreateBookingInput {
    provider_id: string;
    service_id: string;
    customer_id: string;
    bookingDate?: string;
    quantity?: string;
    description?: string;
    payment_path?: PaymentPath;
    payment_mode?: PaymentPath;
    bookingAddress?: BookingAddressInput;
    coupon_id?: number;
    coupon_code?: string;
    /** Admin custom unit price (ETB); overrides catalog service price. */
    unit_price?: number;
}

interface CreateBookingResponse {
    data: BookedService;
}

interface InitBookingPaymentResponse {
    checkout_url?: string;
    tx_ref: string;
    booking_id: string;
    amount: number;
}

interface VerifyBookingPaymentResponse {
    status: string;
    message?: string;
    booking_id?: string;
}

async function parseApiError(response: Response): Promise<string> {
    const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    return payload?.error || payload?.message || `Request failed (${response.status})`;
}

export const createBooking = createAsyncThunk<
    BookedService,
    CreateBookingInput,
    { rejectValue: string }
>('bookedService/createBooking', async (input, { rejectWithValue }) => {
    try {
        const response = await fetch('/api/admin/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });

        if (!response.ok) {
            return rejectWithValue(await parseApiError(response));
        }

        const payload = (await response.json()) as CreateBookingResponse;
        return payload.data;
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to create booking';
        return rejectWithValue(msg);
    }
});

export const initiateBookingPayment = createAsyncThunk<
    InitBookingPaymentResponse,
    { bookingId: string; phone_number?: string },
    { rejectValue: string }
>('bookedService/initiateBookingPayment', async ({ bookingId, phone_number }, { rejectWithValue }) => {
    try {
        const response = await fetch('/api/admin/bookings/payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId, phone_number }),
        });

        if (!response.ok) {
            return rejectWithValue(await parseApiError(response));
        }

        return (await response.json()) as InitBookingPaymentResponse;
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to initialize payment';
        return rejectWithValue(msg);
    }
});

export const verifyBookingPayment = createAsyncThunk<
    VerifyBookingPaymentResponse,
    { bookingId: string },
    { rejectValue: string }
>('bookedService/verifyBookingPayment', async ({ bookingId }, { rejectWithValue }) => {
    try {
        const response = await fetch('/api/admin/bookings/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId }),
        });

        const payload = (await response.json()) as VerifyBookingPaymentResponse & { error?: string };

        if (!response.ok) {
            return rejectWithValue(payload.error || payload.message || `Request failed (${response.status})`);
        }

        if (payload.status === 'pending') {
            return rejectWithValue(payload.message || 'Payment not yet confirmed');
        }

        return payload;
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to verify payment';
        return rejectWithValue(msg);
    }
});

export const recollectBookingPayment = createAsyncThunk<
    { ok: true; mode: 'wallet' | 'mark_paid'; amount: number },
    { bookingId: string; mode: 'wallet' | 'mark_paid' },
    { rejectValue: string }
>('bookedService/recollectBookingPayment', async ({ bookingId, mode }, { rejectWithValue }) => {
    try {
        const response = await fetch(
            `/api/admin/bookings/${encodeURIComponent(bookingId)}/recollect-payment`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode }),
            }
        );

        const payload = (await response.json()) as {
            ok?: boolean;
            mode?: 'wallet' | 'mark_paid';
            amount?: number;
            error?: string;
        };

        if (!response.ok) {
            return rejectWithValue(payload.error || `Request failed (${response.status})`);
        }

        return {
            ok: true,
            mode: payload.mode === 'mark_paid' ? 'mark_paid' : 'wallet',
            amount: Number(payload.amount ?? 0),
        };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to re-collect payment';
        return rejectWithValue(msg);
    }
});

export const deleteBooking = createAsyncThunk<
    string,
    string,
    { rejectValue: string }
>('bookedService/deleteBooking', async (bookingId, { rejectWithValue }) => {
    try {
        const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            return rejectWithValue(await parseApiError(response));
        }

        return bookingId;
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to delete booking';
        return rejectWithValue(msg);
    }
});

export const updateBookingStatus = createAsyncThunk<
    {
        bookingId: string;
        status: BookedServiceStatus;
        provider_payout?:
            | { skipped: true; reason: string }
            | { skipped: false; amount: number; walletAmount: number }
            | null;
        provider_clawback?:
            | { skipped: true; reason: string }
            | { skipped: false; amount: number; walletAmount: number }
            | null;
        customer_refund?:
            | { skipped: true; reason: string }
            | { skipped: false; amount: number; walletAmount: number }
            | null;
    },
    { bookingId: string; status: BookedServiceStatus },
    { rejectValue: string }
>('bookedService/updateBookingStatus', async ({ bookingId, status }, { rejectWithValue }) => {
    try {
        const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });

        if (!response.ok) {
            return rejectWithValue(await parseApiError(response));
        }

        const payload = (await response.json()) as {
            provider_payout?:
                | { skipped: true; reason: string }
                | { skipped: false; amount: number; walletAmount: number }
                | null;
            provider_clawback?:
                | { skipped: true; reason: string }
                | { skipped: false; amount: number; walletAmount: number }
                | null;
            customer_refund?:
                | { skipped: true; reason: string }
                | { skipped: false; amount: number; walletAmount: number }
                | null;
        };

        return {
            bookingId,
            status,
            provider_payout: payload.provider_payout ?? null,
            provider_clawback: payload.provider_clawback ?? null,
            customer_refund: payload.customer_refund ?? null,
        };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to update booking status';
        return rejectWithValue(msg);
    }
});

const bookedServiceSlice = createSlice({
    name: 'bookedService',
    initialState,
    reducers: {
        clearSingle(state) {
            state.single = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchProviderBookings.pending, (state) => {
                // ponytail: keep rows visible while refetching (not RTK Query)
                if (state.items.length === 0) state.loading = true;
                state.error = null;
            })
            .addCase(fetchProviderBookings.fulfilled, (state, action: PayloadAction<BookedService[]>) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchProviderBookings.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to fetch bookings';
            })
            .addCase(fetchAllBookings.pending, (state) => {
                if (state.items.length === 0) state.loading = true;
                state.error = null;
            })
            .addCase(fetchAllBookings.fulfilled, (state, action: PayloadAction<BookedService[]>) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchAllBookings.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to fetch bookings';
            })
            .addCase(fetchBookingById.pending, (state, action) => {
                state.error = null;
                if (!state.single || state.single.id !== action.meta.arg) {
                    state.single = null;
                    state.loading = true;
                }
            })
            .addCase(fetchBookingById.fulfilled, (state, action: PayloadAction<BookedService>) => {
                state.loading = false;
                state.single = action.payload;
            })
            .addCase(fetchBookingById.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to fetch booking';
            })
            .addCase(createBooking.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createBooking.fulfilled, (state, action: PayloadAction<BookedService>) => {
                state.loading = false;
                state.items = [action.payload, ...state.items.filter((item) => item.id !== action.payload.id)];
            })
            .addCase(createBooking.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to create booking';
            })
            .addCase(deleteBooking.pending, (state) => {
                state.error = null;
            })
            .addCase(deleteBooking.fulfilled, (state, action: PayloadAction<string>) => {
                const deletedId = action.payload;
                state.items = state.items.filter((item) => item.id !== deletedId);
                if (state.single?.id === deletedId) {
                    state.single = null;
                }
            })
            .addCase(deleteBooking.rejected, (state, action) => {
                state.error = (action.payload as string) || 'Failed to delete booking';
            })
            .addCase(updateBookingStatus.fulfilled, (state, action) => {
                const { bookingId, status } = action.payload;
                state.items = state.items.map((item) =>
                    item.id === bookingId ? { ...item, status } : item
                );
                if (state.single?.id === bookingId) {
                    state.single = { ...state.single, status };
                }
            })
            .addCase(updateBookingStatus.rejected, (state, action) => {
                state.error = (action.payload as string) || 'Failed to update booking status';
            });
    },
});

export const { clearSingle } = bookedServiceSlice.actions;
export default bookedServiceSlice.reducer;
