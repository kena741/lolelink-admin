import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getSupabase } from '@/lib/supabaseClient';
import { logClientAdminActivity } from '@/lib/record-admin-activity';

interface ApproveServicesState {
    loading: boolean;
    error: string | null;
    success: boolean;
    updatedCount: number;
    services: unknown[];
}

const initialState: ApproveServicesState = {
    loading: false,
    error: null,
    success: false,
    updatedCount: 0,
    services: [],
};

function resolveProviderName(raw: Record<string, unknown>): string {
    const first =
        (typeof raw.firstName === 'string' && raw.firstName) ||
        (typeof raw.first_name === 'string' && raw.first_name) ||
        '';
    const last =
        (typeof raw.lastName === 'string' && raw.lastName) ||
        (typeof raw.last_name === 'string' && raw.last_name) ||
        '';
    const full = [first, last].filter(Boolean).join(' ').trim();
    if (full) return full;
    if (typeof raw.userName === 'string' && raw.userName.trim()) return raw.userName.trim();
    return '';
}

function parseFeaturedServiceIdFromNote(note: string): string | null {
    const match = note.match(/service[=:\s]+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    return match?.[1]?.toLowerCase() ?? null;
}

function isFeaturedRequestPaymentNote(note: string): boolean {
    const normalized = note.toLowerCase();
    return (
        normalized.includes('featured request')
        || normalized.includes('featured post')
        || normalized.includes('featured psot')
        || (normalized.includes('featured') && normalized.includes('payment'))
    );
}

// Fetch services (non-archived)
export const fetchServices = createAsyncThunk<unknown[], void, { rejectValue: string }>(
    'service/fetchServices',
    async (_, thunkAPI) => {
        try {
            const { data, error } = await getSupabase()
                .from('service')
                .select('*')
                .eq('status', true)
                .neq('isArchived', true);

            if (error) return thunkAPI.rejectWithValue(error.message || 'Failed to fetch services');
            const rows = (data || []) as Array<Record<string, unknown>>;

            const providerIds = Array.from(
                new Set(
                    rows
                        .map((r) => (typeof r.provider_id === 'string' ? r.provider_id : ''))
                        .filter(Boolean)
                )
            );

            if (providerIds.length === 0) return rows as unknown[];

            const { data: providers, error: providerError } = await getSupabase()
                .from('provider')
                .select('id, firstName, lastName, userName, location')
                .in('id', providerIds);

            if (providerError) {
                return thunkAPI.rejectWithValue(providerError.message || 'Failed to fetch providers');
            }

            const providerById = new Map<string, { name: string; location: Record<string, unknown> | null }>();
            for (const p of (providers || []) as Array<Record<string, unknown>>) {
                const id = typeof p.id === 'string' ? p.id : '';
                if (!id) continue;
                const location =
                    p.location && typeof p.location === 'object'
                        ? (p.location as Record<string, unknown>)
                        : null;
                providerById.set(id, {
                    name: resolveProviderName(p),
                    location,
                });
            }

            const enriched = rows.map((r) => {
                const pid = typeof r.provider_id === 'string' ? r.provider_id : '';
                const provider = pid ? providerById.get(pid) : undefined;
                return {
                    ...r,
                    providerName: provider?.name ?? '',
                    providerLocation: provider?.location ?? null,
                };
            });

            const pendingFeatureIds = new Set(
                enriched
                    .filter((r) => String(r.feature_requested_status ?? '').toLowerCase() === 'pending')
                    .map((r) => (typeof r.id === 'string' ? r.id.toLowerCase() : ''))
                    .filter(Boolean)
            );

            if (pendingFeatureIds.size === 0) return enriched as unknown[];

            // ponytail: scan recent featured wallet notes; tighten to service-id index if volume grows
            const { data: walletRows, error: walletError } = await getSupabase()
                .from('wallet_transaction')
                .select('note, amount, createdDate, transactionId')
                .or(
                    'note.ilike.%featured request%,note.ilike.%featured post%,note.ilike.%featured psot%,note.ilike.%featured%payment%'
                )
                .order('createdDate', { ascending: false })
                .limit(500);

            if (walletError) {
                return thunkAPI.rejectWithValue(walletError.message || 'Failed to fetch featured payments');
            }

            const paidByServiceId = new Map<string, { amount: string | null; transactionId: string | null }>();
            for (const row of (walletRows ?? []) as Array<Record<string, unknown>>) {
                const note = typeof row.note === 'string' ? row.note : '';
                if (!isFeaturedRequestPaymentNote(note)) continue;
                let serviceId = parseFeaturedServiceIdFromNote(note);
                if (!serviceId) {
                    for (const pendingId of pendingFeatureIds) {
                        if (note.toLowerCase().includes(pendingId)) {
                            serviceId = pendingId;
                            break;
                        }
                    }
                }
                if (!serviceId || !pendingFeatureIds.has(serviceId) || paidByServiceId.has(serviceId)) continue;
                paidByServiceId.set(serviceId, {
                    amount: typeof row.amount === 'string' ? row.amount : row.amount != null ? String(row.amount) : null,
                    transactionId: typeof row.transactionId === 'string' ? row.transactionId : null,
                });
            }

            return enriched.map((r) => {
                const id = typeof r.id === 'string' ? r.id.toLowerCase() : '';
                const paid = id ? paidByServiceId.get(id) : undefined;
                return {
                    ...r,
                    featureRequestPaid: Boolean(paid),
                    featureRequestPaidAmount: paid?.amount ?? null,
                    featureRequestTransactionId: paid?.transactionId ?? null,
                };
            }) as unknown[];
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unexpected error';
            return thunkAPI.rejectWithValue(msg);
        }
    }
);

// Fetch all non-archived services and set approved = true for them
// Approve all services for a given provider id
export const approveServicesByProvider = createAsyncThunk<number, string, { rejectValue: string }>(
    'service/approveServicesByProvider',
    async (providerId, thunkAPI) => {
        try {
            if (!providerId) return thunkAPI.rejectWithValue('Missing provider id');

            // fetch ids of services for this provider that are not archived and not already approved
            const { data: services, error: fetchError } = await getSupabase()
                .from('service')
                .select('id, approved')
                .eq('provider_id', providerId)
                .neq('isArchived', true);

            if (fetchError) return thunkAPI.rejectWithValue(fetchError.message || 'Failed to fetch services');

            type ServiceRow = { id?: string; approved?: boolean };
            const ids = (services || [])
                .filter((s: ServiceRow) => s && s.id && s.approved !== true)
                .map((s: ServiceRow) => s.id as string);

            if (ids.length === 0) {
                return 0; // nothing to update
            }

            const { error: updateError } = await getSupabase()
                .from('service')
                .update({ approved: true })
                .in('id', ids);

            if (updateError) return thunkAPI.rejectWithValue(updateError.message || 'Failed to approve services');

            const logged = await logClientAdminActivity({
                action: 'approve',
                resource_type: 'service',
                resource_id: providerId,
                summary: `Approved ${ids.length} service(s) for provider ${providerId}`,
                metadata: { service_ids: ids },
            });
            if (!logged) return thunkAPI.rejectWithValue('Services approved, but failed to write admin activity log');

            return ids.length;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unexpected error';
            return thunkAPI.rejectWithValue(msg);
        }
    }
);

// Approve a single service by id
export const approveServiceById = createAsyncThunk<number, string, { rejectValue: string }>(
    'service/approveServiceById',
    async (serviceId, thunkAPI) => {
        try {
            if (!serviceId) return thunkAPI.rejectWithValue('Missing service id');

            const { error: updateError } = await getSupabase()
                .from('service')
                .update({ approved: true })
                .eq('id', serviceId);

            if (updateError) return thunkAPI.rejectWithValue(updateError.message || 'Failed to approve service');

            const logged = await logClientAdminActivity({
                action: 'approve',
                resource_type: 'service',
                resource_id: serviceId,
                summary: `Approved service ${serviceId}`,
            });
            if (!logged) return thunkAPI.rejectWithValue('Service approved, but failed to write admin activity log');

            return 1;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unexpected error';
            return thunkAPI.rejectWithValue(msg);
        }
    }
);

export const approveFeatureRequestById = createAsyncThunk<number, string, { rejectValue: string }>(
    'service/approveFeatureRequestById',
    async (serviceId, thunkAPI) => {
        try {
            if (!serviceId) return thunkAPI.rejectWithValue('Missing service id');

            const payload = {
                feature: true,
                feature_requested_status: 'accepted',
            };

            const tryUpdate = async (tableName: string) => {
                const { error } = await getSupabase()
                    .from(tableName)
                    .update(payload)
                    .eq('id', serviceId);
                return error;
            };

            const firstError = await tryUpdate('service');
            if (firstError) {
                const secondError = await tryUpdate('services');
                if (secondError) return thunkAPI.rejectWithValue(secondError.message || 'Failed to approve featured service');
            }

            const logged = await logClientAdminActivity({
                action: 'approve',
                resource_type: 'service',
                resource_id: serviceId,
                summary: `Approved featured listing request for service ${serviceId}`,
            });
            if (!logged) return thunkAPI.rejectWithValue('Feature request approved, but failed to write admin activity log');

            return 1;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unexpected error';
            return thunkAPI.rejectWithValue(msg);
        }
    }
);

export const rejectFeatureRequestById = createAsyncThunk<number, string, { rejectValue: string }>(
    'service/rejectFeatureRequestById',
    async (serviceId, thunkAPI) => {
        try {
            if (!serviceId) return thunkAPI.rejectWithValue('Missing service id');

            const payload = {
                feature: false,
                feature_requested_status: 'rejected',
            };

            const tryUpdate = async (tableName: string) => {
                const { error } = await getSupabase()
                    .from(tableName)
                    .update(payload)
                    .eq('id', serviceId);
                return error;
            };

            const firstError = await tryUpdate('service');
            if (firstError) {
                const secondError = await tryUpdate('services');
                if (secondError) return thunkAPI.rejectWithValue(secondError.message || 'Failed to reject featured service');
            }

            const logged = await logClientAdminActivity({
                action: 'reject',
                resource_type: 'service',
                resource_id: serviceId,
                summary: `Rejected featured listing request for service ${serviceId}`,
            });
            if (!logged) return thunkAPI.rejectWithValue('Feature request rejected, but failed to write admin activity log');

            return 1;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unexpected error';
            return thunkAPI.rejectWithValue(msg);
        }
    }
);

export const unfeatureServiceById = createAsyncThunk<number, string, { rejectValue: string }>(
    'service/unfeatureServiceById',
    async (serviceId, thunkAPI) => {
        try {
            if (!serviceId) return thunkAPI.rejectWithValue('Missing service id');

            const payload = {
                feature: false,
                feature_requested_status: 'none',
            };

            const tryUpdate = async (tableName: string) => {
                const { error } = await getSupabase()
                    .from(tableName)
                    .update(payload)
                    .eq('id', serviceId);
                return error;
            };

            const firstError = await tryUpdate('service');
            if (firstError) {
                const secondError = await tryUpdate('services');
                if (secondError) return thunkAPI.rejectWithValue(secondError.message || 'Failed to remove featured status');
            }

            const logged = await logClientAdminActivity({
                action: 'update',
                resource_type: 'service',
                resource_id: serviceId,
                summary: `Removed featured status from service ${serviceId}`,
            });
            if (!logged) return thunkAPI.rejectWithValue('Featured status removed, but failed to write admin activity log');

            return 1;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unexpected error';
            return thunkAPI.rejectWithValue(msg);
        }
    }
);

const approveServicesSlice = createSlice({
    name: 'approveServices',
    initialState,
    reducers: {
        resetApproveState(state) {
            state.loading = false;
            state.error = null;
            state.success = false;
            state.updatedCount = 0;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(approveServicesByProvider.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.success = false;
                state.updatedCount = 0;
            })
            .addCase(approveServicesByProvider.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.error = null;
                state.updatedCount = action.payload;
            })
            .addCase(approveServicesByProvider.rejected, (state, action) => {
                state.loading = false;
                state.success = false;
                state.error = action.payload as string;
                state.updatedCount = 0;
            });

        // single service approval handlers
        builder
            .addCase(approveServiceById.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.success = false;
                state.updatedCount = 0;
            })
            .addCase(approveServiceById.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.error = null;
                state.updatedCount = action.payload;
            })
            .addCase(approveServiceById.rejected, (state, action) => {
                state.loading = false;
                state.success = false;
                state.error = action.payload as string;
                state.updatedCount = 0;
            });

        // featured request approval handlers
        builder
            .addCase(approveFeatureRequestById.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.success = false;
                state.updatedCount = 0;
            })
            .addCase(approveFeatureRequestById.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.error = null;
                state.updatedCount = action.payload;
            })
            .addCase(approveFeatureRequestById.rejected, (state, action) => {
                state.loading = false;
                state.success = false;
                state.error = action.payload as string;
                state.updatedCount = 0;
            })
            .addCase(rejectFeatureRequestById.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.success = false;
                state.updatedCount = 0;
            })
            .addCase(rejectFeatureRequestById.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.error = null;
                state.updatedCount = action.payload;
            })
            .addCase(rejectFeatureRequestById.rejected, (state, action) => {
                state.loading = false;
                state.success = false;
                state.error = action.payload as string;
                state.updatedCount = 0;
            });

        // unfeature handlers
        builder
            .addCase(unfeatureServiceById.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.success = false;
                state.updatedCount = 0;
            })
            .addCase(unfeatureServiceById.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.error = null;
                state.updatedCount = action.payload;
            })
            .addCase(unfeatureServiceById.rejected, (state, action) => {
                state.loading = false;
                state.success = false;
                state.error = action.payload as string;
                state.updatedCount = 0;
            });

        // fetchServices handlers
        builder
            .addCase(fetchServices.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchServices.fulfilled, (state, action) => {
                state.loading = false;
                state.services = action.payload;
            })
            .addCase(fetchServices.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { resetApproveState } = approveServicesSlice.actions;
export default approveServicesSlice.reducer;
