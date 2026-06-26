'use client';

import type {
    WalletDirectionFilter,
    WalletSortOption,
    WalletTransactionFilterOptions,
    WalletTransactionFilterState,
} from '@/lib/wallet-transaction-filters';
import { walletDatePreset } from '@/lib/wallet-transaction-filters';
import { WalletTransactionFilterSelect } from '@/app/admin/finance/wallet-transactions/WalletTransactionFilterSelect';

interface WalletTransactionFiltersProps {
    filters: WalletTransactionFilterState;
    options: WalletTransactionFilterOptions;
    onChange: (next: WalletTransactionFilterState) => void;
}

const inputClassName =
    'h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';

const DIRECTION_OPTIONS: { value: WalletDirectionFilter; label: string }[] = [
    { value: 'all', label: 'All directions' },
    { value: 'credit', label: 'Credits only' },
    { value: 'debit', label: 'Debits only' },
];

const SORT_OPTIONS: { value: WalletSortOption; label: string }[] = [
    { value: 'date_desc', label: 'Newest first' },
    { value: 'date_asc', label: 'Oldest first' },
    { value: 'amount_desc', label: 'Amount high → low' },
    { value: 'amount_asc', label: 'Amount low → high' },
];

function toggleValue(values: string[], value: string): string[] {
    const normalized = value.toLowerCase();
    const exists = values.some((entry) => entry.toLowerCase() === normalized);
    if (exists) {
        return values.filter((entry) => entry.toLowerCase() !== normalized);
    }
    return [...values, value];
}

export function WalletTransactionFilters({
    filters,
    options,
    onChange,
}: WalletTransactionFiltersProps) {
    function patch(partial: Partial<WalletTransactionFilterState>) {
        onChange({ ...filters, ...partial });
    }

    return (
        <div className="space-y-4 border-t border-gray-100 pt-4 min-w-0">
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                <WalletTransactionFilterSelect
                    label="Direction"
                    value={filters.direction}
                    options={DIRECTION_OPTIONS}
                    onChange={(direction) => patch({ direction })}
                />

                <WalletTransactionFilterSelect
                    label="Sort"
                    value={filters.sort}
                    options={SORT_OPTIONS}
                    onChange={(sort) => patch({ sort })}
                />

                <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Date from</span>
                    <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(event) => patch({ dateFrom: event.target.value })}
                        className={inputClassName}
                    />
                </label>

                <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Date to</span>
                    <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(event) => patch({ dateTo: event.target.value })}
                        className={inputClassName}
                    />
                </label>

                <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Min amount</span>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        value={filters.amountMin}
                        onChange={(event) => patch({ amountMin: event.target.value })}
                        className={inputClassName}
                    />
                </label>

                <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Max amount</span>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Any"
                        value={filters.amountMax}
                        onChange={(event) => patch({ amountMax: event.target.value })}
                        className={inputClassName}
                    />
                </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Quick dates</span>
                {(
                    [
                        ['today', 'Today'],
                        ['7d', '7 days'],
                        ['30d', '30 days'],
                        ['90d', '90 days'],
                    ] as const
                ).map(([preset, label]) => (
                    <button
                        key={preset}
                        type="button"
                        onClick={() => patch(walletDatePreset(preset))}
                        className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-200"
                    >
                        {label}
                    </button>
                ))}
                {filters.dateFrom || filters.dateTo ? (
                    <button
                        type="button"
                        onClick={() => patch({ dateFrom: '', dateTo: '' })}
                        className="text-xs font-medium text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline"
                    >
                        Clear dates
                    </button>
                ) : null}
            </div>

            {options.types.length > 0 ? (
                <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Type</span>
                    <div className="flex flex-wrap gap-2">
                        {options.types.map((type) => {
                            const isActive = filters.types.some(
                                (entry) => entry.toLowerCase() === type.toLowerCase()
                            );
                            return (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => patch({ types: toggleValue(filters.types, type) })}
                                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                                        isActive
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {type.replace(/_/g, ' ')}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}

            {options.paymentTypes.length > 0 ? (
                <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payment</span>
                    <div className="flex flex-wrap gap-2">
                        {options.paymentTypes.map((paymentType) => {
                            const isActive = filters.paymentTypes.some(
                                (entry) => entry.toLowerCase() === paymentType.toLowerCase()
                            );
                            return (
                                <button
                                    key={paymentType}
                                    type="button"
                                    onClick={() =>
                                        patch({ paymentTypes: toggleValue(filters.paymentTypes, paymentType) })
                                    }
                                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                                        isActive
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {paymentType}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}

            <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profile links</span>
                <div className="flex flex-wrap gap-2">
                    {(
                        [
                            ['all', 'All rows'],
                            ['missing_customer', 'Missing customer profile'],
                            ['missing_provider', 'Missing provider profile'],
                            ['missing_any', 'Missing any profile'],
                            ['legacy_user_id', 'Legacy userId (profile id on ledger)'],
                        ] as const
                    ).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => patch({ profileFilter: value })}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                                filters.profileFilter === value
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
