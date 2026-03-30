import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabaseClient';

export interface PayoutRequest {
    id: string;
    providerId: string;
    provider_name?: string;
    note?: string;
    adminNote?: string;
    amount: string | number;
    paymentStatus: 'pending' | 'approved' | 'rejected' | 'completed';
    createdDate?: string;
    paymentDate?: string;
    bankDetails?: {
        bankName?: string;
        bankCode?: string;
        accountNumber?: string;
        holderName?: string;
        swiftCode?: string;
        branchCity?: string;
        branchCountry?: string;
    } | null;
}

interface PayoutRequestState {
    requests: PayoutRequest[];
    loading: boolean;
    error: string | null;
    bookingPayoutStatus: Record<string, boolean>;
    bookingPayoutLoading: boolean;
}

const initialState: PayoutRequestState = {
    requests: [],
    loading: false,
    error: null,
    bookingPayoutStatus: {},
    bookingPayoutLoading: false,
};

interface BookingPaymentRow {
    id: string;
    provider_id: string;
    totalAmount?: number;
    price?: number;
    paymentCompleted?: boolean;
    payment_status?: string;
    status?: string;
}

interface WalletTransactionRow {
    id: string;
}

interface BookingPayoutStatusPayload {
    bookingId: string;
    isProcessed: boolean;
}

interface ProcessBookingPayoutPayload {
    bookingId: string;
    processed: boolean;
}

// DB row shape from withdrawal_history table
type WithdrawalHistoryRow = {
    id: string;
    providerId: string;
    note?: string;
    adminNote?: string;
    amount: string;
    paymentStatus?: string;
    createdDate?: string;
    paymentDate?: string;
};

function normalizePaymentStatus(value?: string): 'pending' | 'approved' | 'rejected' | 'completed' {
    const normalized = (value ?? '').toString().trim().toLowerCase();
    if (normalized === 'approved') return 'approved';
    if (normalized === 'rejected') return 'rejected';
    if (normalized === 'completed') return 'completed';
    return 'pending';
}

type BankDetailsRow = {
    providerID?: string;
    bankName?: string;
    bankCode?: string;
    accountNumber?: string;
    holderName?: string;
    swiftCode?: string;
    branchCity?: string;
    branchCountry?: string;
};

interface ProviderPaymentMethodRow {
    id: string;
    providerID: string;
    method_type?: string;
    method_code?: string;
    method_name?: string;
    holderName?: string;
    accountNumber?: string;
    swiftCode?: string;
    bankName?: string;
    branchCity?: string;
    branchCountry?: string;
    is_active?: boolean;
    is_default?: boolean;
    currency?: string;
}

function toErrorMessage(value: unknown, fallback: string): string {
    if (typeof value === 'string' && value.trim())
        return value;
    if (value && typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return fallback;
        }
    }
    return fallback;
}

async function createPayoutNotification(payload: {
    title: string;
    description: string;
    type: string;
    provider_id?: string;
    action_url?: string;
    dedupe_key?: string;
}): Promise<void> {
    await fetch('/api/payout/create-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
}

function normalizeProviderId(value: string | undefined): string {
    return (value || '').trim();
}

function toBankDetails(bank: BankDetailsRow): PayoutRequest['bankDetails'] {
    return {
        bankName: bank.bankName,
        bankCode: bank.bankCode,
        accountNumber: bank.accountNumber,
        holderName: bank.holderName,
        swiftCode: bank.swiftCode,
        branchCity: bank.branchCity,
        branchCountry: bank.branchCountry,
    };
}

function addBankToMap(
    bankMap: Record<string, PayoutRequest['bankDetails']>,
    bank: BankDetailsRow
): void {
    const details = toBankDetails(bank);
    const keys = [normalizeProviderId(bank.providerID)].filter(Boolean);
    keys.forEach((key) => {
        bankMap[key] = details;
    });
}

function toBankDetailsFromPaymentMethod(method: ProviderPaymentMethodRow): BankDetailsRow {
    return {
        providerID: method.providerID,
        bankName: method.bankName || method.method_name,
        bankCode: method.method_code,
        accountNumber: method.accountNumber,
        holderName: method.holderName,
        swiftCode: method.swiftCode,
        branchCity: method.branchCity,
        branchCountry: method.branchCountry,
    };
}

// Provider payment methods are fetched from a server endpoint
// to avoid client-side RLS restrictions.

async function fetchPaymentMethodsByProviderIds(providerIds: string[]): Promise<Record<string, BankDetailsRow | null>> {
    const response = await fetch('/api/payout/provider-payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerIds }),
    });

    const payload = (await response.json()) as {
        error?: unknown;
        data?: Record<string, BankDetailsRow | null>;
    };

    if (!response.ok)
        throw new Error(toErrorMessage(payload.error, 'Failed to fetch provider payment methods'));

    return payload.data || {};
}

