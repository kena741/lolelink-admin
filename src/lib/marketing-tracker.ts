export type MarketingTrackerColumnType = 'text' | 'boolean' | 'date';

export const MIN_COLUMN_WIDTH_PX = 80;
export const MAX_COLUMN_WIDTH_PX = 800;
export const DEFAULT_COLUMN_WIDTH_PX = 160;
export const DEFAULT_NOTE_COLUMN_WIDTH_PX = 280;

export interface MarketingTrackerColumn {
    id: string;
    key: string;
    label: string;
    column_type: MarketingTrackerColumnType;
    position: number;
    is_system: boolean;
    width_px: number | null;
    created_at: string;
}

export interface MarketingTrackerRow {
    id: string;
    position: number;
    values: Record<string, string | boolean | null>;
    created_at: string;
    updated_at: string;
}

export type MarketingTrackerCellValue = string | boolean | null;

export function slugifyColumnLabel(label: string): string {
    const slug = label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return slug || 'column';
}

export function normalizeColumnType(value: string): MarketingTrackerColumnType | null {
    if (value === 'text' || value === 'yes-no' || value === 'boolean') {
        return value === 'yes-no' ? 'boolean' : (value as MarketingTrackerColumnType);
    }
    if (value === 'date') return 'date';
    return null;
}

export function stripColumnKeyFromValues(
    values: Record<string, MarketingTrackerCellValue>,
    key: string
): Record<string, MarketingTrackerCellValue> {
    const next = { ...values };
    delete next[key];
    return next;
}

export function clampColumnWidthPx(width: number): number {
    return Math.min(MAX_COLUMN_WIDTH_PX, Math.max(MIN_COLUMN_WIDTH_PX, Math.round(width)));
}

export function resolveColumnWidthPx(column: Pick<MarketingTrackerColumn, 'key' | 'width_px'>): number {
    if (typeof column.width_px === 'number' && Number.isFinite(column.width_px)) {
        return clampColumnWidthPx(column.width_px);
    }
    if (column.key === 'note') return DEFAULT_NOTE_COLUMN_WIDTH_PX;
    return DEFAULT_COLUMN_WIDTH_PX;
}
