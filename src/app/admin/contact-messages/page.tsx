'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, RefreshCw } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
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
            <div className="flex min-h-screen">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
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
                        <div className="mb-4">
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search by name, email, subject, message..."
                                className="w-full rounded-md border border-subtle bg-base px-4 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-info"
                            />
                        </div>
                        <section className="rounded-2xl border border-subtle bg-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                            {error ? (
                                <p className="text-sm font-medium text-accent-error">{error}</p>
                            ) : loading ? (
                                <p className="text-sm text-secondary">Loading messages...</p>
                            ) : filteredMessages.length === 0 ? (
                                <p className="text-sm text-secondary">No messages found.</p>
                            ) : (
                                <div className="overflow-hidden rounded-md border border-subtle bg-base">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-subtle/70">
                                                <TableHead className="text-primary">Name</TableHead>
                                                <TableHead className="text-primary">Email</TableHead>
                                                <TableHead className="text-primary">Subject</TableHead>
                                                <TableHead className="text-primary">Message</TableHead>
                                                <TableHead className="text-primary">Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredMessages.map((item) => (
                                                <TableRow key={item.id} className="align-top">
                                                    <TableCell className="font-medium text-primary">{item.name || 'Unknown'}</TableCell>
                                                    <TableCell className="text-primary">{item.email || 'No email'}</TableCell>
                                                    <TableCell className="text-primary">{item.subject || 'No subject'}</TableCell>
                                                    <TableCell className="max-w-[440px] whitespace-pre-wrap text-primary">
                                                        {item.message || 'No message'}
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap text-primary">{formatDate(item.created_at)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </section>
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
};

export default ContactMessagesPage;
