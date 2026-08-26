import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { getSupabase } from '@/lib/supabaseClient';
import { getRemovedStorageUrls, getServiceImageUrls } from '@/lib/media-url';
import { validateServiceDiscount } from '@/lib/service-discount';
import { deleteStorageFilesFromUrls, uploadFilesToSupabase } from '@/lib/upload';
import { logClientAdminActivity } from '@/lib/record-admin-activity';
import { buildChangeMetadata } from '@/lib/activity-log-changes';

export type SubCategoryModel = {
    id?: string;
    name?: string;
    subCategoryName?: string;
    categoryId?: string;
};
export type CategoryModel = {
    id?: string;
    name?: string;
    categoryName?: string;
    image?: string;
    active?: boolean | null;
};

function readRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

export function mapServiceRowToEditServiceModel(
    row: Record<string, unknown>,
    fallbackProviderId?: string
): ServiceModel {
    const categoryModel = readRecord(row.categoryModel);
    const subCategoryModel = readRecord(row.subCategoryModel);
    const categoryId =
        (typeof row.categoryId === 'string' ? row.categoryId : '') ||
        (typeof categoryModel?.id === 'string' ? categoryModel.id : '');
    const subCategoryId =
        (typeof row.subCategoryId === 'string' ? row.subCategoryId : '') ||
        (typeof subCategoryModel?.id === 'string' ? subCategoryModel.id : '');

    const imgs =
        (row.images as string[] | undefined) ??
        (Array.isArray(row.serviceImage)
            ? (row.serviceImage as string[])
            : row.serviceImage
              ? [String(row.serviceImage)]
              : row.image
                ? [String(row.image)]
                : undefined);

    const provider_id =
        (typeof row.provider_id === 'string' ? row.provider_id : '') ||
        (typeof row.providerId === 'string' ? row.providerId : '') ||
        fallbackProviderId ||
        '';
    const provider = readRecord(row.provider);
    const providerNameFromJoined =
        [
            typeof provider?.firstName === 'string' ? provider.firstName : '',
            typeof provider?.lastName === 'string' ? provider.lastName : '',
        ]
            .filter(Boolean)
            .join(' ')
            .trim() ||
        [
            typeof provider?.first_name === 'string' ? provider.first_name : '',
            typeof provider?.last_name === 'string' ? provider.last_name : '',
        ]
            .filter(Boolean)
            .join(' ')
            .trim() ||
        (typeof provider?.userName === 'string' ? provider.userName : '');
    const providerName =
        (typeof row.providerName === 'string' ? row.providerName : '') ||
        (typeof row.provider_name === 'string' ? row.provider_name : '') ||
        providerNameFromJoined;

    return {
        id: String(row.id ?? ''),
        provider_id,
        providerName: providerName || undefined,
        serviceName: String(row.serviceName ?? row.name ?? ''),
        address: typeof row.address === 'string' ? row.address : '',
        description: (row.description as string | null | undefined) ?? '',
        price: row.price as string | number | undefined,
        duration: row.duration as string | undefined,
        serviceImage: imgs ?? [],
        discount: row.discount as string | undefined,
        type: row.type as string | undefined,
        status: row.status as boolean | undefined,
        prePayment: row.prePayment as boolean | undefined,
        prePaymentPercent: row.prePaymentPercent as number | null | undefined,
        pricing_type: row.pricing_type as string | undefined,
        billing_interval: (row.billing_interval as string | null | undefined) ?? null,
        billing_interval_count: (row.billing_interval_count as number | null | undefined) ?? null,
        feature: row.feature as boolean | undefined,
        serviceLocationMode: (row.serviceLocationMode as string | undefined) ?? 'onsite',
        video: (row.video as string | null | undefined) ?? null,
        approved: Boolean(row.approved),
        categoryId: categoryId || undefined,
        subCategoryId: subCategoryId || undefined,
        categoryModel: categoryModel as CategoryModel | undefined,
        subCategoryModel: subCategoryModel as SubCategoryModel | undefined,
        location: (() => {
            const loc = readRecord(row.location);
            const lat = loc?.latitude;
            const lng = loc?.longitude;
            if (typeof lat === 'number' && typeof lng === 'number') {
                return { latitude: lat, longitude: lng };
            }
            return undefined;
        })(),
    };
}
export type ServiceModel = {
    id: string;
    provider_id?: string;
    providerName?: string;
    serviceName?: string;
    address?: string;
    categoryModel?: CategoryModel;
    categoryId?: string;
    subCategoryModel?: SubCategoryModel;
    subCategoryId?: string;
    description?: string | null;
    price?: string | number;
    duration?: string;
    slug?: string;
    serviceImage?: string[];
    discount?: string;
    type?: string;
    status?: boolean;
    prePayment?: boolean;
    prePaymentPercent?: number | null;
    pricing_type?: string;
    billing_interval?: string | null;
    billing_interval_count?: number | null;
    feature?: boolean;
    active?: boolean | null;
    isArchived?: boolean;
    likedUser?: string[] | null;
    liked_users?: string[] | null;
    reviewCount?: number | null;
    reviewSum?: number | null;
    location?: {
        latitude: number;
        longitude: number;
    };
    position?: {
        geohash: string;
        geopoint: {
            latitude: number;
            longitude: number;
        };
    };
    serviceLocationMode?: string;
    video?: string | null;
    approved?: boolean;
    createdAt?: string;
    feature_requested_at?: string;
    feature_requested_status?: string;
    featureRequestPaid?: boolean;
    featureRequestPaidAmount?: string | null;
    featureRequestTransactionId?: string | null;
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

            if (rest.discount !== undefined) {
                const discountResult = validateServiceDiscount(rest.discount);
                if (!discountResult.ok) {
                    return thunkAPI.rejectWithValue(discountResult.error);
                }
                rest.discount = discountResult.value;
            }

            const { data: original, error: fetchError } = await getSupabase()
                .from('service')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError) {
                return thunkAPI.rejectWithValue(fetchError.message || 'Failed to fetch original service');
            }

            const providerId = (rest.provider_id as string | undefined) || (original as ServiceModel)?.provider_id;

            let finalVideoUrl: string | null | undefined = (rest as ServiceModel).video ?? (original as ServiceModel)?.video ?? null;

            const originalRecord = original as Record<string, unknown>;
            const oldImages = getServiceImageUrls(originalRecord);
            const oldVideo =
                typeof (original as ServiceModel).video === 'string'
                    ? (original as ServiceModel).video
                    : null;

            if (removeVideo) {
                finalVideoUrl = null;
            } else if (videoFile && providerId) {
                const uploaded = await uploadFilesToSupabase([videoFile], `public/${providerId}/videos`);
                finalVideoUrl = uploaded[0] || null;
            }

            const nextImages = Array.isArray(rest.serviceImage) ? rest.serviceImage : undefined;
            if (nextImages) {
                const removedImages = getRemovedStorageUrls(oldImages, nextImages);
                if (removedImages.length > 0) {
                    await deleteStorageFilesFromUrls(removedImages);
                }
            }

            if (oldVideo && oldVideo !== finalVideoUrl) {
                await deleteStorageFilesFromUrls([oldVideo]);
            }

            const s = rest as ServiceModel & { subCategoryModel?: SubCategoryModel };
            const fields: (keyof ServiceModel)[] = [
                'serviceName',
                'address',
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
                'prePaymentPercent',
                'pricing_type',
                'billing_interval',
                'billing_interval_count',
                'feature',
                'feature_requested_status',
                'approved',
                'serviceLocationMode',
                'location',
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

            const { data, error } = await getSupabase()
                .from('service')
                .update(serviceData)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                return thunkAPI.rejectWithValue(error.message || 'Failed to update service');
            }

            const updated = { ...(original as ServiceModel), ...serviceData, ...data } as ServiceModel;
            const logged = await logClientAdminActivity({
                action: 'update',
                resource_type: 'service',
                resource_id: id,
                summary: `Updated service ${updated.serviceName || id}`,
                metadata: buildChangeMetadata(
                    originalRecord,
                    updated as unknown as Record<string, unknown>,
                    Object.keys(serviceData)
                ),
            });
            if (!logged) {
                return thunkAPI.rejectWithValue('Service updated, but failed to write admin activity log');
            }

            return updated;
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
            state.success = false;
            state.error = null;
        },
        closeEditModal(state) {
            state.open = false;
            state.service = null;
            state.coverIdx = 0;
            state.images = [];
            state.success = false;
            state.error = null;
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
