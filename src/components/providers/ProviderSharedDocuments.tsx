'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ArrowRight, FileText, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    ADMIN_DOCUMENT_CATEGORY_LABELS,
    type AdminDocument,
    type DocumentDelivery,
} from '@/lib/admin-documents/types';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';

interface ProviderSharedDocumentsProps {
    providerId: string;
}

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

export function ProviderSharedDocuments({ providerId }: ProviderSharedDocumentsProps) {
    const { can, canWriteDocuments } = useAdminPermissions();
    const canView = can('providers:read');
    const canManage = can('providers:write');
    const [documents, setDocuments] = useState<AdminDocument[]>([]);
    const [deliveries, setDeliveries] = useState<DocumentDelivery[]>([]);
    const [selectedDocumentId, setSelectedDocumentId] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [documentsRes, deliveriesRes] = await Promise.all([
                fetch('/api/admin/internal-documents'),
                fetch(`/api/admin/providers/${encodeURIComponent(providerId)}/document-deliveries`),
            ]);

            const documentsPayload = (await documentsRes.json()) as {
                error?: string;
                documents?: AdminDocument[];
            };
            const deliveriesPayload = (await deliveriesRes.json()) as {
                error?: string;
                deliveries?: DocumentDelivery[];
            };

            if (!documentsRes.ok) {
                throw new Error(documentsPayload.error ?? 'Failed to load documents');
            }
            if (!deliveriesRes.ok) {
                throw new Error(deliveriesPayload.error ?? 'Failed to load deliveries');
            }

            setDocuments(documentsPayload.documents ?? []);
            setDeliveries(deliveriesPayload.deliveries ?? []);
            setSelectedDocumentId(
                (current) => current || documentsPayload.documents?.[0]?.id || ''
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load shared documents');
            setDocuments([]);
            setDeliveries([]);
        } finally {
            setLoading(false);
        }
    }, [providerId]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    async function handleSend(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canManage || !selectedDocumentId) return;

        setSending(true);
        setError(null);
        setMessage(null);
        try {
            const res = await fetch(
                `/api/admin/providers/${encodeURIComponent(providerId)}/document-deliveries`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        documentId: selectedDocumentId,
                        note: note.trim() || undefined,
                    }),
                }
            );
            const payload = (await res.json()) as {
                error?: string;
                push?: { skipped?: string; error?: string; ok?: boolean };
            };
            if (!res.ok) throw new Error(payload.error ?? 'Send failed');

            if (payload.push && 'skipped' in payload.push && payload.push.skipped) {
                setMessage(`Document recorded. Push not sent: ${payload.push.skipped}`);
            } else if (payload.push && 'error' in payload.push && payload.push.error) {
                setMessage(`Document sent, but push failed: ${payload.push.error}`);
            } else {
                setMessage('Document sent and provider notified.');
            }

            setNote('');
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Send failed');
        } finally {
            setSending(false);
        }
    }

    if (!canView) return null;

    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <FileText className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">Shared documents</h3>
                        <p className="text-sm text-muted-foreground">
                            Send a PDF from the internal library. The provider gets a push and can
                            acknowledge in the app.
                        </p>
                    </div>
                </div>

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

                {canManage && !loading && documents.length === 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
                        <p className="text-sm text-amber-900">
                            No internal documents yet. Upload a PDF in the library before you can
                            send one to this provider.
                        </p>
                        {canWriteDocuments ? (
                            <Link
                                href="/admin/internal-documents"
                                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                            >
                                Go to Internal documents
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        ) : (
                            <p className="mt-2 text-sm text-amber-800">
                                Ask an admin with document access to upload files first.
                            </p>
                        )}
                    </div>
                ) : null}

                {canManage && (loading || documents.length > 0) ? (
                    <form onSubmit={(event) => void handleSend(event)} className="grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <Label htmlFor="shared_document">Document</Label>
                            <select
                                id="shared_document"
                                value={selectedDocumentId}
                                onChange={(event) => setSelectedDocumentId(event.target.value)}
                                className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                disabled={documents.length === 0}
                            >
                                {documents.length === 0 ? (
                                    <option value="">Upload a document first</option>
                                ) : (
                                    documents.map((document) => (
                                        <option key={document.id} value={document.id}>
                                            {document.title} (
                                            {ADMIN_DOCUMENT_CATEGORY_LABELS[document.category]})
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <Label htmlFor="shared_note">Push message (optional)</Label>
                            <textarea
                                id="shared_note"
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                                rows={3}
                                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                placeholder="Please review and acknowledge the provider agreement."
                            />
                        </div>
                        <div className="md:col-span-2">
                            <Button
                                type="submit"
                                disabled={sending || !selectedDocumentId || documents.length === 0}
                            >
                                <Send className="mr-2 h-4 w-4" />
                                {sending ? 'Sending…' : 'Send document'}
                            </Button>
                        </div>
                    </form>
                ) : null}
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
                <table className="min-w-full text-sm">
                    <thead className="border-b border-border bg-muted/50">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold">Document</th>
                            <th className="px-4 py-3 text-left font-semibold">Sent</th>
                            <th className="px-4 py-3 text-left font-semibold">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">
                                    Loading delivery history…
                                </td>
                            </tr>
                        ) : deliveries.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">
                                    No documents sent to this provider yet.
                                </td>
                            </tr>
                        ) : (
                            deliveries.map((delivery) => (
                                <tr key={delivery.id} className="border-b border-border/70">
                                    <td className="px-4 py-3">
                                        <p className="font-medium">
                                            {delivery.document_title ?? 'Document'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {delivery.file_name}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {formatDateTime(delivery.sent_at)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={
                                                delivery.acknowledged_at
                                                    ? 'inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary'
                                                    : 'inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800'
                                            }
                                        >
                                            {delivery.acknowledged_at ? 'Acknowledged' : 'Pending'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
