'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    Activity,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Search,
    X,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchActivityLogs } from '@/features/admin/activityLogSlice';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 30;

const ACTION_OPTIONS = ['create', 'update', 'delete', 'archive', 'restore', 'approve', 'reject', 'transfer', 'verify', 'activate'];
const RESOURCE_OPTIONS = ['admin', 'role', 'provider', 'customer', 'document', 'banner', 'withdrawal', 'job_request', 'settings', 'service'];

function ActivityLogsPage() {
    const dispatch = useAppDispatch();
    const { logs, total, loading, error } = useAppSelector((state) => state.activityLog);
    const [query, setQuery] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const [resourceFilter, setResourceFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const offset = (currentPage - 1) * PAGE_SIZE;
        dispatch(fetchActivityLogs({
            action: actionFilter || undefined,
            resource_type: resourceFilter || undefined,
            limit: PAGE_SIZE,
            offset,
        }));
    }, [dispatch, currentPage, actionFilter, resourceFilter]);

    const filtered = useMemo(() => {
        if (!query.trim()) return logs;
        const q = query.toLowerCase();
        return logs.filter((log) => {
            return (
                (log.admin_name || '').toLowerCase().includes(q)
                || (log.admin_email || '').toLowerCase().includes(q)
                || (log.summary || '').toLowerCase().includes(q)
                || (log.resource_id || '').toLowerCase().includes(q)
                || log.action.toLowerCase().includes(q)
                || log.resource_type.toLowerCase().includes(q)
            );
        });
    }, [logs, query]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    useEffect(() => {
        setCurrentPage(1);
    }, [actionFilter, resourceFilter, query]);

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
                                        <div className="rounded-lg bg-card/15 p-2 backdrop-blur-sm">
                                            <Activity className="h-6 w-6 text-primary-foreground" />
                                        </div>
                                        <h1 className="text-3xl font-bold tracking-tight text-primary-foreground drop-shadow-lg sm:text-4xl">
                                            Activity Logs
                                        </h1>
                                    </div>
                                    <p className="text-base font-medium text-primary-foreground/90">
                                        Track actions performed by admin users
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        const offset = (currentPage - 1) * PAGE_SIZE;
                                        dispatch(fetchActivityLogs({
                                            action: actionFilter || undefined,
                                            resource_type: resourceFilter || undefined,
                                            limit: PAGE_SIZE,
                                            offset,
                                        }));
                                    }}
                                    className="group inline-flex items-center gap-2 rounded-xl bg-card/15 px-4 py-3 text-sm font-semibold text-primary-foreground ring-2 ring-primary-foreground/20 transition-all hover:bg-card/25"
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center">
                            <div className="relative w-full max-w-md flex-1">
                                <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search admin, summary, resource…"
                                    className={cn(
                                        'w-full rounded-xl border border-white/20 bg-white/80 py-3 pl-12 text-sm text-gray-900 shadow-lg backdrop-blur-xl placeholder:text-gray-500 transition-all',
                                        'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200/50',
                                        query.trim() ? 'pr-12' : 'pr-5'
                                    )}
                                />
                                {query.trim() ? (
                                    <button
                                        type="button"
                                        aria-label="Clear search"
                                        onClick={() => setQuery('')}
                                        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                ) : null}
                            </div>
                            <select
                                value={actionFilter}
                                onChange={(event) => setActionFilter(event.target.value)}
                                className="h-11 rounded-xl border border-white/20 bg-white/80 px-4 text-sm text-gray-900 shadow-lg"
                            >
                                <option value="">All actions</option>
                                {ACTION_OPTIONS.map((action) => (
                                    <option key={action} value={action}>{action}</option>
                                ))}
                            </select>
                            <select
                                value={resourceFilter}
                                onChange={(event) => setResourceFilter(event.target.value)}
                                className="h-11 rounded-xl border border-white/20 bg-white/80 px-4 text-sm text-gray-900 shadow-lg"
                            >
                                <option value="">All resources</option>
                                {RESOURCE_OPTIONS.map((resource) => (
                                    <option key={resource} value={resource}>{resource}</option>
                                ))}
                            </select>
                        </div>

                        {error && (
                            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        {loading && (
                            <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Loading activity logs...
                            </div>
                        )}

                        <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/80 shadow-xl backdrop-blur-xl">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-b border-white/20 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
                                            <TableHead className="w-[60px] font-semibold text-gray-700">#</TableHead>
                                            <TableHead className="font-semibold text-gray-700">Admin</TableHead>
                                            <TableHead className="font-semibold text-gray-700">Action</TableHead>
                                            <TableHead className="font-semibold text-gray-700">Resource</TableHead>
                                            <TableHead className="font-semibold text-gray-700">Summary</TableHead>
                                            <TableHead className="font-semibold text-gray-700">When</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.map((log, idx) => (
                                            <TableRow
                                                key={log.id}
                                                className="border-b border-white/20 transition-all hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-purple-50/30"
                                            >
                                                <TableCell className="text-sm font-medium text-gray-500">
                                                    {(currentPage - 1) * PAGE_SIZE + idx + 1}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-indigo-700">
                                                            {log.admin_name || 'Unknown'}
                                                        </span>
                                                        <span className="text-xs text-gray-500">{log.admin_email || '—'}</span>
                                                        {log.admin_role && (
                                                            <span className="mt-1 inline-flex w-fit rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                                                                {log.admin_role}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                                        {log.action}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-gray-800">{log.resource_type}</span>
                                                        {log.resource_id && (
                                                            <span className="font-mono text-xs text-gray-500">{log.resource_id}</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-md">
                                                    <span className="text-sm text-gray-700">{log.summary}</span>
                                                    {log.route && (
                                                        <span className="mt-1 block font-mono text-[11px] text-gray-400">{log.route}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-sm text-gray-600">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {filtered.length === 0 && !loading && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="px-4 py-12 text-center text-gray-500">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                                                            <Search className="h-8 w-8 text-gray-400" />
                                                        </div>
                                                        <p className="text-lg font-semibold text-gray-900">No activity logs found</p>
                                                        <p className="text-sm text-gray-600">Actions will appear here after admins make changes</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {total > 0 && (
                            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/20 bg-white/80 px-6 py-3 shadow-lg backdrop-blur-xl">
                                <p className="text-sm text-gray-600">
                                    Total <span className="font-semibold text-gray-900">{total}</span> log entries
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={currentPage <= 1}
                                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <span className="min-w-[80px] text-center text-sm font-medium text-gray-700">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        disabled={currentPage >= totalPages}
                                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
}

export default ActivityLogsPage;
