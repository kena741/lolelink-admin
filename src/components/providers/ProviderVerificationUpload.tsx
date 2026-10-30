'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DocumentMediaPreview } from '@/components/DocumentMediaPreview';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchDocuments } from '@/features/document/documentSlice';
import { fetchVerifyDocuments } from '@/features/verifyDocuments/verifyDocumentsSlice';
import { uploadFilesToSupabase } from '@/lib/upload';
import { getDisplayImageUrl } from '@/lib/media-url';

interface ProviderVerificationUploadProps {
    providerId: string;
    providerUserId?: string | null;
    onPreview?: (url: string) => void;
}

function isSignupIdentityDocument(name: string): boolean {
    const lower = name.toLowerCase();
    return lower.includes('national') && lower.includes('id');
}

function documentSortRank(name: string): number {
    const lower = name.toLowerCase();
    if (lower.includes('front')) return 0;
    if (lower.includes('back')) return 1;
    return 2;
}

export function ProviderVerificationUpload({
    providerId,
    providerUserId,
    onPreview,
}: ProviderVerificationUploadProps) {
    const dispatch = useAppDispatch();
    const { canWriteProviders } = useAdminPermissions();
    const { documents: catalog, loading: catalogLoading } = useAppSelector((s) => s.document);
    const { documents: verifyDocs } = useAppSelector((s) => s.verifyDocuments);

    const [documentId, setDocumentId] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        if (catalog.length === 0) void dispatch(fetchDocuments());
    }, [catalog.length, dispatch]);

    const identityDocs = useMemo(() => {
        const active = catalog.filter((doc) => doc.active !== false && doc.id && doc.name);
        const identity = active.filter((doc) => isSignupIdentityDocument(doc.name || ''));
        const list = (identity.length > 0 ? identity : active).slice();
        list.sort((a, b) => {
            const rank = documentSortRank(a.name || '') - documentSortRank(b.name || '');
            return rank !== 0 ? rank : (a.name || '').localeCompare(b.name || '');
        });
        return list;
    }, [catalog]);

    useEffect(() => {
        if (!documentId && identityDocs[0]?.id) setDocumentId(identityDocs[0].id);
    }, [documentId, identityDocs]);

    const providerDocuments = useMemo(
        () => verifyDocs.filter((doc) => doc.providerId === providerId),
        [verifyDocs, providerId]
    );

    const storageUserId = (providerUserId || providerId).trim();

    async function handleUpload() {
        if (!canWriteProviders) return;
        if (!documentId) {
            setError('Select a document type');
            return;
        }
        if (!file) {
            setError('Choose a file to upload');
            return;
        }

        setUploading(true);
        setError(null);
        setMessage(null);
        try {
            // Same storage layout as the provider mobile app.
            const [url] = await uploadFilesToSupabase(
                [file],
                `documentImage/${documentId}/${storageUserId}`
            );

            const response = await fetch(
                `/api/admin/providers/${encodeURIComponent(providerId)}/verify-documents`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ documentId, documentImage: url }),
                }
            );
            const payload = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(payload.error || 'Failed to save document');

            setFile(null);
            setMessage('Document uploaded and queued for verification.');
            await dispatch(fetchVerifyDocuments());
        } catch (uploadError: unknown) {
            setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-semibold text-text-primary">Verification uploads</h2>
                    <p className="mt-1 text-sm text-text-secondary">
                        Upload identity docs the same way as the provider app (pending until approved).
                    </p>
                </div>
            </div>

            {canWriteProviders ? (
                <div className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                        <div className="grid gap-1.5">
                            <Label htmlFor="verify-doc-type">Document type</Label>
                            <select
                                id="verify-doc-type"
                                value={documentId}
                                onChange={(e) => setDocumentId(e.target.value)}
                                disabled={uploading || catalogLoading || identityDocs.length === 0}
                                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                            >
                                {identityDocs.length === 0 ? (
                                    <option value="">No documents configured</option>
                                ) : (
                                    identityDocs.map((doc) => (
                                        <option key={doc.id} value={doc.id}>
                                            {doc.name}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="verify-doc-file">File</Label>
                            <input
                                id="verify-doc-file"
                                type="file"
                                accept="image/*,.pdf,.heic,.heif"
                                disabled={uploading}
                                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                                className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
                            />
                        </div>
                        <Button
                            type="button"
                            onClick={() => void handleUpload()}
                            disabled={uploading || !documentId || !file}
                            className="h-10"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Uploading…
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4" />
                                    Upload
                                </>
                            )}
                        </Button>
                    </div>
                    {file ? (
                        <p className="text-xs text-text-secondary">Selected: {file.name}</p>
                    ) : null}
                    {error ? <p className="text-sm text-destructive">{error}</p> : null}
                    {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
                </div>
            ) : null}

            {providerDocuments.length === 0 ? (
                <div className="rounded-lg border border-border bg-card p-6 text-text-secondary">
                    No documents uploaded.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {providerDocuments.map((doc) => {
                        const imageUrl = getDisplayImageUrl(doc.documentImage);
                        const status =
                            doc.isVerify === true
                                ? { label: 'Verified', className: 'bg-primary/10 text-primary' }
                                : doc.isVerify === false
                                  ? { label: 'Rejected', className: 'bg-destructive/10 text-destructive' }
                                  : { label: 'Pending', className: 'bg-amber-100 text-amber-700' };

                        return (
                            <div
                                key={doc.id}
                                className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                            >
                                <div className="mb-2 flex items-start justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <FileText className="h-5 w-5 shrink-0 text-primary" />
                                        <span className="truncate font-semibold text-text-primary">
                                            {doc.documentName || 'Document'}
                                        </span>
                                    </div>
                                    <span
                                        className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${status.className}`}
                                    >
                                        {status.label}
                                    </span>
                                </div>
                                {imageUrl ? (
                                    <DocumentMediaPreview
                                        src={imageUrl}
                                        alt={doc.documentName || 'Document'}
                                        imgClassName="max-h-56"
                                        onOpen={() => onPreview?.(imageUrl)}
                                    />
                                ) : (
                                    <p className="mt-3 text-sm text-text-secondary">No image uploaded.</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
