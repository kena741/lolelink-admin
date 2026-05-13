export interface CustomerAddressSchema {
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
}

export interface CustomerSchema {
  id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  gender?: string;
  ip_address?: string;
  country_code?: string;
  mobile_number?: string;
  phoneNumber?: string;
  phone?: string;
  avatar?: string;
  created_at?: string;
  updated_at?: string;
  wallet_amount?: number;
  status?: string;
  flag?: string;
  password?: string;
  default_address?: CustomerAddressSchema | null | string;
  customer_id?: string;
  promo_code?: string;
  updated_by_admin?: string;
  provider_id?: string;
  address?: string;
  archived_at?: string | null;
}
