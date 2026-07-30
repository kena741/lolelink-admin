'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

interface AdminListPaginationProps {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
}

export function AdminListPagination({
    page,
    pageSize,
    totalItems,
    totalPages,
    onPageChange,
    onPageSizeChange,
}: AdminListPaginationProps) {
    if (totalItems === 0) return null;

    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalItems);

    return (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-900">{start}</span>–
                <span className="font-semibold text-gray-900">{end}</span> of{' '}
                <span className="font-semibold text-gray-900">{totalItems}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                    Per page
                    <select
                        value={pageSize}
                        onChange={(event) => onPageSizeChange(Number(event.target.value))}
                        className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
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
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-20 text-center text-sm font-medium text-gray-700">
                    Page {page} of {totalPages}
                </span>
                <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
