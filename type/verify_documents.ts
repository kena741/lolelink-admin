export interface VerifyDocumentsSchema {
  id: string;
  providerId: string;
  providerName?: string;
  providerEmail?: string;
  documentId?: string;
  documentName?: string;
  documentImage?: string;
  isVerify?: boolean | null;
  createdAt?: string;
}
