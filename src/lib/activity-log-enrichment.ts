import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminActivityLog } from '../../type/activity-log';

function formatPersonName(...parts: (string | null | undefined)[]): string {
    return parts
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        .join(' ')
        .trim();
}

function readNameFromRow(row: Record<string, unknown>): string {
    const full = formatPersonName(
        row.full_name as string | undefined,
        row.firstName as string | undefined,
        row.lastName as string | undefined,
        row.first_name as string | undefined,
        row.last_name as string | undefined,
        row.name as string | undefined,
        row.serviceName as string | undefined,
        row.userName as string | undefined,
        row.user_name as string | undefined
    );
    return full;
}

async function fetchNameMap(
    admin: SupabaseClient,
    table: string,
    ids: string[],
    select: string
): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (ids.length === 0) return map;

    const { data, error } = await admin.from(table).select(select).in('id', ids);
    if (error || !data) return map;

    for (const row of data as unknown as Record<string, unknown>[]) {
        const id = typeof row.id === 'string' ? row.id : '';
        if (!id) continue;
        const name = readNameFromRow(row);
        if (name) map.set(id, name);
    }

    return map;
}

async function fetchBookingNameMap(
    admin: SupabaseClient,
    ids: string[]
): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (ids.length === 0) return map;

    const { data, error } = await admin
        .from('booked_service')
        .select('id, serviceName, firstName, lastName')
        .in('id', ids);

    if (error || !data) return map;

    for (const row of data as unknown as Record<string, unknown>[]) {
        const id = typeof row.id === 'string' ? row.id : '';
        if (!id) continue;
        const serviceName = (row.serviceName as string | undefined)?.trim() || 'Booking';
        const customerName = formatPersonName(
            row.firstName as string | undefined,
            row.lastName as string | undefined
        );
        map.set(id, customerName ? `${serviceName} (${customerName})` : serviceName);
    }

    return map;
}

async function fetchRoleNameMap(
    admin: SupabaseClient,
    ids: string[]
): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (ids.length === 0) return map;

    const { data, error } = await admin.from('admin_role').select('id, slug, name').in('id', ids);
    if (error || !data) return map;

    for (const row of data as unknown as Record<string, unknown>[]) {
        const id = typeof row.id === 'string' ? row.id : '';
        if (!id) continue;
        const name = (row.name as string | undefined)?.trim() || (row.slug as string | undefined)?.trim();
        if (name) map.set(id, name);
    }

    return map;
}

function groupIdsByResourceType(logs: AdminActivityLog[]): Map<string, Set<string>> {
    const grouped = new Map<string, Set<string>>();

    for (const log of logs) {
        const resourceId = (log.resource_id ?? '').trim();
        if (!resourceId) continue;
        const type = log.resource_type.trim().toLowerCase();
        if (!grouped.has(type)) grouped.set(type, new Set());
        grouped.get(type)?.add(resourceId);
    }

    return grouped;
}

function buildDisplaySummary(summary: string, resourceId: string | null, resourceName: string | null): string {
    if (!resourceId || !resourceName || resourceId === resourceName) return summary;
    if (summary.includes(resourceId)) {
        return summary.split(resourceId).join(resourceName);
    }
    return summary;
}

export async function enrichActivityLogs(
    admin: SupabaseClient,
    logs: AdminActivityLog[]
): Promise<AdminActivityLog[]> {
    if (logs.length === 0) return logs;

    const grouped = groupIdsByResourceType(logs);

    const adminActorIds = [
        ...new Set(
            logs
                .filter((log) => !log.admin_name?.trim() && log.admin_id)
                .map((log) => log.admin_id as string)
        ),
    ];

    const [
        adminActorNames,
        adminResourceNames,
        customerNames,
        providerNames,
        bookingNames,
        roleNames,
        documentNames,
        serviceNames,
    ] = await Promise.all([
        fetchNameMap(admin, 'admin', adminActorIds, 'id, full_name'),
        fetchNameMap(admin, 'admin', [...(grouped.get('admin') ?? [])], 'id, full_name'),
        fetchNameMap(
            admin,
            'customer',
            [...(grouped.get('customer') ?? [])],
            'id, first_name, last_name, user_name'
        ),
        fetchNameMap(
            admin,
            'provider',
            [...(grouped.get('provider') ?? [])],
            'id, firstName, lastName, userName'
        ),
        fetchBookingNameMap(admin, [...(grouped.get('booking') ?? [])]),
        fetchRoleNameMap(admin, [...(grouped.get('role') ?? [])]),
        fetchNameMap(admin, 'documents', [...(grouped.get('document') ?? [])], 'id, name'),
        fetchNameMap(admin, 'service', [...(grouped.get('service') ?? [])], 'id, serviceName'),
    ]);

    function resolveResourceName(type: string, id: string | null): string | null {
        if (!id) return null;
        switch (type) {
            case 'admin':
                return adminResourceNames.get(id) ?? null;
            case 'customer':
                return customerNames.get(id) ?? null;
            case 'provider':
                return providerNames.get(id) ?? null;
            case 'booking':
                return bookingNames.get(id) ?? null;
            case 'role':
                return roleNames.get(id) ?? null;
            case 'document':
                return documentNames.get(id) ?? null;
            case 'service':
                return serviceNames.get(id) ?? null;
            default:
                return null;
        }
    }

    return logs.map((log) => {
        const resourceType = log.resource_type.trim().toLowerCase();
        const resourceName = resolveResourceName(resourceType, log.resource_id);
        const adminName = log.admin_name?.trim() || (log.admin_id ? adminActorNames.get(log.admin_id) : null) || null;

        return {
            ...log,
            admin_name: adminName,
            resource_name: resourceName,
            display_summary: buildDisplaySummary(log.summary, log.resource_id, resourceName),
        };
    });
}
