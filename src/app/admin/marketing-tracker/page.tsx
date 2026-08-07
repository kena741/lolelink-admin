'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';
import {
    AdminErrorAlert,
    AdminLoadingRow,
    AdminSearchInput,
    AdminShell,
    AdminStatCard,
} from '@/components/admin/admin-layout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
    AssigneePerformance,
    MarketingTrackerCellValue,
    MarketingTrackerColumn,
    MarketingTrackerRow,
    MarketingTrackerSheet,
} from '@/lib/marketing-tracker';
import {
    clampColumnWidthPx,
    computeSheetAnalytics,
    createLocalId,
    isLocalId,
    isPhantomRowId,
    normalizeColumnType,
    PHANTOM_ROW_ID,
    resolveColumnWidthPx,
    slugifyColumnLabel,
    stripColumnKeyFromValues,
} from '@/lib/marketing-tracker';
import { cn } from '@/lib/utils';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';

const gridIconButtonClassName =
    'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const ROW_GUTTER_PX = 36;

interface DeleteConfirmState {
    kind: 'row' | 'column' | 'sheet';
    id: string;
    title: string;
    description: string;
}

function cellDisplayValue(value: MarketingTrackerCellValue): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return value;
}

function rowMatchesQuery(
    row: MarketingTrackerRow,
    columns: MarketingTrackerColumn[],
    query: string
): boolean {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return columns.some((column) => {
        const value = row.values[column.key];
        return cellDisplayValue(value).toLowerCase().includes(normalized);
    });
}

interface TrackerCellEditorProps {
    column: MarketingTrackerColumn;
    value: MarketingTrackerCellValue;
    onChange: (value: MarketingTrackerCellValue) => void;
    filled?: boolean;
}

function TrackerCellEditor({ column, value, onChange, filled = false, readOnly = false }: TrackerCellEditorProps & { readOnly?: boolean }) {
    if (column.column_type === 'boolean') {
        const checked = value === true;
        return (
            <label className={cn('flex h-9 items-center gap-2 px-2', readOnly ? 'cursor-default' : 'cursor-pointer')}>
                <input
                    type="checkbox"
                    checked={checked}
                    disabled={readOnly}
                    onChange={(event) => onChange(event.target.checked)}
                    className="h-4 w-4 rounded border border-input accent-primary focus:ring-2 focus:ring-ring/40"
                />
                <span className="text-sm text-muted-foreground">{checked ? 'Yes' : 'No'}</span>
            </label>
        );
    }

    if (column.column_type === 'date') {
        const dateValue = typeof value === 'string' ? value : '';
        return (
            <Input
                type="date"
                value={dateValue}
                readOnly={readOnly}
                disabled={readOnly}
                onChange={(event) => onChange(event.target.value || null)}
                className="h-9 border-0 bg-transparent px-2 shadow-none focus-visible:ring-1"
            />
        );
    }

    const textCellClassName = filled
        ? 'h-9 min-w-0 w-full border-0 bg-muted px-2 shadow-none outline-none ring-0 focus:border-0 focus:bg-muted focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:ring-0'
        : 'h-9 min-w-0 w-full border-0 bg-transparent px-2 shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:ring-0';

    const textValue = typeof value === 'string' ? value : '';
    if (column.key === 'note') {
        return (
            <textarea
                value={textValue}
                readOnly={readOnly}
                onChange={(event) => onChange(event.target.value)}
                rows={2}
                className={`min-h-9 min-w-0 w-full resize-y overflow-hidden rounded-none px-2 py-1.5 text-sm ${textCellClassName}`}
            />
        );
    }

    return (
        <Input
            value={textValue}
            readOnly={readOnly}
            onChange={(event) => onChange(event.target.value)}
            className={textCellClassName}
        />
    );
}

interface ColumnHeaderProps {
    column: MarketingTrackerColumn;
    widthPx: number;
    isSticky: boolean;
    onResize: (columnId: string, widthPx: number, persist?: boolean) => void;
    onDelete?: (columnId: string) => void;
}

