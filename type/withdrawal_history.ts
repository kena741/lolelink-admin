export interface WithdrawalHistorySchema {
  id: string;
  providerId: string;
  note?: string;
  adminNote?: string;
  amount: string | number;
  paymentStatus?: "pending" | "approved" | "rejected" | "completed";
  createdDate?: string;
  paymentDate?: string;
}
