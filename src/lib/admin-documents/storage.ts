import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const ADMIN_DOCUMENTS_BUCKET = 'admin-documents';
export const ADMIN_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export function adminDocumentMaxSizeLabel(): string {
    return `${ADMIN_DOCUMENT_MAX_BYTES / (1024 * 1024)} MB`;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function adminDocumentSizeError(sizeBytes: number): string {
    return `File is too large (${formatFileSize(sizeBytes)}). Maximum size is ${adminDocumentMaxSizeLabel()}.`;
}

export async function uploadAdminDocument(
    client: SupabaseClient,
    file: File
): Promise<{ storagePath: string; mimeType: string }> {
    const mimeType = file.type || 'application/octet-stream';
    if (mimeType !== 'application/pdf') {
        throw new Error('Use a PDF file.');
    }
    if (file.size > ADMIN_DOCUMENT_MAX_BYTES) {
        throw new Error(adminDocumentSizeError(file.size));
    }

    const storagePath = `library/${randomUUID()}.pdf`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error } = await client.storage.from(ADMIN_DOCUMENTS_BUCKET).upload(storagePath, bytes, {
        contentType: mimeType,
        upsert: false,
    });

    if (error) {
        if (error.message.toLowerCase().includes('maximum allowed size')) {
            throw new Error(adminDocumentSizeError(file.size));
        }
        throw new Error(error.message);
    }

    return { storagePath, mimeType };
}

export async function signedAdminDocumentUrl(
    client: SupabaseClient,
    storagePath: string | null | undefined
): Promise<string | null> {
    if (!storagePath?.trim()) return null;

    const { data, error } = await client.storage
        .from(ADMIN_DOCUMENTS_BUCKET)
        .createSignedUrl(storagePath, 60 * 60);

    if (error) throw new Error(error.message);
    return data?.signedUrl ?? null;
}
