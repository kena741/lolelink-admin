export type MarketingTrackerColumnType = 'text' | 'boolean' | 'date';

export const MIN_COLUMN_WIDTH_PX = 80;
export const MAX_COLUMN_WIDTH_PX = 800;
export const DEFAULT_COLUMN_WIDTH_PX = 160;
export const DEFAULT_NOTE_COLUMN_WIDTH_PX = 280;

export interface MarketingTrackerSheet {
    id: string;
    name: string;
    position: number;
    created_at: string;
}

export interface MarketingTrackerColumn {
    id: string;
    sheet_id: string;
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
    sheet_id: string;
    position: number;
    values: Record<string, string | boolean | null>;
    created_at: string;
    updated_at: string;
}

export type MarketingTrackerCellValue = string | boolean | null;

export const DEFAULT_SHEET_COLUMNS: Array<{
    key: string;
    label: string;
    column_type: MarketingTrackerColumnType;
    position: number;
    is_system: boolean;
}> = [
    { key: 'business_name', label: 'Business Name', column_type: 'text', position: 1, is_system: true },
    { key: 'business_type', label: 'Business Type', column_type: 'text', position: 2, is_system: true },
    { key: 'are_trainers', label: 'Are Trainers?', column_type: 'boolean', position: 3, is_system: true },
    { key: 'address', label: 'Address', column_type: 'text', position: 4, is_system: true },
    { key: 'phone', label: 'Phone', column_type: 'text', position: 5, is_system: true },
    { key: 'assignee', label: 'Assignee', column_type: 'text', position: 6, is_system: true },
    { key: 'contact_date', label: 'Contact Date', column_type: 'date', position: 7, is_system: true },
    { key: 'follow_up_date', label: 'Follow Up Date', column_type: 'date', position: 8, is_system: true },
    { key: 'point_of_contact', label: 'Point of Contact', column_type: 'text', position: 9, is_system: true },
    { key: 'contacted', label: 'Contacted', column_type: 'boolean', position: 10, is_system: true },
    { key: 'onboarded', label: 'Onboarded', column_type: 'boolean', position: 11, is_system: true },
    { key: 'coupon', label: 'Coupon', column_type: 'text', position: 12, is_system: true },
    { key: 'note', label: 'Note', column_type: 'text', position: 13, is_system: true },
];

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

export interface AssigneePerformance {
    assignee: string;
    leads: number;
    contacted: number;
    onboarded: number;
    contactRate: number;
    onboardRate: number;
}

export interface SheetAnalytics {
    total: number;
    contacted: number;
    onboarded: number;
    pendingContact: number;
    trainers: number;
    unassigned: number;
    contactRate: number;
    onboardRate: number;
    assignees: AssigneePerformance[];
}

export function computeSheetAnalytics(rows: MarketingTrackerRow[]): SheetAnalytics {
    let contacted = 0;
    let onboarded = 0;
    let trainers = 0;
    let unassigned = 0;
    const assigneeMap = new Map<string, { leads: number; contacted: number; onboarded: number }>();

    for (const row of rows) {
        const values = row.values;
        if (values.contacted === true) contacted += 1;
        if (values.onboarded === true) onboarded += 1;
        if (values.are_trainers === true) trainers += 1;

        const assigneeValue = values.assignee;
        const assignee =
            typeof assigneeValue === 'string' && assigneeValue.trim()
                ? assigneeValue.trim()
                : 'Unassigned';
        if (assignee === 'Unassigned') unassigned += 1;

        const entry = assigneeMap.get(assignee) ?? { leads: 0, contacted: 0, onboarded: 0 };
        entry.leads += 1;
        if (values.contacted === true) entry.contacted += 1;
        if (values.onboarded === true) entry.onboarded += 1;
        assigneeMap.set(assignee, entry);
    }

    const total = rows.length;
    const assignees = [...assigneeMap.entries()]
        .map(([assignee, stats]) => ({
            assignee,
            leads: stats.leads,
            contacted: stats.contacted,
            onboarded: stats.onboarded,
            contactRate: stats.leads > 0 ? Math.round((stats.contacted / stats.leads) * 100) : 0,
            onboardRate: stats.leads > 0 ? Math.round((stats.onboarded / stats.leads) * 100) : 0,
        }))
        .sort((left, right) => right.leads - left.leads || left.assignee.localeCompare(right.assignee));

    return {
        total,
        contacted,
        onboarded,
        pendingContact: total - contacted,
        trainers,
        unassigned,
        contactRate: total > 0 ? Math.round((contacted / total) * 100) : 0,
        onboardRate: total > 0 ? Math.round((onboarded / total) * 100) : 0,
        assignees,
    };
}

export function createLocalId(): string {
    return `local-${crypto.randomUUID()}`;
}

export function isLocalId(id: string): boolean {
    return id.startsWith('local-');
}

export const PHANTOM_ROW_ID = 'phantom-row';

export function isPhantomRowId(id: string): boolean {
    return id === PHANTOM_ROW_ID;
}
