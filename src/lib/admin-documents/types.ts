export type AdminDocumentCategory = 'agreement' | 'policy' | 'other';

export interface AdminDocument {
    id: string;
    title: string;
    category: AdminDocumentCategory;
    storage_path: string;
    file_name: string;
    mime_type: string;
    uploaded_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface DocumentDelivery {
    id: string;
    document_id: string;
    recipient_type: string;
    recipient_id: string;
    sent_by: string | null;
    sent_at: string;
    acknowledged_at: string | null;
    document_title?: string | null;
    document_category?: string | null;
    file_name?: string | null;
}

export const ADMIN_DOCUMENT_CATEGORY_LABELS: Record<AdminDocumentCategory, string> = {
    agreement: 'Agreement',
    policy: 'Policy',
    other: 'Other',
};
