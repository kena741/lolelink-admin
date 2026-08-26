export interface PermissionDefinition {
    key: string;
    label: string;
    group: string;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
    { key: 'providers:read', label: 'View providers', group: 'Providers' },
    { key: 'providers:write', label: 'Manage providers', group: 'Providers' },
    { key: 'providers:verify', label: 'Verify provider documents', group: 'Providers' },
    { key: 'services:read', label: 'View services', group: 'Services' },
    { key: 'services:write', label: 'Manage services', group: 'Services' },
    { key: 'catalog:read', label: 'View catalog', group: 'Catalog' },
    { key: 'catalog:write', label: 'Manage catalog', group: 'Catalog' },
    { key: 'bookings:read', label: 'View bookings', group: 'Bookings' },
    { key: 'bookings:write', label: 'Manage bookings', group: 'Bookings' },
    { key: 'customers:read', label: 'View customers', group: 'Customers' },
    { key: 'customers:write', label: 'Manage customers', group: 'Customers' },
    { key: 'notifications:read', label: 'View notifications', group: 'Notifications' },
    { key: 'notifications:write', label: 'Manage notifications', group: 'Notifications' },
    { key: 'finance:read', label: 'View finance', group: 'Finance' },
    { key: 'finance:write', label: 'Manage finance', group: 'Finance' },
    { key: 'contact:read', label: 'View contact messages', group: 'Contact' },
    { key: 'contact:write', label: 'Manage contact messages', group: 'Contact' },
    { key: 'documents:read', label: 'View documents', group: 'Documents' },
    { key: 'documents:write', label: 'Manage documents', group: 'Documents' },
    { key: 'settings:read', label: 'View settings', group: 'Settings' },
    { key: 'settings:write', label: 'Manage settings', group: 'Settings' },
    { key: 'admins:read', label: 'View admins', group: 'Administration' },
    { key: 'admins:write', label: 'Manage admins', group: 'Administration' },
    { key: 'roles:read', label: 'View roles', group: 'Administration' },
    { key: 'roles:write', label: 'Manage roles', group: 'Administration' },
    { key: 'logs:read', label: 'View activity logs', group: 'Administration' },
];

export const DEFAULT_ADMIN_ROLES = [
    {
        slug: 'super_admin',
        name: 'Super Admin',
        description: 'Full access to all resources',
        permissions: ['*'],
        is_system: true,
    },
    {
        slug: 'operations_admin',
        name: 'Operations Admin',
        description: 'Manage providers, services, catalog, bookings, customers, and notifications',
        permissions: [
            'providers:read', 'providers:write', 'providers:verify',
            'services:read', 'services:write',
            'catalog:read', 'catalog:write',
            'bookings:read', 'bookings:write',
            'customers:read', 'customers:write',
            'notifications:read', 'notifications:write',
        ],
        is_system: true,
    },
    {
        slug: 'finance_admin',
        name: 'Finance Admin',
        description: 'Full finance access',
        permissions: ['finance:read', 'finance:write'],
        is_system: true,
    },
    {
        slug: 'support_admin',
        name: 'Support Admin',
        description: 'Customer support with access to customers, bookings, providers, services, catalog/marketing, notifications, contact, settings, and finance view (no document catalog)',
        permissions: [
            'customers:read', 'customers:write',
            'bookings:read', 'bookings:write',
            'contact:read', 'contact:write',
            'providers:read', 'providers:write', 'providers:verify',
            'services:read', 'services:write',
            'catalog:read', 'catalog:write',
            'notifications:read', 'notifications:write',
            'settings:read', 'settings:write',
            'finance:read',
        ],
        is_system: true,
    },
    {
        slug: 'viewer',
        name: 'Viewer',
        description: 'Read-only access across modules',
        permissions: [
            'providers:read', 'services:read', 'catalog:read',
            'bookings:read', 'customers:read', 'notifications:read',
            'finance:read', 'contact:read', 'documents:read', 'settings:read',
        ],
        is_system: true,
    },
] as const;

export function permissionMatches(granted: string, required: string): boolean {
    if (granted === '*') return true;
    if (granted.endsWith(':*')) {
        const prefix = granted.slice(0, -2);
        return required === prefix || required.startsWith(`${prefix}:`);
    }
    return granted === required;
}

export function hasPermission(permissions: string[], required: string): boolean {
    return permissions.some((granted) => permissionMatches(granted, required));
}

/** Hard denials for system roles — applied on save and when resolving grants. */
export const ROLE_PERMISSION_DENYLIST: Record<string, readonly string[]> = {
    viewer: ['services:write'],
    support_admin: ['documents:read', 'documents:write'],
};

export function normalizePermissions(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
    }
    if (typeof value === 'string' && value.trim()) {
        try {
            return normalizePermissions(JSON.parse(value) as unknown);
        } catch {
            return [];
        }
    }
    return [];
}

export function applyRolePermissionPolicy(roleSlug: string, permissions: string[]): string[] {
    const denied = new Set(ROLE_PERMISSION_DENYLIST[roleSlug] ?? []);
    if (denied.size === 0) return [...permissions];
    return permissions.filter((permission) => {
        if (denied.has(permission)) return false;
        if (permission === '*') return roleSlug !== 'viewer' && roleSlug !== 'support_admin';
        return true;
    });
}

export function groupPermissionsByCategory(permissions: PermissionDefinition[]): Record<string, PermissionDefinition[]> {
    return permissions.reduce<Record<string, PermissionDefinition[]>>((acc, permission) => {
        if (!acc[permission.group]) acc[permission.group] = [];
        acc[permission.group].push(permission);
        return acc;
    }, {});
}
