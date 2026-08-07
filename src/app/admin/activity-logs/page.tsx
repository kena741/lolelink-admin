'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Search,
} from 'lucide-react';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import {
    AdminErrorAlert,
    AdminFilterPanel,
    AdminLoadingRow,
    AdminSearchInput,
    AdminSelect,
    AdminShell,
} from '@/components/admin/admin-layout';
import { AdminTableShell } from '@/components/admin/data-table';
import { ActivityLogDetails } from '@/components/ActivityLogDetails';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchActivityLogs } from '@/features/admin/activityLogSlice';
import { hasActivityDetails } from '@/lib/activity-log-changes';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PAGE_SIZE = 30;

const ACTION_OPTIONS = ['create', 'update', 'delete', 'archive', 'restore', 'approve', 'reject', 'transfer', 'verify', 'activate'];
const RESOURCE_OPTIONS = ['admin', 'role', 'provider', 'customer', 'document', 'banner', 'withdrawal', 'job_request', 'settings', 'service', 'booking'];

function ActivityLogsPage() {
    const dispatch = useAppDispatch();
    const { logs, total, loading, error } = useAppSelector((state) => state.activityLog);
    const [query, setQuery] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const [resourceFilter, setResourceFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

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
                || (log.display_summary || log.summary || '').toLowerCase().includes(q)
                || (log.resource_name || '').toLowerCase().includes(q)
                || log.action.toLowerCase().includes(q)
                || log.resource_type.toLowerCase().includes(q)
                || JSON.stringify(log.metadata || {}).toLowerCase().includes(q)
            );
        });
    }, [logs, query]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    useEffect(() => {
        setCurrentPage(1);
    }, [actionFilter, resourceFilter, query]);

    return (
        <>
            <AdminShell>
                        <AdminPageHeader
                            title="Activity Logs"
                            description="Track actions performed by admin users"
                            actions={
                                <button
                                    type="button"
                                    onClick={() => {
                                        const offset = (currentPage - 1) * PAGE_SIZE;
                                        dispatch(fetchActivityLogs({
                                            action: actionFilter || undefined,
                                            resource_type: resourceFilter || undefined,
                                            limit: PAGE_SIZE,
                                            offset,
                                        }));
                                    }}
                                    className={adminHeaderButtonClassName()}
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                    Refresh
                                </button>
                            }
                        />
                        <AdminFilterPanel>
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                                <AdminSearchInput
                                    value={query}
                                    onChange={setQuery}
                                    placeholder="Search admin, summary, resource…"
                                    className="flex-1"
                                />
                                <AdminSelect value={actionFilter} onChange={setActionFilter}>
                                    <option value="">All actions</option>
                                    {ACTION_OPTIONS.map((action) => (
                                        <option key={action} value={action}>{action}</option>
                                    ))}
                                </AdminSelect>
                                <AdminSelect value={resourceFilter} onChange={setResourceFilter}>
                                    <option value="">All resources</option>
                                    {RESOURCE_OPTIONS.map((resource) => (
                                        <option key={resource} value={resource}>{resource}</option>
                                    ))}
                                </AdminSelect>
                            </div>
                        </AdminFilterPanel>

                        {loading ? <AdminLoadingRow label="Loading activity logs…" /> : null}
                        {error ? <AdminErrorAlert message={error} /> : null}

                        <AdminTableShell>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[60px]">#</TableHead>
                                            <TableHead>Admin</TableHead>
                                            <TableHead>Action</TableHead>
                                            <TableHead>Resource</TableHead>
                                            <TableHead>Summary</TableHead>
                                            <TableHead className="w-[120px]">Details</TableHead>
                                            <TableHead>When</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.map((log, idx) => {
                                            const isExpanded = expandedLogId === log.id;
                                            const canExpand = hasActivityDetails(log.metadata) || Boolean(log.resource_id) || Boolean(log.route);

                                            return (
                                            <React.Fragment key={log.id}>
                                            <TableRow>
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
                                                        {log.resource_name && (
                                                            <span className="text-sm text-gray-700">{log.resource_name}</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-md">
                                                    <span className="text-sm text-gray-700">{log.display_summary || log.summary}</span>
                                                </TableCell>
                                                <TableCell>
                                                    {canExpand ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                                            className="inline-flex h-8 items-center rounded-lg border border-indigo-200 bg-white px-3 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                                                        >
                                                            {isExpanded ? 'Hide' : 'View'}
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-sm text-gray-600">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                            {isExpanded ? (
                                                <TableRow className="bg-gray-50/80">
                                                    <TableCell colSpan={7} className="px-4 py-4">
                                                        <ActivityLogDetails
                                                            metadata={log.metadata}
                                                            resourceId={log.resource_id}
                                                            route={log.route}
                                                            env={log.env}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ) : null}
                                            </React.Fragment>
                                            );
                                        })}
                                        {filtered.length === 0 && !loading && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="px-4 py-12 text-center text-gray-500">
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
                        </AdminTableShell>

                        {total > 0 && (
                            <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-3 shadow-sm">
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
            </AdminShell>
        </>
    );
}

export default ActivityLogsPage;
