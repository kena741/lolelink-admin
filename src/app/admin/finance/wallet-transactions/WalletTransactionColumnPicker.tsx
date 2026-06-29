'use client';

import { Columns3 } from 'lucide-react';
import {
    countHiddenWalletColumns,
    WALLET_TRANSACTION_COLUMNS,
    type WalletTransactionColumnId,
    type WalletTransactionColumnVisibility,
} from '@/lib/wallet-transaction-columns';

interface WalletTransactionColumnPickerProps {
    visibility: WalletTransactionColumnVisibility;
    onChange: (visibility: WalletTransactionColumnVisibility) => void;
}

export function WalletTransactionColumnPicker({
    visibility,
    onChange,
}: WalletTransactionColumnPickerProps) {
    const hiddenCount = countHiddenWalletColumns(visibility);

    function toggleColumn(columnId: WalletTransactionColumnId, checked: boolean) {
        onChange({
            ...visibility,
            [columnId]: checked,
        });
    }

    return (
        <details className="relative">
            <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 [&::-webkit-details-marker]:hidden">
                <Columns3 className="h-4 w-4" />
                Columns
                {hiddenCount > 0 ? (
                    <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[11px] font-bold text-gray-700">
                        {hiddenCount} hidden
                    </span>
                ) : null}
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Show columns</p>
                <div className="space-y-2">
                    {WALLET_TRANSACTION_COLUMNS.map((column) => (
                        <label
                            key={column.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                            <input
                                type="checkbox"
                                checked={visibility[column.id]}
                                onChange={(event) => toggleColumn(column.id, event.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-200"
                            />
                            {column.label}
                        </label>
                    ))}
                </div>
            </div>
        </details>
    );
}
