'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ExternalLink, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    ADMIN_DOCUMENT_CATEGORY_LABELS,
    type AdminDocument,
    type AdminDocumentCategory,
} from '@/lib/admin-documents/types';
import { ADMIN_DOCUMENT_MAX_BYTES, adminDocumentMaxSizeLabel } from '@/lib/admin-documents/storage';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import AdminPageHeader from '@/components/AdminPageHeader';
import { AdminShell } from '@/components/admin/admin-layout';

type AdminDocumentRow = AdminDocument & { preview_url?: string | null };

const CATEGORY_OPTIONS: { value: AdminDocumentCategory; label: string }[] = [
    { value: 'agreement', label: ADMIN_DOCUMENT_CATEGORY_LABELS.agreement },
    { value: 'policy', label: ADMIN_DOCUMENT_CATEGORY_LABELS.policy },
    { value: 'other', label: ADMIN_DOCUMENT_CATEGORY_LABELS.other },
];

function formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export default function InternalDocumentsPage() {
    const { canWriteDocuments } = useAdminPermissions();
    const [documents, setDocuments] = useState<AdminDocumentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<AdminDocumentCategory>('agreement');
    const [file, setFile] = useState<File | null>(null);
    const fileTooLarge = file !== null && file.size > ADMIN_DOCUMENT_MAX_BYTES;

    const loadDocuments = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/internal-documents');
            const payload = (await res.json()) as {
                error?: string;
                documents?: AdminDocumentRow[];
            };
            if (!res.ok) throw new Error(payload.error ?? 'Failed to load documents');
            setDocuments(payload.documents ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load documents');
            setDocuments([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadDocuments();
    }, [loadDocuments]);

    async function handleUpload(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canWriteDocuments || !file) return;
        if (file.size > ADMIN_DOCUMENT_MAX_BYTES) {
            setError(`File is too large. Maximum size is ${adminDocumentMaxSizeLabel()}.`);
            return;
        }

        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            const formData = new FormData();
            formData.set('title', title.trim());
            formData.set('category', category);
            formData.set('file', file);

            const res = await fetch('/api/admin/internal-documents', {
                method: 'POST',
                body: formData,
            });
            const payload = (await res.json()) as { error?: string };
            if (!res.ok) throw new Error(payload.error ?? 'Upload failed');

            setTitle('');
            setCategory('agreement');
            setFile(null);
            setMessage('Document uploaded.');
            await loadDocuments();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setSaving(false);
        }
    }

    return (
        <AdminShell>
            <AdminPageHeader
                title="Internal documents"
                description="Upload PDFs once, then send them to providers from their profile."
                breadcrumbs={[
                    { label: 'Admin', href: '/admin/dashboard' },
                    { label: 'Internal documents' },
                ]}
            />

            {error ? (
                <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            ) : null}
            {message ? (
                <div className="mb-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
                    {message}
                </div>
            ) : null}

            {canWriteDocuments ? (
                <form
                    onSubmit={(event) => void handleUpload(event)}
                    className="mb-6 grid gap-4 rounded-xl border border-border bg-card p-6 md:grid-cols-2"
                >
                    <div className="md:col-span-2">
                        <h2 className="text-lg font-semibold text-foreground">Upload PDF</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            PDF only · Max {adminDocumentMaxSizeLabel()} per file
                        </p>
                    </div>
                    <div>
                        <Label htmlFor="doc_title">Title</Label>
                        <Input
                            id="doc_title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Provider agreement 2026"
                            className="mt-1.5"
                            required
                        />
                    </div>
                    <div>
                        <Label htmlFor="doc_category">Category</Label>
                        <select
                            id="doc_category"
                            value={category}
                            onChange={(event) =>
                                setCategory(event.target.value as AdminDocumentCategory)
                            }
                            className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                            {CATEGORY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <Label htmlFor="doc_file">PDF file</Label>
                        <Input
                            id="doc_file"
                            type="file"
                            accept="application/pdf"
                            className="mt-1.5"
                            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                            required
                        />
                        {file ? (
                            <p
                                className={
                                    fileTooLarge
                                        ? 'mt-1.5 text-sm text-destructive'
                                        : 'mt-1.5 text-sm text-muted-foreground'
                                }
                            >
                                Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                                {fileTooLarge ? ` — exceeds ${adminDocumentMaxSizeLabel()} limit` : null}
                            </p>
                        ) : null}
                    </div>
                    <div className="md:col-span-2">
                        <Button
                            type="submit"
                            disabled={saving || !file || !title.trim() || fileTooLarge}
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            {saving ? 'Uploading…' : 'Upload document'}
                        </Button>
                    </div>
                </form>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-border bg-card">
                <table className="min-w-full text-sm">
                    <thead className="border-b border-border bg-muted/50">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold">Title</th>
                            <th className="px-4 py-3 text-left font-semibold">Category</th>
                            <th className="px-4 py-3 text-left font-semibold">File</th>
                            <th className="px-4 py-3 text-left font-semibold">Uploaded</th>
                            <th className="px-4 py-3 text-right font-semibold">Preview</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                                    Loading documents…
                                </td>
                            </tr>
                        ) : documents.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                                    No documents uploaded yet.
                                </td>
                            </tr>
                        ) : (
                            documents.map((document) => (
                                <tr key={document.id} className="border-b border-border/70">
                                    <td className="px-4 py-3 font-medium">{document.title}</td>
                                    <td className="px-4 py-3">
                                        {ADMIN_DOCUMENT_CATEGORY_LABELS[document.category]}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {document.file_name}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {formatDateTime(document.created_at)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {document.preview_url ? (
                                            <a
                                                href={document.preview_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                                            >
                                                Open
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </a>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </AdminShell>
    );
}
