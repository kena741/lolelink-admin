'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, RefreshCw } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
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
            <div className="flex min-h-screen bg-background">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    <div className="relative isolate overflow-hidden bg-primary transition-colors dark:!bg-sidebar dark:border-b dark:border-sidebar-border">
                        <div className="relative mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-8">
                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <div className="mb-2 flex items-center gap-3">
                                        <Link
                                            href="/admin/dashboard"
                                            className="rounded-lg bg-card/15 p-2 backdrop-blur-sm transition-colors hover:bg-card/25"
                                        >
                                            <ArrowLeft className="h-5 w-5 text-primary-foreground" />
                                        </Link>
                                        <div className="rounded-lg bg-card/15 p-2 backdrop-blur-sm">
                                            <Mail className="h-6 w-6 text-primary-foreground" />
                                        </div>
                                        <h1 className="text-3xl font-bold tracking-tight text-primary-foreground drop-shadow-lg sm:text-4xl">
                                            Contact Messages
                                        </h1>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-primary-foreground/90">
                                        <Link href="/admin/dashboard" className="transition-colors hover:text-primary-foreground">
                                            Dashboard
                                        </Link>
                                        <span>/</span>
                                        <span className="font-semibold text-primary-foreground">Contact Messages</span>
                                    </div>
                                </div>
                                <button
                                    onClick={fetchMessages}
                                    className="group inline-flex items-center gap-2 rounded-xl bg-card/15 px-4 py-3 text-sm font-semibold text-primary-foreground ring-2 ring-primary-foreground/20 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-card/25 hover:ring-primary-foreground/35"
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
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
