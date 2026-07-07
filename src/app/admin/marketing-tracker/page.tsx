'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import AdminPageHeader from '@/components/AdminPageHeader';
import {
    AdminErrorAlert,
    AdminLoadingRow,
    AdminSearchInput,
    AdminShell,
    AdminStatCard,
} from '@/components/admin/admin-layout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
    MarketingTrackerCellValue,
    MarketingTrackerColumn,
    MarketingTrackerRow,
} from '@/lib/marketing-tracker';
import { clampColumnWidthPx, resolveColumnWidthPx } from '@/lib/marketing-tracker';

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

function TrackerCellEditor({ column, value, onChange, filled = false }: TrackerCellEditorProps) {
    if (column.column_type === 'boolean') {
        const checked = value === true;
        return (
            <label className="flex h-9 cursor-pointer items-center gap-2 px-2">
                <input
                    type="checkbox"
                    checked={checked}
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
                onChange={(event) => onChange(event.target.value || null)}
                className="h-9 border-0 bg-transparent px-2 shadow-none focus-visible:ring-1"
            />
        );
    }

    const textCellClassName = filled
        ? 'h-9 w-full border-0 bg-muted px-2 shadow-none outline-none ring-0 focus:border-0 focus:bg-muted focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:ring-0'
        : 'h-9 w-full border-0 bg-transparent px-2 shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:ring-0';

    const textValue = typeof value === 'string' ? value : '';
    if (column.key === 'note') {
        return (
            <textarea
                value={textValue}
                onChange={(event) => onChange(event.target.value)}
                rows={2}
                className={`min-h-[36px] resize-y rounded-none px-2 py-1.5 text-sm ${textCellClassName}`}
            />
        );
    }

    return (
        <Input
            value={textValue}
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
}

function ColumnHeader({ column, widthPx, isSticky, onResize }: ColumnHeaderProps) {
    function handleResizeStart(event: React.MouseEvent<HTMLButtonElement>) {
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
            style={{ width: widthPx, minWidth: widthPx, maxWidth: widthPx }}
            className={`relative border-b border-r border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground ${
                isSticky ? 'sticky left-0 z-30 bg-muted shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]' : 'bg-muted/80'
            }`}
        >
            <span className="block truncate pr-2">{column.label}</span>
            <button
                type="button"
                aria-label={`Resize ${column.label} column`}
                onMouseDown={handleResizeStart}
                className="absolute right-0 top-0 z-40 h-full w-2 cursor-col-resize touch-none border-0 bg-transparent p-0 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
        </th>
    );
}

export default function MarketingTrackerPage() {
    const [columns, setColumns] = useState<MarketingTrackerColumn[]>([]);
    const [rows, setRows] = useState<MarketingTrackerRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [addColumnOpen, setAddColumnOpen] = useState(false);
    const [newColumnLabel, setNewColumnLabel] = useState('');
    const [newColumnType, setNewColumnType] = useState<'text' | 'yes-no' | 'date'>('text');
    const [saving, setSaving] = useState(false);
    const pendingFocusRowId = useRef<string | null>(null);
    const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const widthSaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    const loadTracker = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/marketing-tracker');
            const payload = (await response.json()) as {
                columns?: MarketingTrackerColumn[];
                rows?: MarketingTrackerRow[];
                error?: string;
            };
            if (!response.ok) throw new Error(payload.error || 'Failed to load marketing tracker');
            setColumns(payload.columns ?? []);
            setRows(payload.rows ?? []);
        } catch (loadError: unknown) {
            const message = loadError instanceof Error ? loadError.message : 'Failed to load marketing tracker';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadTracker();
    }, [loadTracker]);

    useEffect(() => {
        if (!pendingFocusRowId.current) return;
        const rowId = pendingFocusRowId.current;
        const cell = document.querySelector<HTMLElement>(
            `[data-row-id="${rowId}"] [data-first-cell="true"] input, [data-row-id="${rowId}"] [data-first-cell="true"] textarea`
        );
        cell?.focus();
        pendingFocusRowId.current = null;
    }, [rows]);

    const filteredRows = useMemo(
        () => rows.filter((row) => rowMatchesQuery(row, columns, query)),
        [rows, columns, query]
    );

    const analytics = useMemo(() => {
        let contacted = 0;
        let onboarded = 0;

        for (const row of rows) {
            if (row.values.contacted === true) contacted += 1;
            if (row.values.onboarded === true) onboarded += 1;
        }

        return {
            total: rows.length,
            contacted,
            onboarded,
            pendingContact: rows.length - contacted,
        };
    }, [rows]);

    const stickyColumnKey =
        columns.find((column) => column.key === 'business_name')?.key ?? columns[0]?.key ?? null;
    const businessNameCellClassName =
        'bg-muted shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]';

    const columnWidths = useMemo(() => {
        const widths = new Map<string, number>();
        for (const column of columns) {
            widths.set(column.id, resolveColumnWidthPx(column));
        }
        return widths;
    }, [columns]);

    const saveColumnWidth = useCallback(async (columnId: string, widthPx: number) => {
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
    }, []);

    const handleColumnResize = useCallback(
        (columnId: string, widthPx: number, persist = false) => {
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
        [saveColumnWidth]
    );

    const patchCell = useCallback(async (rowId: string, columnKey: string, value: MarketingTrackerCellValue) => {
        const response = await fetch(`/api/admin/marketing-tracker/rows/${rowId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: { [columnKey]: value } }),
        });
        const payload = (await response.json()) as { row?: MarketingTrackerRow; error?: string };
        if (!response.ok) throw new Error(payload.error || 'Failed to save cell');
        if (payload.row) {
            setRows((current) => current.map((row) => (row.id === rowId ? payload.row! : row)));
        }
    }, []);

    const scheduleSave = useCallback(
        (rowId: string, columnKey: string, value: MarketingTrackerCellValue) => {
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
        [patchCell]
    );

    async function handleAddRow() {
        setSaving(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/marketing-tracker/rows', { method: 'POST' });
            const payload = (await response.json()) as { row?: MarketingTrackerRow; error?: string };
            if (!response.ok) throw new Error(payload.error || 'Failed to add row');
            if (payload.row) {
                setRows((current) => [...current, payload.row!]);
                pendingFocusRowId.current = payload.row.id;
            }
        } catch (addError: unknown) {
            const message = addError instanceof Error ? addError.message : 'Failed to add row';
            setError(message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteRow(rowId: string) {
        if (!window.confirm('Delete this row?')) return;
        setError(null);
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

    async function handleAddColumn() {
        const label = newColumnLabel.trim();
        if (!label) {
            setError('Column name is required');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/marketing-tracker/columns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label, column_type: newColumnType }),
            });
            const payload = (await response.json()) as { column?: MarketingTrackerColumn; error?: string };
            if (!response.ok) throw new Error(payload.error || 'Failed to add column');
            if (payload.column) {
                setColumns((current) => [...current, payload.column!]);
            }
            setNewColumnLabel('');
            setNewColumnType('text');
            setAddColumnOpen(false);
        } catch (addError: unknown) {
            const message = addError instanceof Error ? addError.message : 'Failed to add column';
            setError(message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <AuthGuard>
            <AdminShell wide>
                <AdminPageHeader
                    title="Marketing Tracker"
                    description="Spreadsheet-style outreach tracker for Zemen Service marketing leads."
                    breadcrumbs={[
                        { label: 'Admin', href: '/admin/dashboard' },
                        { label: 'Marketing Tracker' },
                    ]}
                />

                <section className="mb-6 grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
                    <AdminStatCard
                        title="Total Leads"
                        value={loading ? '…' : String(analytics.total)}
                    />
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
                </section>

                <div className="mb-4 max-w-md">
                    <AdminSearchInput
                        value={query}
                        onChange={setQuery}
                        placeholder="Search across all cells..."
                    />
                </div>

                {error ? <AdminErrorAlert message={error} /> : null}

                {loading ? (
                    <AdminLoadingRow label="Loading marketing tracker..." />
                ) : (
                    <div className="relative">
                        <div className="overflow-x-auto rounded-lg border border-border bg-card">
                            <table className="min-w-full table-fixed border-collapse text-sm">
                                <colgroup>
                                    {columns.map((column) => {
                                        const widthPx = columnWidths.get(column.id) ?? resolveColumnWidthPx(column);
                                        return <col key={column.id} style={{ width: widthPx }} />;
                                    })}
                                    <col style={{ width: 140 }} />
                                    <col style={{ width: 48 }} />
                                </colgroup>
                                <thead className="sticky top-0 z-20 backdrop-blur-sm">
                                    <tr>
                                        {columns.map((column) => (
                                            <ColumnHeader
                                                key={column.id}
                                                column={column}
                                                widthPx={columnWidths.get(column.id) ?? resolveColumnWidthPx(column)}
                                                isSticky={column.key === stickyColumnKey}
                                                onResize={handleColumnResize}
                                            />
                                        ))}
                                        <th className="min-w-[120px] border-b border-border px-3 py-2 text-left">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setAddColumnOpen(true)}
                                            >
                                                <Plus className="mr-1 h-3.5 w-3.5" />
                                                Add column
                                            </Button>
                                        </th>
                                        <th className="w-12 border-b border-border px-2 py-2" aria-label="Row actions" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRows.map((row) => (
                                        <tr key={row.id} data-row-id={row.id} className="group">
                                            {columns.map((column, columnIndex) => {
                                                const isBusinessNameColumn = column.key === stickyColumnKey;
                                                const widthPx = columnWidths.get(column.id) ?? resolveColumnWidthPx(column);
                                                return (
                                                <td
                                                    key={`${row.id}-${column.id}`}
                                                    style={{ width: widthPx, minWidth: widthPx, maxWidth: widthPx }}
                                                    className={`overflow-hidden border-b border-r border-border align-top ${
                                                        isBusinessNameColumn
                                                            ? `sticky left-0 z-10 ${businessNameCellClassName}`
                                                            : 'group-hover:bg-muted/30'
                                                    }`}
                                                >
                                                    <div
                                                        className={isBusinessNameColumn ? 'min-h-9 bg-muted' : undefined}
                                                        data-first-cell={columnIndex === 0 ? 'true' : undefined}
                                                    >
                                                        <TrackerCellEditor
                                                            column={column}
                                                            value={row.values[column.key] ?? null}
                                                            onChange={(value) => scheduleSave(row.id, column.key, value)}
                                                            filled={isBusinessNameColumn}
                                                        />
                                                    </div>
                                                </td>
                                                );
                                            })}
                                            <td className="border-b border-border" />
                                            <td className="border-b border-border px-2 py-1 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => void handleDeleteRow(row.id)}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    aria-label="Delete row"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="sticky bottom-6 mt-4 flex justify-end">
                            <Button type="button" onClick={() => void handleAddRow()} disabled={saving}>
                                <Plus className="mr-1.5 h-4 w-4" />
                                Add row
                            </Button>
                        </div>
                    </div>
                )}

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
                        <Button type="button" onClick={() => void handleAddColumn()} disabled={saving}>
                            Add column
                        </Button>
                    </DialogFooter>
                </Dialog>
            </AdminShell>
        </AuthGuard>
    );
}
