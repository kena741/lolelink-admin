'use client';

interface WalletTransactionPaginationProps {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250] as const;

export function WalletTransactionPagination({
    page,
    pageSize,
    totalItems,
    totalPages,
    onPageChange,
    onPageSizeChange,
}: WalletTransactionPaginationProps) {
    if (totalItems === 0) return null;

    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalItems);

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
            <p className="text-sm text-gray-500">
                Rows <span className="font-semibold text-gray-900">{start}</span>–
                <span className="font-semibold text-gray-900">{end}</span> of{' '}
                <span className="font-semibold text-gray-900">{totalItems}</span>
            </p>

            <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                    Per page
                    <select
                        value={pageSize}
                        onChange={(event) => onPageSizeChange(Number(event.target.value))}
                        className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                </label>

                <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                    className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Previous
                </button>
                <span className="text-sm text-gray-600">
                    Page <span className="font-semibold text-gray-900">{page}</span> of{' '}
                    <span className="font-semibold text-gray-900">{totalPages}</span>
                </span>
                <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                    className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Next
                </button>
            </div>
        </div>
    );
}
