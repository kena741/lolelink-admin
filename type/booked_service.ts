export interface BookedServiceSchema {
  id: string;
  provider_id: string;
  customer_id?: string | null;
  provider_user_id?: string | null;
  customer_user_id?: string | null;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  serviceName?: string;
  service_id?: string;
  serviceImage?: string;
  price?: number;
  discount?: string;
  totalAmount?: number;
  subTotal?: number;
  quantity?: string;
  bookingDate?: string;
  createdAt?: string;
  created_at?: string;
  status?:
    | "pending"
    | "accepted"
    | "rejected"
    | "on_the_way"
    | "in_progress"
    | "hold"
    | "completed"
    | "pending_extra_payment"
    | "pending_approval"
    | "admin_paid";
  description?: string;
  paymentCompleted?: boolean;
}
