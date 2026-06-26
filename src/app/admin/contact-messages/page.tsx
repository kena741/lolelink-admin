'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import {
    AdminErrorAlert,
    AdminFilterPanel,
    AdminLoadingRow,
    AdminSearchInput,
    AdminShell,
} from '@/components/admin/admin-layout';
import { AdminDataTableEmpty, AdminTableShell } from '@/components/admin/data-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ContactMessageRow {
    id: string;
    name?: string | null;
    email?: string | null;
    subject?: string | null;
    message?: string | null;
    created_at?: string | null;
}

function formatDate(value?: string | null): string {
    if (!value) return 'Unknown date';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Unknown date';
    return parsed.toLocaleString();
}

const ContactMessagesPage = () => {
    const [messages, setMessages] = useState<ContactMessageRow[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');

    async function fetchMessages() {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/contact-messages', { method: 'GET' });
            const payload = (await response.json()) as {
                data?: ContactMessageRow[];
                error?: string;
            };
            if (!response.ok)
                throw new Error(payload.error || 'Failed to load messages');
            setMessages(payload.data ?? []);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to load messages';
            setMessages([]);
            setError(message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchMessages();
    }, []);

    const filteredMessages = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return messages;
        return messages.filter((item) =>
            (item.name || '').toLowerCase().includes(normalizedQuery)
            || (item.email || '').toLowerCase().includes(normalizedQuery)
            || (item.subject || '').toLowerCase().includes(normalizedQuery)
            || (item.message || '').toLowerCase().includes(normalizedQuery)
        );
    }, [messages, query]);

    return (
        <AuthGuard>
            <AdminShell>
                        <AdminPageHeader
                            title="Contact Messages"
                            breadcrumbs={[
                                { label: 'Dashboard', href: '/admin/dashboard' },
                                { label: 'Contact Messages' },
                            ]}
                            actions={
                                <button
                                    type="button"
                                    onClick={fetchMessages}
                                    className={adminHeaderButtonClassName()}
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                    Refresh
                                </button>
                            }
                        />

                        <AdminFilterPanel>
                            <AdminSearchInput
                                value={query}
                                onChange={setQuery}
                                placeholder="Search by name, email, subject, message..."
                            />
                        </AdminFilterPanel>

                        {loading ? <AdminLoadingRow label="Loading messages…" /> : null}
                        {error ? <AdminErrorAlert message={error} /> : null}

                        <AdminTableShell>
                            {!loading && filteredMessages.length === 0 ? (
                                <AdminDataTableEmpty
                                    title="No messages found"
                                    description="Contact form submissions will appear here"
                                />
                            ) : !loading ? (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead>Subject</TableHead>
                                                <TableHead>Message</TableHead>
                                                <TableHead>Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredMessages.map((item) => (
                                                <TableRow key={item.id} className="align-top">
                                                    <TableCell className="font-medium">{item.name || 'Unknown'}</TableCell>
                                                    <TableCell>{item.email || 'No email'}</TableCell>
                                                    <TableCell>{item.subject || 'No subject'}</TableCell>
                                                    <TableCell className="max-w-[440px] whitespace-pre-wrap">
                                                        {item.message || 'No message'}
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap">{formatDate(item.created_at)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : null}
                        </AdminTableShell>
            </AdminShell>
        </AuthGuard>
    );
};

export default ContactMessagesPage;
