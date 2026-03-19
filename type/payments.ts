export interface PaymentsSchema {
  id: string;
  booking_id: string;
  customer_id: string;
  amount: number;
  currency: string;
  status:
    | "pending_payment"
    | "payment_approved_by_admin"
    | "payment_rejected_by_admin"
    | "payment_completed"
    | "payment_cancelled";
  payment_method: string;
  provider: string;
  provider_ref: string;
  created_at: string;
  updated_at: string;
}
