import { createSlice as createModalSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabaseClient';
import { uploadFilesToSupabase } from '@/lib/upload';

// Optional: import from a central service model if it exists
export interface CategoryModel { id: string; name: string }
export interface SubCategoryModel { id: string; name: string; categoryId?: string }

export interface AddServiceModel {
  serviceName: string;
  description: string;
  address?: string;
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
  location?: {
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
        serviceImage: imageUrls,
        video: videoUrl,
      };
      // Insert into Supabase 'service' table
      const { error } = await supabase.from('service').insert([serviceToSave]);
      if (error) {
        return thunkAPI.rejectWithValue(error.message);
      }
      return { ...serviceToSave };
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