const normalizeRows = (
    rows: WithdrawalHistoryRow[] | null | undefined,
    providerMap: Record<string, string>,
    bankMap: Record<string, PayoutRequest['bankDetails']>
): PayoutRequest[] =>
    (rows ?? []).map((row) => ({
        id: row.id,
        providerId: normalizeProviderId(row.providerId),
        provider_name: providerMap[normalizeProviderId(row.providerId)] || 'Unknown Provider',
        note: row.note,
        adminNote: row.adminNote,
        amount: row.amount,
        paymentStatus: normalizePaymentStatus(row.paymentStatus),
        createdDate: row.createdDate,
        paymentDate: row.paymentDate,
        bankDetails: bankMap[normalizeProviderId(row.providerId)] || null,
    }));

export const fetchPayoutRequests = createAsyncThunk<
    PayoutRequest[],
    void,
    { rejectValue: string }
>(
    'payout/fetchPayoutRequests',
    async (_, { rejectWithValue }) => {
        try {
            // Fetch withdrawal history
            const { data: withdrawalData, error: withdrawalError } = await supabase
                .from('withdrawal_history')
                .select('*')
                .order('createdDate', { ascending: false });

            if (withdrawalError) throw withdrawalError;

            // Get unique provider IDs
            const providerIds = [...new Set((withdrawalData || []).map((row: WithdrawalHistoryRow) => normalizeProviderId(row.providerId)).filter(Boolean))];
            
            // Fetch provider info using providerId == id from providers table
            const providerMap: Record<string, string> = {};
            const bankMap: Record<string, PayoutRequest['bankDetails']> = {};
            if (providerIds.length > 0) {
                const { data: providers, error: providerError } = await supabase
                    .from('provider')
                    .select('id, firstName, lastName')
                    .in('id', providerIds);

                if (!providerError && providers) {
                    providers.forEach((provider: { id: string; firstName?: string; lastName?: string }) => {
                        const first = provider.firstName;
                        const last = provider.lastName;
                        const full = [first, last].filter(Boolean).join(' ');
                        providerMap[normalizeProviderId(provider.id)] = full || 'Unknown Provider';
                    });
                }

                const methodsByProviderId = await fetchPaymentMethodsByProviderIds(providerIds);
                Object.entries(methodsByProviderId).forEach(([providerId, method]) => {
                    if (!method) return;
                    addBankToMap(bankMap, { ...method, providerID: providerId });
                });
            }

            return normalizeRows(withdrawalData as WithdrawalHistoryRow[], providerMap, bankMap);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch payout requests';
            return rejectWithValue(msg);
        }
    }
);

export const approvePayoutRequest = createAsyncThunk<
    PayoutRequest,
    { id: string; adminNote?: string },
    { rejectValue: string }
