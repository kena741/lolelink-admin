'use client';

import { useEffect, useState } from 'react';
import { Plus, Receipt, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
    createTax,
    deleteTax,
    fetchTaxes,
    updateTax,
    type CountryTax,
} from '@/features/tax/taxSlice';

interface CountryTaxDraft {
    id?: number;
    country: string;
    name: string;
    value: string;
    type: 'percentage' | 'fixed';
    active: boolean;
}

interface CountryTaxSettingsPanelProps {
    canWrite: boolean;
}

function toDraft(tax: CountryTax): CountryTaxDraft {
    return {
        id: tax.id,
        country: tax.country || 'Ethiopia',
        name: tax.name || '',
        value: tax.value != null ? String(tax.value) : '',
        type: tax.type === 'fixed' || tax.isFix ? 'fixed' : 'percentage',
        active: tax.active ?? false,
    };
}

function createEmptyDraft(): CountryTaxDraft {
    return {
        country: 'Ethiopia',
        name: '',
        value: '',
        type: 'percentage',
        active: true,
    };
}

function formatValueDisplay(row: CountryTaxDraft): string {
    if (!row.value.trim()) return '—';
    const parsed = Number(row.value);
    if (!Number.isFinite(parsed)) return row.value;
    const formatted = parsed.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
    return row.type === 'percentage' ? `${formatted}%` : formatted;
}

export function CountryTaxSettingsPanel({ canWrite }: CountryTaxSettingsPanelProps) {
    const dispatch = useAppDispatch();
    const { taxes, loading, error } = useAppSelector((state) => state.tax);
    const [rows, setRows] = useState<CountryTaxDraft[]>([]);
    const [deletedIds, setDeletedIds] = useState<number[]>([]);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        dispatch(fetchTaxes());
    }, [dispatch]);

    useEffect(() => {
        setRows(taxes.map(toDraft));
        setDeletedIds([]);
    }, [taxes]);

    function updateRow(index: number, field: keyof CountryTaxDraft, value: string | boolean) {
        setRows((prev) =>
            prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
        );
    }

    function addRow() {
        setRows((prev) => [...prev, createEmptyDraft()]);
    }

    function removeRow(index: number) {
        setRows((prev) => {
            const row = prev[index];
            if (row?.id) {
                setDeletedIds((ids) => [...ids, row.id as number]);
            }
            if (prev.length <= 1) return prev;
            return prev.filter((_, rowIndex) => rowIndex !== index);
        });
    }

    async function handleSave() {
        setSaving(true);
        setSaveError(null);

        try {
            for (const id of deletedIds) {
                await dispatch(deleteTax(id)).unwrap();
            }

            for (const row of rows) {
                const name = row.name.trim();
                const value = Number(row.value);
                if (!name || !Number.isFinite(value)) continue;

                const payload = {
                    country: row.country.trim() || 'Ethiopia',
                    name,
                    value,
                    active: row.active,
                    type: row.type,
                };

                if (row.id) {
                    await dispatch(updateTax({ id: row.id, ...payload })).unwrap();
                } else {
                    await dispatch(createTax(payload)).unwrap();
                }
            }

            await dispatch(fetchTaxes()).unwrap();
            setDeletedIds([]);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Failed to save country taxes');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="rounded-2xl border border-white/20 bg-white/80 p-6 shadow-xl backdrop-blur-xl">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Receipt className="h-6 w-6 text-indigo-600" />
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Country tax</h2>
                        <p className="mt-1 text-sm text-gray-600">
                            Rates from{' '}
                            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">country_tax</code>
                            {' '}for Service, VAT, Chapa, and other fees.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => dispatch(fetchTaxes())}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    {canWrite ? (
                        <>
                            <button
                                type="button"
                                onClick={addRow}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                <Plus className="h-4 w-4" />
                                Add row
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleSave()}
                                disabled={saving || loading}
                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Save className="h-4 w-4" />
                                {saving ? 'Saving…' : 'Save taxes'}
                            </button>
                        </>
                    ) : null}
                </div>
            </div>

            {error ? (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            ) : null}
            {saveError ? (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {saveError}
                </div>
            ) : null}

            {loading && rows.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
                    Loading country taxes…
                </div>
            ) : rows.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
                    No country taxes found.
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-left text-gray-700">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Country</th>
                                <th className="px-4 py-3 font-semibold">Name</th>
                                <th className="px-4 py-3 font-semibold">Value</th>
                                <th className="px-4 py-3 font-semibold">Type</th>
                                <th className="px-4 py-3 font-semibold">Active</th>
                                <th className="px-4 py-3 font-semibold">Preview</th>
                                <th className="w-14 px-2 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {rows.map((row, index) => (
                                <tr key={row.id ?? `new-${index}`}>
                                    <td className="px-4 py-2">
                                        <input
                                            type="text"
                                            value={row.country}
                                            disabled={!canWrite}
                                            onChange={(e) => updateRow(index, 'country', e.target.value)}
                                            className="w-full min-w-[120px] rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50 disabled:text-gray-500"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="text"
                                            value={row.name}
                                            disabled={!canWrite}
                                            onChange={(e) => updateRow(index, 'name', e.target.value)}
                                            placeholder="Service"
                                            className="w-full min-w-[120px] rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50 disabled:text-gray-500"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={row.value}
                                            disabled={!canWrite}
                                            onChange={(e) => updateRow(index, 'value', e.target.value)}
                                            placeholder="0"
                                            className="w-full min-w-[96px] rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50 disabled:text-gray-500"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <select
                                            value={row.type}
                                            disabled={!canWrite}
                                            onChange={(e) =>
                                                updateRow(
                                                    index,
                                                    'type',
                                                    e.target.value as 'percentage' | 'fixed'
                                                )
                                            }
                                            className="w-full min-w-[128px] rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50 disabled:text-gray-500"
                                        >
                                            <option value="percentage">Percentage</option>
                                            <option value="fixed">Fixed</option>
                                        </select>
                                    </td>
                                    <td className="px-4 py-2">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={row.active}
                                                disabled={!canWrite}
                                                onChange={(e) => updateRow(index, 'active', e.target.checked)}
                                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">
                                                {row.active ? 'Active' : 'Inactive'}
                                            </span>
                                        </label>
                                    </td>
                                    <td className="px-4 py-2 text-gray-600">{formatValueDisplay(row)}</td>
                                    <td className="px-2 py-2">
                                        {canWrite ? (
                                            <button
                                                type="button"
                                                onClick={() => removeRow(index)}
                                                disabled={rows.length <= 1}
                                                className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent"
                                                aria-label="Remove row"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        ) : null}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