function ColumnHeader({ column, widthPx, isSticky, onResize, onDelete }: ColumnHeaderProps) {
    function handleResizeStart(event: React.MouseEvent<HTMLButtonElement>) {
        if (!onDelete) return;
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startWidth = widthPx;

        function handleMouseMove(moveEvent: MouseEvent) {
            onResize(column.id, clampColumnWidthPx(startWidth + moveEvent.clientX - startX));
        }

        function handleMouseUp(moveEvent: MouseEvent) {
            onResize(column.id, clampColumnWidthPx(startWidth + moveEvent.clientX - startX), true);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    return (
        <th
            style={{
                width: widthPx,
                minWidth: widthPx,
                maxWidth: widthPx,
                ...(isSticky ? { left: ROW_GUTTER_PX } : {}),
            }}
            className={`group relative overflow-hidden border-b border-r border-border/60 px-2 py-2 text-left text-xs font-medium text-muted-foreground ${
                isSticky ? 'sticky z-45 bg-muted' : 'bg-muted'
            }`}
        >
            <div className="flex min-w-0 items-center gap-1 pr-2">
                <span className="min-w-0 flex-1 truncate">{column.label}</span>
                {onDelete ? (
                <button
                    type="button"
                    aria-label={`Delete ${column.label} column`}
                    onClick={(event) => {
                        event.stopPropagation();
                        onDelete(column.id);
                    }}
                    className={cn(
                        gridIconButtonClassName,
                        'h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive'
                    )}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
                ) : null}
            </div>
            <button
                type="button"
                aria-label={`Resize ${column.label} column`}
                onMouseDown={handleResizeStart}
                className="absolute right-0 top-0 z-40 h-full w-2 cursor-col-resize touch-none border-0 bg-transparent p-0 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
        </th>
    );
}

function AssigneeBreakdownPanel({
    assignees,
    loading,
    onClose,
}: {
    assignees: AssigneePerformance[];
    loading: boolean;
    onClose: () => void;
}) {
    if (loading) {
        return (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                Loading assignee breakdown…
            </div>
        );
    }

    if (assignees.length === 0) return null;

    return (
        <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                    <h3 className="text-sm font-semibold text-foreground">Assignee performance</h3>
                    <p className="text-xs text-muted-foreground">Contact and onboard rates by assignee</p>
                </div>
                <button
                    type="button"
                    aria-label="Close assignee breakdown"
                    onClick={onClose}
                    className={gridIconButtonClassName}
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {assignees.map((assignee) => (
                    <div
                        key={assignee.assignee}
                        className="rounded-lg border border-border/60 bg-muted/20 p-3"
                    >
                        <div className="mb-3 flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-medium text-foreground">
                                {assignee.assignee}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                {assignee.leads} leads
                            </span>
                        </div>
                        <div className="space-y-2.5">
                            <div>
                                <div className="mb-1 flex justify-between text-xs">
                                    <span className="text-muted-foreground">Contacted</span>
                                    <span className="tabular-nums text-foreground">
                                        {assignee.contacted} · {assignee.contactRate}%
                                    </span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div
                                        className="h-full rounded-full bg-primary transition-all duration-200"
                                        style={{ width: `${assignee.contactRate}%` }}
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="mb-1 flex justify-between text-xs">
                                    <span className="text-muted-foreground">Onboarded</span>
                                    <span className="tabular-nums text-foreground">
                                        {assignee.onboarded} · {assignee.onboardRate}%
                                    </span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div
                                        className="h-full rounded-full bg-emerald-500 transition-all duration-200"
                                        style={{ width: `${assignee.onboardRate}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SheetMetricsSection({
    sheetName,
    loading,
    analytics,
    assigneePanelOpen,
    onAssigneePanelOpen,
    onAssigneePanelClose,
}: {
    sheetName: string | null;
    loading: boolean;
    analytics: ReturnType<typeof computeSheetAnalytics>;
    assigneePanelOpen: boolean;
    onAssigneePanelOpen: () => void;
    onAssigneePanelClose: () => void;
}) {
    return (
        <section className="mb-6 space-y-4">
            <p className="text-sm font-medium text-muted-foreground">
                {sheetName ? `${sheetName} metrics` : 'Sheet metrics'}
            </p>
            <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
                <AdminStatCard title="Total Leads" value={loading ? '…' : String(analytics.total)} />
                <AdminStatCard
                    title="Contacted"
                    value={loading ? '…' : String(analytics.contacted)}
                    valueClassName="text-primary"
                />
                <AdminStatCard
                    title="Onboarded"
                    value={loading ? '…' : String(analytics.onboarded)}
                    valueClassName="text-emerald-600"
                />
                <AdminStatCard
                    title="Pending Contact"
                    value={loading ? '…' : String(analytics.pendingContact)}
                    valueClassName="text-amber-600"
                />
            </div>
            <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
                <AdminStatCard
                    title="Contact Rate"
                    value={loading ? '…' : `${analytics.contactRate}%`}
                />
                <AdminStatCard
                    title="Onboard Rate"
                    value={loading ? '…' : `${analytics.onboardRate}%`}
                />
                <AdminStatCard title="Trainers" value={loading ? '…' : String(analytics.trainers)} />
                <AdminStatCard
                    title="Unassigned"
                    value={loading ? '…' : String(analytics.unassigned)}
                    valueClassName="text-muted-foreground"
                />
            </div>
            {assigneePanelOpen ? (
                <AssigneeBreakdownPanel
                    assignees={analytics.assignees}
                    loading={loading}
                    onClose={onAssigneePanelClose}
                />
            ) : !loading && analytics.assignees.length > 0 ? (
                <button
                    type="button"
                    onClick={onAssigneePanelOpen}
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    Show assignee breakdown
                </button>
            ) : null}
        </section>
    );
}

export default function MarketingTrackerPage() {
    const { canWriteCatalog } = useAdminPermissions();
    const [sheets, setSheets] = useState<MarketingTrackerSheet[]>([]);
    const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
    const [columns, setColumns] = useState<MarketingTrackerColumn[]>([]);
    const [rows, setRows] = useState<MarketingTrackerRow[]>([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [sheetLoading, setSheetLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [addColumnOpen, setAddColumnOpen] = useState(false);
    const [addSheetOpen, setAddSheetOpen] = useState(false);
    const [newSheetName, setNewSheetName] = useState('');
    const [newColumnLabel, setNewColumnLabel] = useState('');
    const [newColumnType, setNewColumnType] = useState<'text' | 'yes-no' | 'date'>('text');
    const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
    const [editingSheetName, setEditingSheetName] = useState('');
    const [assigneePanelOpen, setAssigneePanelOpen] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
    const [deleteConfirmLoading, setDeleteConfirmLoading] = useState(false);
    const pendingFocusRowId = useRef<string | null>(null);
    const pendingFocusColumnKey = useRef<string | null>(null);
    const phantomPromotedRowId = useRef<string | null>(null);
    const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const widthSaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const rowCreatePromises = useRef<Map<string, Promise<string>>>(new Map());
    const sheetCreatePromises = useRef<Map<string, Promise<string>>>(new Map());

    const loadTracker = useCallback(async (sheetId?: string | null, options?: { initial?: boolean }) => {
        const isInitial = options?.initial ?? false;
        if (isInitial) setInitialLoading(true);
        else setSheetLoading(true);
        setError(null);
        try {
            const queryParam = sheetId ? `?sheet_id=${encodeURIComponent(sheetId)}` : '';
            const response = await fetch(`/api/admin/marketing-tracker${queryParam}`);
            const payload = (await response.json()) as {
                sheets?: MarketingTrackerSheet[];
                active_sheet_id?: string | null;
                columns?: MarketingTrackerColumn[];
                rows?: MarketingTrackerRow[];
                error?: string;
            };
            if (!response.ok) throw new Error(payload.error || 'Failed to load marketing tracker');
            setSheets(payload.sheets ?? []);
            setActiveSheetId(payload.active_sheet_id ?? null);
            setColumns(payload.columns ?? []);
            setRows(payload.rows ?? []);
        } catch (loadError: unknown) {
            const message = loadError instanceof Error ? loadError.message : 'Failed to load marketing tracker';
            setError(message);
        } finally {
            if (isInitial) setInitialLoading(false);
            else setSheetLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadTracker(null, { initial: true });
    }, [loadTracker]);

    useEffect(() => {
        phantomPromotedRowId.current = null;
    }, [activeSheetId, query]);

    const resolveSheetId = useCallback(async (sheetId: string): Promise<string> => {
        if (!isLocalId(sheetId)) return sheetId;
        const pending = sheetCreatePromises.current.get(sheetId);
        if (!pending) return sheetId;
        return pending;
    }, []);

    const resolveRowId = useCallback(async (rowId: string): Promise<string> => {
        if (!isLocalId(rowId)) return rowId;
        const pending = rowCreatePromises.current.get(rowId);
        if (!pending) return rowId;
        return pending;
    }, []);

    function handleSelectSheet(sheetId: string) {
        if (sheetId === activeSheetId || isLocalId(sheetId)) return;
        setQuery('');
        void loadTracker(sheetId);
    }

    useEffect(() => {
        if (!pendingFocusRowId.current) return;
        const rowId = pendingFocusRowId.current;
        const columnKey = pendingFocusColumnKey.current;
        const columnSelector = columnKey
            ? `[data-cell-key="${columnKey}"]`
            : '[data-first-cell="true"]';
        const cell = document.querySelector<HTMLElement>(
            `[data-row-id="${rowId}"] ${columnSelector} input, [data-row-id="${rowId}"] ${columnSelector} textarea`
        );
        cell?.focus();
        phantomPromotedRowId.current = null;
        pendingFocusRowId.current = null;
        pendingFocusColumnKey.current = null;
    }, [rows]);

    const filteredRows = useMemo(
        () => rows.filter((row) => rowMatchesQuery(row, columns, query)),
        [rows, columns, query]
    );

    const displayRows = useMemo(() => {
        if (columns.length === 0 || query.trim()) return filteredRows;
        const phantomRow: MarketingTrackerRow = {
            id: PHANTOM_ROW_ID,
            sheet_id: activeSheetId ?? '',
            position: rows.length + 1,
            values: {},
            created_at: '',
            updated_at: '',
        };
        return [...filteredRows, phantomRow];
    }, [filteredRows, columns.length, query, activeSheetId, rows.length]);

    const analytics = useMemo(() => computeSheetAnalytics(rows), [rows]);
    const activeSheetName = sheets.find((sheet) => sheet.id === activeSheetId)?.name ?? null;
    const metricsLoading = initialLoading || sheetLoading;

    const stickyColumnKey =
        columns.find((column) => column.key === 'business_name')?.key ?? columns[0]?.key ?? null;

    const columnWidths = useMemo(() => {
        const widths = new Map<string, number>();
        for (const column of columns) {
            widths.set(column.id, resolveColumnWidthPx(column));
        }
        return widths;
    }, [columns]);

    const saveColumnWidth = useCallback(async (columnId: string, widthPx: number) => {
        if (!canWriteCatalog) return;
        if (isLocalId(columnId)) return;
        const response = await fetch(`/api/admin/marketing-tracker/columns/${columnId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ width_px: widthPx }),
        });
        const payload = (await response.json()) as { column?: MarketingTrackerColumn; error?: string };
        if (!response.ok) throw new Error(payload.error || 'Failed to save column width');
        if (payload.column) {
            setColumns((current) =>
                current.map((column) => (column.id === columnId ? payload.column! : column))
            );
        }
    }, [canWriteCatalog]);

    const handleColumnResize = useCallback(
        (columnId: string, widthPx: number, persist = false) => {
            if (!canWriteCatalog) return;
            setColumns((current) =>
                current.map((column) =>
                    column.id === columnId ? { ...column, width_px: widthPx } : column
                )
            );

            if (!persist) return;

            const existing = widthSaveTimers.current.get(columnId);
            if (existing) clearTimeout(existing);

            widthSaveTimers.current.set(
                columnId,
                setTimeout(() => {
                    void saveColumnWidth(columnId, widthPx).catch((saveError: unknown) => {
                        const message =
                            saveError instanceof Error ? saveError.message : 'Failed to save column width';
                        setError(message);
                    });
                    widthSaveTimers.current.delete(columnId);
                }, 300)
            );
        },
        [canWriteCatalog, saveColumnWidth]
    );

    const patchCell = useCallback(
        async (rowId: string, columnKey: string, value: MarketingTrackerCellValue) => {
            if (!canWriteCatalog) return;
            const resolvedRowId = await resolveRowId(rowId);
            const response = await fetch(`/api/admin/marketing-tracker/rows/${resolvedRowId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: { [columnKey]: value } }),
            });
            const payload = (await response.json()) as { row?: MarketingTrackerRow; error?: string };
            if (!response.ok) throw new Error(payload.error || 'Failed to save cell');
            if (payload.row) {
                setRows((current) =>
                    current.map((row) => {
                        if (row.id !== rowId && row.id !== resolvedRowId) return row;
                        return {
                            ...payload.row!,
                            values: { ...payload.row!.values, ...row.values },
                        };
                    })
                );
            }
        },
        [canWriteCatalog, resolveRowId]
    );

    const insertRowAfter = useCallback(
        (
            afterRowId: string | null,
            initialValues?: Record<string, MarketingTrackerCellValue>,
            focusColumnKey?: string
        ): string => {
            if (!canWriteCatalog) return '';
            if (!activeSheetId) return '';
            setError(null);

            const tempId = createLocalId();
            const now = new Date().toISOString();
            let insertPosition = rows.length + 1;
            let insertIndex = rows.length;

            if (afterRowId) {
                const afterIndex = rows.findIndex((row) => row.id === afterRowId);
                if (afterIndex >= 0) {
                    insertPosition = rows[afterIndex].position + 1;
                    insertIndex = afterIndex + 1;
                }
            }

            const optimisticRow: MarketingTrackerRow = {
                id: tempId,
                sheet_id: activeSheetId,
                position: insertPosition,
                values: initialValues ?? {},
                created_at: now,
                updated_at: now,
            };

            setRows((current) => {
                const next = current.map((row) =>
                    row.position >= insertPosition ? { ...row, position: row.position + 1 } : row
                );
                next.splice(insertIndex, 0, optimisticRow);
                return [...next].sort((left, right) => left.position - right.position);
            });

            pendingFocusRowId.current = tempId;
            pendingFocusColumnKey.current =
                focusColumnKey ?? columns[0]?.key ?? null;

            const createPromise = (async () => {
                const sheetId = await resolveSheetId(activeSheetId);
                const body: { sheet_id: string; after_row_id?: string } = { sheet_id: sheetId };
                if (afterRowId) {
                    const resolvedAfterId = await resolveRowId(afterRowId);
                    if (!isLocalId(resolvedAfterId)) {
                        body.after_row_id = resolvedAfterId;
                    }
                }

                const response = await fetch('/api/admin/marketing-tracker/rows', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const payload = (await response.json()) as { row?: MarketingTrackerRow; error?: string };
                if (!response.ok || !payload.row) {
                    throw new Error(payload.error || 'Failed to add row');
                }

                let savedRow = payload.row;
                if (initialValues && Object.keys(initialValues).length > 0) {
                    const patchResponse = await fetch(`/api/admin/marketing-tracker/rows/${savedRow.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ values: initialValues }),
                    });
                    const patchPayload = (await patchResponse.json()) as {
                        row?: MarketingTrackerRow;
                        error?: string;
                    };
                    if (!patchResponse.ok || !patchPayload.row) {
                        throw new Error(patchPayload.error || 'Failed to save row');
                    }
                    savedRow = patchPayload.row;
                }

                setRows((current) =>
                    [...current.map((row) => (row.id === tempId ? savedRow! : row))].sort(
                        (left, right) => left.position - right.position
                    )
                );
                if (pendingFocusRowId.current === tempId) {
                    pendingFocusRowId.current = savedRow.id;
                }
                if (phantomPromotedRowId.current === tempId) {
                    phantomPromotedRowId.current = savedRow.id;
                }
                return savedRow.id;
            })();

            rowCreatePromises.current.set(tempId, createPromise);
            void createPromise.catch((addError: unknown) => {
                if (phantomPromotedRowId.current === tempId) {
                    phantomPromotedRowId.current = null;
                }
                setRows((current) =>
                    current
                        .filter((row) => row.id !== tempId)
                        .map((row, index) => ({ ...row, position: index + 1 }))
                );
                const message = addError instanceof Error ? addError.message : 'Failed to add row';
                setError(message);
            }).finally(() => {
                rowCreatePromises.current.delete(tempId);
            });

            return tempId;
        },
        [canWriteCatalog, activeSheetId, columns, rows, resolveRowId, resolveSheetId]
    );

    const applyRowCellSave = useCallback(
        (rowId: string, columnKey: string, value: MarketingTrackerCellValue) => {
            if (!canWriteCatalog) return;
            setRows((current) =>
                current.map((row) =>
                    row.id === rowId
                        ? { ...row, values: { ...row.values, [columnKey]: value } }
                        : row
                )
            );

            const timerKey = `${rowId}:${columnKey}`;
            const existing = saveTimers.current.get(timerKey);
            if (existing) clearTimeout(existing);

            saveTimers.current.set(
                timerKey,
                setTimeout(() => {
                    void patchCell(rowId, columnKey, value).catch((saveError: unknown) => {
                        const message = saveError instanceof Error ? saveError.message : 'Failed to save cell';
                        setError(message);
                    });
                    saveTimers.current.delete(timerKey);
                }, 400)
            );
        },
        [canWriteCatalog, patchCell]
    );

    const scheduleSave = useCallback(
        (rowId: string, columnKey: string, value: MarketingTrackerCellValue) => {
            if (isPhantomRowId(rowId)) {
                const promotedRowId = phantomPromotedRowId.current;
                if (promotedRowId) {
                    applyRowCellSave(promotedRowId, columnKey, value);
                    return;
                }

                const isEmpty = value === null || value === '' || value === false;
                if (isEmpty) return;

                const tempId = insertRowAfter(
                    rows.length > 0 ? rows[rows.length - 1].id : null,
                    { [columnKey]: value },
                    columnKey
                );
                if (tempId) phantomPromotedRowId.current = tempId;
                return;
            }

            applyRowCellSave(rowId, columnKey, value);
        },
        [applyRowCellSave, insertRowAfter, rows]
    );

    async function handleDeleteRow(rowId: string) {
        if (!canWriteCatalog) return;
        if (isPhantomRowId(rowId)) return;
        setError(null);

        if (isLocalId(rowId)) {
            setRows((current) => current.filter((row) => row.id !== rowId));
            rowCreatePromises.current.delete(rowId);
            return;
        }

        try {
            const response = await fetch(`/api/admin/marketing-tracker/rows/${rowId}`, { method: 'DELETE' });
            const payload = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(payload.error || 'Failed to delete row');
            setRows((current) => current.filter((row) => row.id !== rowId));
        } catch (deleteError: unknown) {
            const message = deleteError instanceof Error ? deleteError.message : 'Failed to delete row';
            setError(message);
        }
    }

    function requestDeleteRow(rowId: string) {
        if (isPhantomRowId(rowId)) return;
        setDeleteConfirm({
            kind: 'row',
            id: rowId,
            title: 'Delete row?',
            description: 'This row will be permanently removed from the sheet.',
        });
    }

    async function handleDeleteColumn(columnId: string) {
        if (!canWriteCatalog) return;
        const column = columns.find((candidate) => candidate.id === columnId);
        if (!column) return;
        setError(null);

        if (isLocalId(columnId)) {
            setColumns((current) => current.filter((candidate) => candidate.id !== columnId));
            return;
        }

        const previousColumns = columns;
        const previousRows = rows;
        setColumns((current) => current.filter((candidate) => candidate.id !== columnId));
        setRows((current) =>
            current.map((row) => ({
                ...row,
                values: stripColumnKeyFromValues(row.values, column.key),
            }))
        );

        try {
            const response = await fetch(`/api/admin/marketing-tracker/columns/${columnId}`, {
                method: 'DELETE',
            });
            const payload = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(payload.error || 'Failed to delete column');
        } catch (deleteError: unknown) {
            setColumns(previousColumns);
            setRows(previousRows);
            const message = deleteError instanceof Error ? deleteError.message : 'Failed to delete column';
            setError(message);
        }
    }

    function requestDeleteColumn(columnId: string) {
        const column = columns.find((candidate) => candidate.id === columnId);
        if (!column) return;
        setDeleteConfirm({
            kind: 'column',
            id: columnId,
            title: `Delete "${column.label}"?`,
            description: 'All values in this column will be permanently removed.',
        });
    }

    function startSheetRename(sheetId: string, currentName: string) {
        setEditingSheetId(sheetId);
        setEditingSheetName(currentName);
    }

    function cancelSheetRename() {
        setEditingSheetId(null);
        setEditingSheetName('');
    }

    async function commitSheetRename(sheetId: string) {
        if (!canWriteCatalog) return;
        const trimmed = editingSheetName.trim();
        const sheet = sheets.find((candidate) => candidate.id === sheetId);
        if (!sheet) {
            cancelSheetRename();
            return;
        }
        if (!trimmed || trimmed === sheet.name) {
            cancelSheetRename();
            return;
        }

        setError(null);
        const previousName = sheet.name;
        setSheets((current) =>
            current.map((candidate) =>
                candidate.id === sheetId ? { ...candidate, name: trimmed } : candidate
            )
        );
        cancelSheetRename();

        if (isLocalId(sheetId)) return;

        try {
            const response = await fetch(`/api/admin/marketing-tracker/sheets/${sheetId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmed }),
            });
            const payload = (await response.json()) as { sheet?: MarketingTrackerSheet; error?: string };
            if (!response.ok || !payload.sheet) {
                throw new Error(payload.error || 'Failed to rename sheet');
            }
            setSheets((current) =>
                current.map((candidate) => (candidate.id === sheetId ? payload.sheet! : candidate))
            );
        } catch (renameError: unknown) {
            setSheets((current) =>
                current.map((candidate) =>
                    candidate.id === sheetId ? { ...candidate, name: previousName } : candidate
                )
            );
            const message = renameError instanceof Error ? renameError.message : 'Failed to rename sheet';
            setError(message);
        }
    }

    async function handleDeleteSheet(sheetId: string) {
        if (!canWriteCatalog) return;
        if (sheets.length <= 1) {
            setError('Cannot delete the last sheet');
            return;
        }
        const sheet = sheets.find((candidate) => candidate.id === sheetId);
        if (!sheet) return;
        setError(null);

        if (isLocalId(sheetId)) {
            setSheets((current) => {
                const remaining = current.filter((candidate) => candidate.id !== sheetId);
                if (activeSheetId === sheetId) {
                    const fallback = remaining[0];
                    setActiveSheetId(fallback?.id ?? null);
                    setColumns([]);
                    setRows([]);
                    if (fallback) void loadTracker(fallback.id);
                }
                return remaining;
            });
            sheetCreatePromises.current.delete(sheetId);
            return;
        }

        const previousSheets = sheets;
        const wasActive = activeSheetId === sheetId;
        const remaining = sheets.filter((candidate) => candidate.id !== sheetId);
        const fallback = remaining[0];

        setSheets(remaining);
        if (wasActive && fallback) {
            setActiveSheetId(fallback.id);
            void loadTracker(fallback.id);
        } else if (wasActive) {
            setActiveSheetId(null);
            setColumns([]);
            setRows([]);
        }

        try {
            const response = await fetch(`/api/admin/marketing-tracker/sheets/${sheetId}`, {
                method: 'DELETE',
            });
            const payload = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(payload.error || 'Failed to delete sheet');
        } catch (deleteError: unknown) {
            setSheets(previousSheets);
            if (wasActive) {
                setActiveSheetId(sheetId);
                void loadTracker(sheetId);
            }
            const message = deleteError instanceof Error ? deleteError.message : 'Failed to delete sheet';
            setError(message);
        }
    }

    function requestDeleteSheet(sheetId: string) {
        if (sheets.length <= 1) {
            setError('Cannot delete the last sheet');
            return;
        }
        const sheet = sheets.find((candidate) => candidate.id === sheetId);
        if (!sheet) return;
        setDeleteConfirm({
            kind: 'sheet',
            id: sheetId,
            title: `Delete "${sheet.name}"?`,
            description: 'This sheet and all of its columns and rows will be permanently removed.',
        });
    }

    async function confirmDelete() {
        if (!deleteConfirm || deleteConfirmLoading) return;
        setDeleteConfirmLoading(true);
        try {
            if (deleteConfirm.kind === 'row') {
                await handleDeleteRow(deleteConfirm.id);
            } else if (deleteConfirm.kind === 'column') {
                await handleDeleteColumn(deleteConfirm.id);
            } else {
                await handleDeleteSheet(deleteConfirm.id);
            }
            setDeleteConfirm(null);
        } finally {
            setDeleteConfirmLoading(false);
        }
    }

    function handleAddColumn() {
        if (!canWriteCatalog) return;
        if (!activeSheetId) return;
        const label = newColumnLabel.trim();
        if (!label) {
            setError('Column name is required');
            return;
        }

        const columnType = normalizeColumnType(newColumnType);
        if (!columnType) {
            setError('Invalid column type');
            return;
        }
        const columnTypeParam = newColumnType;

        setError(null);
        const tempId = createLocalId();
        const now = new Date().toISOString();
        const optimisticColumn: MarketingTrackerColumn = {
            id: tempId,
            sheet_id: activeSheetId,
            key: slugifyColumnLabel(label),
            label,
            column_type: columnType,
            position: columns.length + 1,
            is_system: false,
            width_px: null,
            created_at: now,
        };

        setColumns((current) => [...current, optimisticColumn]);
        setNewColumnLabel('');
        setNewColumnType('text');
        setAddColumnOpen(false);

        void (async () => {
            try {
                const sheetId = await resolveSheetId(activeSheetId);
                const response = await fetch('/api/admin/marketing-tracker/columns', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sheet_id: sheetId, label, column_type: columnTypeParam }),
                });
                const payload = (await response.json()) as { column?: MarketingTrackerColumn; error?: string };
                if (!response.ok || !payload.column) {
                    throw new Error(payload.error || 'Failed to add column');
                }
                setColumns((current) =>
                    current.map((column) => (column.id === tempId ? payload.column! : column))
                );
            } catch (addError: unknown) {
                setColumns((current) => current.filter((column) => column.id !== tempId));
                const message = addError instanceof Error ? addError.message : 'Failed to add column';
                setError(message);
            }
        })();
    }

    function handleAddSheet() {
        if (!canWriteCatalog) return;
        const name = newSheetName.trim() || `Sheet ${sheets.length + 1}`;
        setError(null);

        const tempSheetId = createLocalId();
        const now = new Date().toISOString();
        const optimisticSheet: MarketingTrackerSheet = {
            id: tempSheetId,
            name,
            position: sheets.length + 1,
            created_at: now,
        };

        setSheets((current) => [...current, optimisticSheet]);
        setActiveSheetId(tempSheetId);
        setColumns([]);
        setRows([]);
        setQuery('');
        setNewSheetName('');
        setAddSheetOpen(false);

        const createPromise = (async () => {
            const response = await fetch('/api/admin/marketing-tracker/sheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const payload = (await response.json()) as {
                sheet?: MarketingTrackerSheet;
                columns?: MarketingTrackerColumn[];
                rows?: MarketingTrackerRow[];
                error?: string;
            };
            if (!response.ok || !payload.sheet) {
                throw new Error(payload.error || 'Failed to add sheet');
            }

            setSheets((current) =>
                current.map((sheet) => (sheet.id === tempSheetId ? payload.sheet! : sheet))
            );
            setActiveSheetId((current) => (current === tempSheetId ? payload.sheet!.id : current));
            setColumns((current) =>
                current.some((column) => column.sheet_id === tempSheetId)
                    ? (payload.columns ?? [])
                    : current
            );
            setRows((current) =>
                current.some((row) => row.sheet_id === tempSheetId) ? (payload.rows ?? []) : current
            );
            return payload.sheet.id;
        })();

        sheetCreatePromises.current.set(tempSheetId, createPromise);
        void createPromise.catch((addError: unknown) => {
            setSheets((current) => {
                const remaining = current.filter((sheet) => sheet.id !== tempSheetId);
                setActiveSheetId((activeId) => {
                    if (activeId !== tempSheetId) return activeId;
                    const fallback = remaining[0];
                    if (fallback) void loadTracker(fallback.id);
                    return fallback?.id ?? null;
                });
                if (remaining.length === 0) {
                    setColumns([]);
                    setRows([]);
                }
                return remaining;
            });
            const message = addError instanceof Error ? addError.message : 'Failed to add sheet';
            setError(message);
        }).finally(() => {
            sheetCreatePromises.current.delete(tempSheetId);
        });
    }

    return (
        <>
            <AdminShell wide>
                <div className="pb-14">
                <AdminPageHeader
                    title="Marketing Tracker"
                    description="Spreadsheet-style outreach tracker for Zemen Service marketing leads."
                    breadcrumbs={[
                        { label: 'Admin', href: '/admin/dashboard' },
                        { label: 'Marketing Tracker' },
                    ]}
                />

                <SheetMetricsSection
                    sheetName={activeSheetName}
                    loading={metricsLoading}
                    analytics={analytics}
                    assigneePanelOpen={assigneePanelOpen}
                    onAssigneePanelOpen={() => setAssigneePanelOpen(true)}
                    onAssigneePanelClose={() => setAssigneePanelOpen(false)}
                />

                <div className="mb-4 max-w-md">
                    <AdminSearchInput
                        value={query}
                        onChange={setQuery}
                        placeholder="Search across all cells..."
                    />
                </div>

                {error ? <AdminErrorAlert message={error} /> : null}

                <div className="relative flex max-h-[calc(100vh-18rem)] min-h-90 flex-col overflow-hidden rounded-lg border border-border bg-card">
                    {initialLoading ? (
                        <div className="flex flex-1 items-center justify-center p-8">
                            <AdminLoadingRow label="Loading marketing tracker..." />
                        </div>
                    ) : (
                        <div
                            className={cn(
                                'relative min-h-0 flex-1 overflow-x-auto overflow-y-auto',
                                sheetLoading && 'pointer-events-none opacity-60'
                            )}
                        >
                            <table className="min-w-full table-fixed border-collapse text-sm">
                                <colgroup>
                                    <col style={{ width: ROW_GUTTER_PX }} />
                                    {columns.map((column) => {
                                        const widthPx = columnWidths.get(column.id) ?? resolveColumnWidthPx(column);
                                        return <col key={column.id} style={{ width: widthPx }} />;
                                    })}
                                    <col style={{ width: 32 }} />
                                </colgroup>
                                <thead className="sticky top-0 z-20 bg-muted">
                                    <tr>
                                        <th
                                            className="sticky left-0 z-50 overflow-hidden border-b border-r border-border/60 bg-muted"
                                            style={{
                                                width: ROW_GUTTER_PX,
                                                minWidth: ROW_GUTTER_PX,
                                                maxWidth: ROW_GUTTER_PX,
                                            }}
                                        />
                                        {columns.map((column) => (
                                            <ColumnHeader
                                                key={column.id}
                                                column={column}
                                                widthPx={columnWidths.get(column.id) ?? resolveColumnWidthPx(column)}
                                                isSticky={column.key === stickyColumnKey}
                                                onResize={handleColumnResize}
                                                onDelete={
                                                    canWriteCatalog
                                                        ? (columnId) => requestDeleteColumn(columnId)
                                                        : undefined
                                                }
                                            />
                                        ))}
                                        <th className="border-b border-border/60 bg-muted px-1 py-2">
                                            {canWriteCatalog ? (
                                            <button
                                                type="button"
                                                aria-label="Add column"
                                                onClick={() => setAddColumnOpen(true)}
                                                className={gridIconButtonClassName}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </button>
                                            ) : null}
                                        </th>
                                        <th className="border-b border-border/60 bg-muted" aria-hidden />
                                    </tr>
                                </thead>
                                <tbody>
                                    {columns.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-12 text-center text-sm text-muted-foreground">
                                                Empty sheet — use + to add a column
                                            </td>
                                        </tr>
                                    ) : (
                                        displayRows.map((row) => {
                                            const isPhantom = isPhantomRowId(row.id);
                                            const dataRowIndex = filteredRows.findIndex(
                                                (candidate) => candidate.id === row.id
                                            );
                                            const rowNumber =
                                                isPhantom || dataRowIndex < 0
                                                    ? ''
                                                    : String(dataRowIndex + 1);

                                            return (
                                                <tr key={row.id} data-row-id={row.id} className="group">
                                                    <td
                                                        className="sticky left-0 z-20 overflow-hidden border-b border-r border-border/60 bg-muted px-1 py-1 text-center text-xs tabular-nums text-muted-foreground group-hover:bg-muted"
                                                        style={{
                                                            width: ROW_GUTTER_PX,
                                                            minWidth: ROW_GUTTER_PX,
                                                            maxWidth: ROW_GUTTER_PX,
                                                        }}
                                                    >
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span className="leading-none">{rowNumber}</span>
                                                            {!isPhantom && canWriteCatalog ? (
                                                                <button
                                                                    type="button"
                                                                    aria-label="Insert row below"
                                                                    onClick={() => insertRowAfter(row.id)}
                                                                    className={cn(
                                                                        gridIconButtonClassName,
                                                                        'h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100'
                                                                    )}
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                    {columns.map((column, columnIndex) => {
                                                        const isBusinessNameColumn =
                                                            column.key === stickyColumnKey;
                                                        const widthPx =
                                                            columnWidths.get(column.id) ??
                                                            resolveColumnWidthPx(column);
                                                        return (
                                                            <td
                                                                key={`${row.id}-${column.id}`}
                                                                style={{
                                                                    width: widthPx,
                                                                    minWidth: widthPx,
                                                                    maxWidth: widthPx,
                                                                    ...(isBusinessNameColumn
                                                                        ? { left: ROW_GUTTER_PX }
                                                                        : {}),
                                                                }}
                                                                className={cn(
                                                                    'overflow-hidden border-b border-r border-border/60 align-top',
                                                                    isBusinessNameColumn &&
                                                                        'sticky z-10 bg-muted group-hover:bg-muted',
                                                                    !isBusinessNameColumn &&
                                                                        'group-hover:bg-muted/30'
                                                                )}
                                                            >
                                                                <div
                                                                    className="min-w-0 overflow-hidden"
                                                                    data-cell-key={column.key}
                                                                    data-first-cell={
                                                                        columnIndex === 0 ? 'true' : undefined
                                                                    }
                                                                >
                                                                    <TrackerCellEditor
                                                                        column={column}
                                                                        value={row.values[column.key] ?? null}
                                                                        onChange={(value) =>
                                                                            scheduleSave(row.id, column.key, value)
                                                                        }
                                                                        filled={isBusinessNameColumn}
                                                                        readOnly={!canWriteCatalog}
                                                                    />
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="border-b border-border/60 px-1 py-1 text-center">
                                                        {!isPhantom && canWriteCatalog ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => requestDeleteRow(row.id)}
                                                                aria-label="Delete row"
                                                                className={cn(
                                                                    gridIconButtonClassName,
                                                                    'opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive'
                                                                )}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        ) : null}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <Dialog open={addColumnOpen} onClose={() => setAddColumnOpen(false)}>
                    <DialogHeader className="mb-4 px-4 pt-4">
                        <DialogTitle>Add column</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="space-y-4 px-4">
                        <div className="space-y-2">
                            <Label htmlFor="column-label">Column name</Label>
                            <Input
                                id="column-label"
                                value={newColumnLabel}
                                onChange={(event) => setNewColumnLabel(event.target.value)}
                                placeholder="e.g. Status"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="column-type">Type</Label>
                            <select
                                id="column-type"
                                value={newColumnType}
                                onChange={(event) =>
                                    setNewColumnType(event.target.value as 'text' | 'yes-no' | 'date')
                                }
                                className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                            >
                                <option value="text">Text</option>
                                <option value="yes-no">Yes / No</option>
                                <option value="date">Date</option>
                            </select>
                        </div>
                    </DialogBody>
                    <DialogFooter className="px-4 pb-4">
                        <Button type="button" variant="outline" onClick={() => setAddColumnOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={() => handleAddColumn()}>
                            Add column
                        </Button>
                    </DialogFooter>
                </Dialog>

                <Dialog open={addSheetOpen} onClose={() => setAddSheetOpen(false)}>
                    <DialogHeader className="mb-4 px-4 pt-4">
                        <DialogTitle>Add sheet</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="space-y-4 px-4">
                        <div className="space-y-2">
                            <Label htmlFor="sheet-name">Sheet name</Label>
                            <Input
                                id="sheet-name"
                                value={newSheetName}
                                onChange={(event) => setNewSheetName(event.target.value)}
                                placeholder={`Sheet ${sheets.length + 1}`}
                            />
                        </div>
                    </DialogBody>
                    <DialogFooter className="px-4 pb-4">
                        <Button type="button" variant="outline" onClick={() => setAddSheetOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={() => handleAddSheet()}>
                            Add sheet
                        </Button>
                    </DialogFooter>
                </Dialog>

                <Dialog open={deleteConfirm !== null} onClose={() => !deleteConfirmLoading && setDeleteConfirm(null)}>
                    <DialogHeader className="mb-2">
                        <DialogTitle>{deleteConfirm?.title}</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>{deleteConfirm?.description}</DialogDescription>
                    <DialogFooter className="mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeleteConfirm(null)}
                            disabled={deleteConfirmLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={() => void confirmDelete()}
                            disabled={deleteConfirmLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteConfirmLoading ? 'Deleting…' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </Dialog>
                </div>

                <div className="fixed bottom-0 left-64 right-0 z-40 flex items-end gap-0 border-t border-border bg-muted px-2 pb-0 pt-1">
                    <div className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto">
                        {sheets.map((sheet) => {
                            const isActive = sheet.id === activeSheetId;
                            const isEditing = editingSheetId === sheet.id;
                            return (
                                <div
                                    key={sheet.id}
                                    className={cn(
                                        'group relative flex max-w-55 shrink-0 items-center rounded-t-md border pr-8',
                                        isActive
                                            ? '-mb-px border-border border-b-card bg-card text-primary'
                                            : 'border-transparent text-muted-foreground hover:bg-muted'
                                    )}
                                >
                                    {isEditing ? (
                                        <input
                                            autoFocus
                                            value={editingSheetName}
                                            onChange={(event) => setEditingSheetName(event.target.value)}
                                            onBlur={() => void commitSheetRename(sheet.id)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    void commitSheetRename(sheet.id);
                                                }
                                                if (event.key === 'Escape') {
                                                    event.preventDefault();
                                                    cancelSheetRename();
                                                }
                                            }}
                                            onClick={(event) => event.stopPropagation()}
                                            className="h-7 min-w-0 flex-1 rounded-t-md border-0 bg-transparent px-3 text-xs font-medium text-primary outline-none ring-2 ring-ring/40"
                                        />
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => handleSelectSheet(sheet.id)}
                                            onDoubleClick={(event) => {
                                                event.preventDefault();
                                                startSheetRename(sheet.id, sheet.name);
                                            }}
                                            className="min-w-0 flex-1 truncate px-4 py-1.5 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            title="Double-click to rename"
                                        >
                                            {sheet.name}
                                        </button>
                                    )}
                                    {canWriteCatalog && sheets.length > 1 ? (
                                        <button
                                            type="button"
                                            aria-label={`Delete ${sheet.name}`}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                void requestDeleteSheet(sheet.id);
                                            }}
                                            className={cn(
                                                gridIconButtonClassName,
                                                'absolute right-1 top-1/2 z-10 h-6 w-6 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:bg-destructive/10 hover:text-destructive'
                                            )}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    ) : null}
                                </div>
                            );
                        })}
                        {canWriteCatalog ? (
                        <button
                            type="button"
                            onClick={() => setAddSheetOpen(true)}
                            className="mb-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label="Add sheet"
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </button>
                        ) : null}
                    </div>
                </div>
            </AdminShell>
        </>
    );
}
