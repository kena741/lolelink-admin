export interface BookedServiceSchema {
  id: string;
  provider_id: string;
  customer_id?: string | null;
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
    | "booked"
    | "booked_accepted"
    | "booked_rejected"
    | "pending_customer_payment"
    | "paid_for_service_booked"
    | "booked_cancelled"
    | "service_started"
    | "service_completion_approval"
    | "service_completion_approved_by_customer";
  description?: string;
  paymentCompleted?: boolean;
}
