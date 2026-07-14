import { createSlice as createModalSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { getSupabase } from '@/lib/supabaseClient';
import { validateServiceDiscount } from '@/lib/service-discount';
import { uploadFilesToSupabase } from '@/lib/upload';
import { logClientAdminActivity } from '@/lib/record-admin-activity';

// Optional: import from a central service model if it exists
export interface CategoryModel { id: string; name: string }
export interface SubCategoryModel { id: string; name: string; categoryId?: string }

export interface AddServiceModel {
  serviceName: string;
  description: string;
  address: string;
  categoryId: string;
  categoryModel: CategoryModel;
  subCategoryId: string;
  subCategoryModel: SubCategoryModel;
  price: number | string;
  discount?: string;
  provider_id: string;
  serviceImage?: string[];
  video?: string; // TikTok or other video URL
  createdAt?: Date;
  duration?: string;
  prePayment?: boolean;
  likedUser?: string[] | null;
  reviewCount: number | null;
  reviewSum: number | null;
  feature: boolean;
  status?: boolean;
  active: boolean | null;
  slug?: string;
  type: string;
  serviceLocationMode: string;
  location: {
    latitude: number;
    longitude: number;
  };
  position?: {
    geohash: string;
    geopoint: { latitude: number; longitude: number };
  };
}

export const addService = createAsyncThunk(
  'service/addService',
  async (
    args: { service: AddServiceModel; imageFiles?: File[]; videoFile?: File },
    thunkAPI
  ) => {
    try {
      const discountResult = validateServiceDiscount(args.service.discount);
      if (!discountResult.ok) {
        return thunkAPI.rejectWithValue(discountResult.error);
      }
      if (!(args.service.address ?? '').trim()) {
        return thunkAPI.rejectWithValue('Service address is required');
      }
      const lat = args.service.location?.latitude;
      const lng = args.service.location?.longitude;
      if (
        typeof lat !== 'number' ||
        typeof lng !== 'number' ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return thunkAPI.rejectWithValue('Service location is required');
      }

      let imageUrls: string[] = args.service.serviceImage || [];
      // If imageFiles are provided, upload them to Supabase Storage
      if (args.imageFiles && args.imageFiles.length > 0 && args.service.provider_id) {
        imageUrls = await uploadFilesToSupabase(
          args.imageFiles,
          `public/${args.service.provider_id}`
        );
      }
      // If a videoFile is provided, upload it and set service.video to the URL
      let videoUrl: string | null = null;
      if (args.videoFile && args.service.provider_id) {
        const uploaded = await uploadFilesToSupabase([args.videoFile], `public/${args.service.provider_id}/videos`);
        videoUrl = uploaded[0] || null;
      }
      const serviceToSave = {
        ...args.service,
        discount: discountResult.value,
        serviceImage: imageUrls,
        video: videoUrl,
      };
      // Insert into Supabase 'service' table
      const { data, error } = await getSupabase().from('service').insert([serviceToSave]).select('id, serviceName').single();
      if (error) {
        return thunkAPI.rejectWithValue(error.message);
      }
      const row = data as { id?: string; serviceName?: string };
      logClientAdminActivity({
        action: 'create',
        resource_type: 'service',
        resource_id: row.id,
        summary: `Created service ${row.serviceName || serviceToSave.serviceName}`,
        metadata: { provider_id: serviceToSave.provider_id, categoryId: serviceToSave.categoryId },
      });
      return { ...serviceToSave, id: row.id };
    } catch (error) {
      if (error instanceof Error) {
        return thunkAPI.rejectWithValue(error.message);
      }
      return thunkAPI.rejectWithValue('Failed to add service');
    }
  }
);

interface AddServiceModalState {
  open: boolean;
  loading: boolean;
  error: string | null;
}

const initialAddServiceModalState: AddServiceModalState = {
  open: false,
  loading: false,
  error: null,
};

const addServiceModalSlice = createModalSlice({
  name: 'addServiceModal',
  initialState: initialAddServiceModalState,
  reducers: {
    openAddServiceModal(state) {
      state.open = true;
      state.error = null;
    },
    closeAddServiceModal(state) {
      state.open = false;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(addService.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addService.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
        state.open = false; // Close the modal on success
      })
      .addCase(addService.rejected, (state, action: PayloadAction<unknown>) => {
        state.loading = false;
        state.error = typeof action.payload === 'string' ? action.payload : 'Failed to add service';
      });
  },
});

export const { openAddServiceModal, closeAddServiceModal } = addServiceModalSlice.actions;
export const addServiceModalSliceReducer = addServiceModalSlice.reducer;
