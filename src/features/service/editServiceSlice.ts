import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabaseClient';
import { uploadFilesToSupabase } from '@/lib/upload';

// Minimal shapes to satisfy usage; replace with your canonical types if available
export type SubCategoryModel = { id?: string; name?: string };
export type CategoryModel = { id?: string; name?: string };
export type ServiceModel = {
    id: string;
    provider_id?: string;
    serviceName?: string;
    categoryModel?: CategoryModel;
    categoryId?: string;
    subCategoryModel?: SubCategoryModel;
    subCategoryId?: string;
    description?: string | null;
    price?: string | number;
    duration?: string;
    serviceImage?: string[];
    discount?: string;
    type?: string;
    status?: boolean;
    prePayment?: boolean;
    feature?: boolean;
    serviceLocationMode?: string;
    video?: string | null;
};

interface EditServiceState {
    open: boolean;
    service: ServiceModel | null;
    coverIdx: number;
    images: string[];
    loading: boolean;
    error: string | null;
    success: boolean;
}

const initialState: EditServiceState = {
    open: false,
    service: null,
    coverIdx: 0,
    images: [],
    loading: false,
    error: null,
    success: false,
};

export type UpdateServiceArgs = Partial<ServiceModel> & {
    id: string;
    videoFile?: File;
    removeVideo?: boolean;
};

export const updateService = createAsyncThunk<ServiceModel, UpdateServiceArgs, { rejectValue: string }>(
    'editService/updateService',
    async (args, thunkAPI) => {
        try {
            const { id, videoFile, removeVideo, ...rest } = args;
            if (!id) throw new Error('Service ID is required');

            const { data: original, error: fetchError } = await supabase
                .from('service')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError) {
                return thunkAPI.rejectWithValue(fetchError.message || 'Failed to fetch original service');
            }

            const providerId = (rest.provider_id as string | undefined) || (original as ServiceModel)?.provider_id;

            let finalVideoUrl: string | null | undefined = (rest as ServiceModel).video ?? (original as ServiceModel)?.video ?? null;

            if (removeVideo) {
                finalVideoUrl = null;
            } else if (videoFile && providerId) {
                const uploaded = await uploadFilesToSupabase([videoFile], `public/${providerId}/videos`);
                finalVideoUrl = uploaded[0] || null;
            }

            const s = rest as ServiceModel & { subCategoryModel?: SubCategoryModel };
            const fields: (keyof ServiceModel)[] = [
                'serviceName',
                'categoryModel',
                'categoryId',
                'subCategoryModel',
                'subCategoryId',
                'description',
                'price',
                'duration',
                'serviceImage',
                'discount',
                'type',
                'status',
                'prePayment',
                'feature',
                'serviceLocationMode',
                'video',
            ];

            const serviceData: Partial<ServiceModel> = {};
            const sRec = s as Record<keyof ServiceModel, unknown>;
            const origRec = (original as unknown) as Record<keyof ServiceModel, unknown>;
            for (const key of fields) {
                const candidate = key === 'video' ? (finalVideoUrl as unknown) : sRec[key];
                const oldValue = origRec[key];
                const isObject = (val: unknown) => typeof val === 'object' && val !== null;
                const isEqual = isObject(candidate) || isObject(oldValue)
                    ? JSON.stringify(candidate) === JSON.stringify(oldValue)
                    : candidate === oldValue;
                if (!isEqual && candidate !== undefined) {
                    (serviceData as Record<keyof ServiceModel, unknown>)[key] = candidate as never;
                }
            }

            if (Object.keys(serviceData).length === 0) {
                // nothing to update; return original
                return original as ServiceModel;
            }

            const { data, error } = await supabase
                .from('service')
                .update(serviceData)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                return thunkAPI.rejectWithValue(error.message || 'Failed to update service');
            }

            return { ...(original as ServiceModel), ...serviceData, ...data } as ServiceModel;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to update service';
            return thunkAPI.rejectWithValue(errorMessage);
        }
    }
);

const editServiceSlice = createSlice({
    name: 'editService',
    initialState,
    reducers: {
        openEditModal(state, action: PayloadAction<ServiceModel>) {
            state.open = true;
            state.service = action.payload;
            state.coverIdx = 0;
            state.images = action.payload.serviceImage || [];
        },
        closeEditModal(state) {
            state.open = false;
            state.service = null;
            state.coverIdx = 0;
            state.images = [];
        },
        setCoverIdx(state, action: PayloadAction<number>) {
            state.coverIdx = action.payload;
        },
        setImages(state, action: PayloadAction<string[]>) {
            state.images = action.payload;
        },
        updateServiceLocal(state, action: PayloadAction<Partial<ServiceModel>>) {
            if (state.service) {
                Object.assign(state.service, action.payload);
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(updateService.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.success = false;
            })
            .addCase(updateService.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.error = null;
                state.service = action.payload;
            })
            .addCase(updateService.rejected, (state, action) => {
                state.loading = false;
                state.success = false;
                state.error = (action.payload as string) || 'Failed to update service';
            });
    },
});

export const { openEditModal, closeEditModal, setCoverIdx, setImages, updateServiceLocal } = editServiceSlice.actions;
export default editServiceSlice.reducer;
