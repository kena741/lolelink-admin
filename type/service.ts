export interface ServiceSchema {
  id: string;
  provider_id?: string;
  name?: string;
  serviceName?: string;
  image?: string | null;
  image_url?: string | null;
  serviceImage?: string | string[] | null;
  images?: string[];
  image_urls?: string[];
  serviceImages?: string[];
  gallery?: string[];
  description?: string | null;
  createdAt?: string;
  created_at?: string;
  slug?: string;
  price?: string | number;
  discount?: string;
  status?: boolean;
  feature?: boolean;
  approved?: boolean;
  type?: string;
  prePayment?: boolean;
  prePaymentPercent?: number | null;
  pricing_type?: 'ONE_TIME' | 'RECURRING' | string;
  billing_interval?: string | null;
  billing_interval_count?: number | null;
  duration?: string;
  categoryId?: string;
  categoryModel?: Record<string, unknown> | null;
  subCategoryId?: string;
  subCategoryModel?: Record<string, unknown> | null;
  address?: string;
  video?: string | null;
  active?: boolean | null;
  serviceLocationMode?: string;
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
  likedUser?: string[] | null;
  liked_users?: string[] | null;
  reviewCount?: number | null;
  reviewSum?: number | null;
  isArchived?: boolean;
  feature_requested_at?: string;
  feature_requested_status?: string;
}
