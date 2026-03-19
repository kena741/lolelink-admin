export interface CouponSchema {
  id: number;
  title?: string;
  code?: string;
  amount?: number;
  minAmount?: number;
  active?: boolean;
  isPrivate?: boolean;
  isFix?: boolean;
  expiredAt?: string;
  created_at?: string;
}