>(
    'payout/approvePayoutRequest',
    async ({ id, adminNote }, { rejectWithValue }) => {
        try {
            const updateData: { paymentStatus: string; paymentDate: string; adminNote?: string } = { 
                paymentStatus: 'approved',
                paymentDate: new Date().toISOString()
            };
            
            if (adminNote) {
                updateData.adminNote = adminNote;
            }

            const { data, error } = await supabase
                .from('withdrawal_history')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            await createPayoutNotification({
                title: 'Withdrawal approved',
                description: `Withdrawal ${id} was approved.`,
                type: 'payout_approved',
                provider_id: (data as WithdrawalHistoryRow).providerId,
                action_url: '/admin/finance/payout-request',
                dedupe_key: `payout_approved:${id}`,
            });

            const providerMap: Record<string, string> = {};
            const bankMap: Record<string, PayoutRequest['bankDetails']> = {};
            if (data.providerId) {
                const { data: provider, error: providerError } = await supabase
                    .from('provider')
                    .select('id, firstName, lastName')
                    .eq('id', data.providerId)
                    .single();
                
                if (!providerError && provider) {
                    const first = provider.firstName;
                    const last = provider.lastName;
                    const full = [first, last].filter(Boolean).join(' ');
                    providerMap[provider.id] = full || 'Unknown Provider';
                }

                const { data: bank, error: bankError } = await supabase
                    .from('provider_payment_methods')
                    .select('*')
                    .eq('providerID', data.providerId)
                    .eq('is_active', true)
                    .order('is_default', { ascending: false })
                    .order('updated_at', { ascending: false })
                    .maybeSingle();
                if (!bankError && bank) addBankToMap(bankMap, toBankDetailsFromPaymentMethod(bank as ProviderPaymentMethodRow));
            }

            return normalizeRows([data as WithdrawalHistoryRow], providerMap, bankMap)[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to approve payout request';
            return rejectWithValue(msg);
        }
    }
);

export const rejectPayoutRequest = createAsyncThunk<
    PayoutRequest,
    { id: string; adminNote?: string },
    { rejectValue: string }
>(
    'payout/rejectPayoutRequest',
    async ({ id, adminNote }, { rejectWithValue }) => {
        try {
            const updateData: { paymentStatus: string; adminNote?: string } = { 
                paymentStatus: 'rejected'
            };
            
            if (adminNote) {
                updateData.adminNote = adminNote;
            }

            const { data, error } = await supabase
                .from('withdrawal_history')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            await createPayoutNotification({
                title: 'Withdrawal rejected',
                description: `Withdrawal ${id} was rejected.`,
                type: 'payout_rejected',
                provider_id: (data as WithdrawalHistoryRow).providerId,
                action_url: '/admin/finance/payout-request',
                dedupe_key: `payout_rejected:${id}`,
            });

            const providerMap: Record<string, string> = {};
            const bankMap: Record<string, PayoutRequest['bankDetails']> = {};
            if (data.providerId) {
                const { data: provider, error: providerError } = await supabase
                    .from('provider')
                    .select('id, firstName, lastName')
                    .eq('id', data.providerId)
                    .single();
                
                if (!providerError && provider) {
                    const first = provider.firstName;
                    const last = provider.lastName;
                    const full = [first, last].filter(Boolean).join(' ');
                    providerMap[provider.id] = full || 'Unknown Provider';
                }

                const { data: bank, error: bankError } = await supabase
                    .from('provider_payment_methods')
                    .select('*')
                    .eq('providerID', data.providerId)
                    .eq('is_active', true)
                    .order('is_default', { ascending: false })
                    .order('updated_at', { ascending: false })
                    .maybeSingle();
                if (!bankError && bank) addBankToMap(bankMap, toBankDetailsFromPaymentMethod(bank as ProviderPaymentMethodRow));
            }

            return normalizeRows([data as WithdrawalHistoryRow], providerMap, bankMap)[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to reject payout request';
            return rejectWithValue(msg);
        }
    }
);

export const completePayoutRequest = createAsyncThunk<
    PayoutRequest,
    { id: string; adminNote?: string },
    { rejectValue: string }
>(
    'payout/completePayoutRequest',
    async ({ id, adminNote }, { rejectWithValue }) => {
        try {
            const updateData: { paymentStatus: string; paymentDate: string; adminNote?: string } = {
                paymentStatus: 'completed',
                paymentDate: new Date().toISOString(),
            };

            if (adminNote)
                updateData.adminNote = adminNote;

            const { data, error } = await supabase
                .from('withdrawal_history')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            await createPayoutNotification({
                title: 'Withdrawal completed',
                description: `Withdrawal ${id} was marked completed.`,
                type: 'payout_completed',
                provider_id: (data as WithdrawalHistoryRow).providerId,
                action_url: '/admin/finance/payout-request',
                dedupe_key: `payout_completed:${id}`,
            });

            const providerMap: Record<string, string> = {};
            const bankMap: Record<string, PayoutRequest['bankDetails']> = {};
            if (data.providerId) {
                const { data: provider, error: providerError } = await supabase
                    .from('provider')
                    .select('id, firstName, lastName')
                    .eq('id', data.providerId)
                    .single();

                if (!providerError && provider) {
                    const first = provider.firstName;
                    const last = provider.lastName;
                    const full = [first, last].filter(Boolean).join(' ');
                    providerMap[provider.id] = full || 'Unknown Provider';
                }

                const { data: bank, error: bankError } = await supabase
                    .from('provider_payment_methods')
                    .select('*')
                    .eq('providerID', data.providerId)
                    .eq('is_active', true)
                    .order('is_default', { ascending: false })
                    .order('updated_at', { ascending: false })
                    .maybeSingle();
                if (!bankError && bank) addBankToMap(bankMap, toBankDetailsFromPaymentMethod(bank as ProviderPaymentMethodRow));
            }

            return normalizeRows([data as WithdrawalHistoryRow], providerMap, bankMap)[0];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to complete payout request';
            return rejectWithValue(msg);
        }
    }
);

export const sendPayoutViaChapa = createAsyncThunk<
    {
        id: string;
        txRef: string;
        transferId: string;
        message: string;
        sourceAccount: string;
        destinationProviderName: string;
        destinationBankName: string;
        destinationAccountNumber: string;
        amount: string;
    },
    { id: string },
    { rejectValue: string }
>(
    'payout/sendPayoutViaChapa',
    async ({ id }, { rejectWithValue }) => {
        try {
            const response = await fetch('/api/payout/chapa-transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ withdrawalId: id }),
            });

            const payload = (await response.json()) as {
                error?: unknown;
                tx_ref?: string;
                transfer_id?: string;
                message?: string;
                source?: {
                    account?: string;
                };
                destination?: {
                    provider_name?: string;
                    bank_name?: string;
                    account_number?: string;
                };
                amount?: string;
            };

            if (!response.ok)
                return rejectWithValue(toErrorMessage(payload.error, 'Failed to send payout via Chapa'));

            return {
                id,
                txRef: payload.tx_ref || '',
                transferId: payload.transfer_id || '',
                message: payload.message || 'Chapa payout transfer completed',
                sourceAccount: payload.source?.account || 'Platform Chapa Account',
                destinationProviderName: payload.destination?.provider_name || 'Provider',
                destinationBankName: payload.destination?.bank_name || '',
                destinationAccountNumber: payload.destination?.account_number || '',
                amount: payload.amount || '',
            };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to send payout via Chapa';
            return rejectWithValue(msg);
        }
    }
);

export const fetchBookingPayoutStatus = createAsyncThunk<
    BookingPayoutStatusPayload,
    { bookingId: string },
    { rejectValue: string }
>(
    'payout/fetchBookingPayoutStatus',
    async ({ bookingId }, { rejectWithValue }) => {
        try {
            const transactionId = `provider-payout:${bookingId}`;
            const { data, error } = await supabase
                .from('wallet_transaction')
                .select('id')
                .eq('transactionId', transactionId)
                .eq('type', 'provider_payout')
                .maybeSingle();

            if (error) throw error;
            return {
                bookingId,
                isProcessed: Boolean((data as WalletTransactionRow | null)?.id),
            };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch booking payout status';
            return rejectWithValue(msg);
        }
    }
);

export const processBookingPayout = createAsyncThunk<
    ProcessBookingPayoutPayload,
    { bookingId: string },
    { rejectValue: string }
>(
    'payout/processBookingPayout',
    async ({ bookingId }, { rejectWithValue }) => {
        try {
            const { data: bookingData, error: bookingError } = await supabase
                .from('booked_service')
                .select('id, provider_id, totalAmount, price, paymentCompleted, payment_status, status')
                .eq('id', bookingId)
                .single();

            if (bookingError) throw bookingError;
            const booking = bookingData as BookingPaymentRow;

            const normalizedBookingStatus = (booking.status ?? '').toString().trim().toLowerCase();
            const isCompleted =
                normalizedBookingStatus === 'completed' ||
                normalizedBookingStatus === 'service_completion_approved_by_customer';
            if (!isCompleted) return rejectWithValue('Booking is not completed yet');

            const isCustomerPaymentDone =
                booking.paymentCompleted === true ||
                (booking.payment_status ?? '').toString().trim().toLowerCase() === 'payment_completed' ||
                [
                    'paid_for_service_booked',
                    'service_started',
                    'service_completion_approval',
                    'service_completion_approved_by_customer',
                    'completed',
                ].includes(normalizedBookingStatus);
            if (!isCustomerPaymentDone) return rejectWithValue('Customer payment is not completed yet');

            if (!booking.provider_id) return rejectWithValue('Provider is missing for this booking');

            const transactionId = `provider-payout:${bookingId}`;
            const { data: existing, error: existingError } = await supabase
                .from('wallet_transaction')
                .select('id')
                .eq('transactionId', transactionId)
                .eq('type', 'provider_payout')
                .maybeSingle();

            if (existingError) throw existingError;
            if ((existing as WalletTransactionRow | null)?.id) {
                return { bookingId, processed: true };
            }

            const payoutAmount = Number(booking.totalAmount ?? booking.price ?? 0);
            if (payoutAmount <= 0) return rejectWithValue('Invalid payout amount');

            const { error: insertError } = await supabase.from('wallet_transaction').insert({
                amount: payoutAmount.toFixed(2),
                createdDate: new Date().toISOString(),
                isCredit: true,
                note: `Payout for booking ${bookingId}`,
                paymentType: 'wallet_topup',
                transactionId,
                type: 'provider_payout',
                userId: booking.provider_id,
            });

            if (insertError) throw insertError;
            return { bookingId, processed: true };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to process booking payout';
            return rejectWithValue(msg);
        }
    }
);

const payoutSlice = createSlice({
    name: 'payout',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchPayoutRequests.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPayoutRequests.fulfilled, (state, action: PayloadAction<PayoutRequest[]>) => {
                state.loading = false;
                state.requests = action.payload;
            })
            .addCase(fetchPayoutRequests.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to fetch payout requests';
            })
            .addCase(approvePayoutRequest.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(approvePayoutRequest.fulfilled, (state, action: PayloadAction<PayoutRequest>) => {
                state.loading = false;
                const index = state.requests.findIndex(req => req.id === action.payload.id);
                if (index !== -1) {
                    state.requests[index] = action.payload;
                }
            })
            .addCase(approvePayoutRequest.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to approve payout request';
            })
            .addCase(rejectPayoutRequest.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(rejectPayoutRequest.fulfilled, (state, action: PayloadAction<PayoutRequest>) => {
                state.loading = false;
                const index = state.requests.findIndex(req => req.id === action.payload.id);
                if (index !== -1) {
                    state.requests[index] = action.payload;
                }
            })
            .addCase(rejectPayoutRequest.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to reject payout request';
            })
            .addCase(completePayoutRequest.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(completePayoutRequest.fulfilled, (state, action: PayloadAction<PayoutRequest>) => {
                state.loading = false;
                const index = state.requests.findIndex(req => req.id === action.payload.id);
                if (index !== -1) {
                    state.requests[index] = action.payload;
                }
            })
            .addCase(completePayoutRequest.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to complete payout request';
            })
            .addCase(sendPayoutViaChapa.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(sendPayoutViaChapa.fulfilled, (state, action) => {
                state.loading = false;
                const index = state.requests.findIndex(req => req.id === action.payload.id);
                if (index !== -1 && state.requests[index].paymentStatus === 'approved')
                    state.requests[index].adminNote = [
                        state.requests[index].adminNote,
                        action.payload.txRef ? `Chapa transfer reference: ${action.payload.txRef}` : undefined,
                    ]
                        .filter(Boolean)
                        .join('\n');
            })
            .addCase(sendPayoutViaChapa.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to send payout via Chapa';
            })
            .addCase(fetchBookingPayoutStatus.pending, (state) => {
                state.bookingPayoutLoading = true;
            })
            .addCase(fetchBookingPayoutStatus.fulfilled, (state, action: PayloadAction<BookingPayoutStatusPayload>) => {
                state.bookingPayoutLoading = false;
                state.bookingPayoutStatus[action.payload.bookingId] = action.payload.isProcessed;
            })
            .addCase(fetchBookingPayoutStatus.rejected, (state, action) => {
                state.bookingPayoutLoading = false;
                state.error = (action.payload as string) || 'Failed to fetch booking payout status';
            })
            .addCase(processBookingPayout.pending, (state) => {
                state.bookingPayoutLoading = true;
                state.error = null;
            })
            .addCase(processBookingPayout.fulfilled, (state, action: PayloadAction<ProcessBookingPayoutPayload>) => {
                state.bookingPayoutLoading = false;
                state.bookingPayoutStatus[action.payload.bookingId] = action.payload.processed;
            })
            .addCase(processBookingPayout.rejected, (state, action) => {
                state.bookingPayoutLoading = false;
                state.error = (action.payload as string) || 'Failed to process booking payout';
            });
    },
});

export default payoutSlice.reducer;

