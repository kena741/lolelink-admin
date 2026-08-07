'use client';

import { useCallback } from 'react';
import { useAdminSession } from '@/lib/admin-session';

interface UseAdminPermissionsResult {
    loading: boolean;
    adminId: string | null;
    permissions: string[];
    can: (permission: string) => boolean;
    canWriteBookings: boolean;
    canWriteCustomers: boolean;
    canWriteProviders: boolean;
    canVerifyProviders: boolean;
    canWriteServices: boolean;
    canWriteCatalog: boolean;
    canWriteFinance: boolean;
    canWriteContact: boolean;
    canWriteDocuments: boolean;
    canWriteSettings: boolean;
    canWriteAdmins: boolean;
    canWriteRoles: boolean;
    canWriteNotifications: boolean;
}

export function useAdminPermissions(): UseAdminPermissionsResult {
    const { status, adminId, permissions, can: sessionCan } = useAdminSession();
    const can = useCallback((permission: string) => sessionCan(permission), [sessionCan]);

    return {
        loading: status === 'loading',
        adminId,
        permissions,
        can,
        canWriteBookings: can('bookings:write'),
        canWriteCustomers: can('customers:write'),
        canWriteProviders: can('providers:write'),
        canVerifyProviders: can('providers:verify'),
        canWriteServices: can('services:write'),
        canWriteCatalog: can('catalog:write'),
        canWriteFinance: can('finance:write'),
        canWriteContact: can('contact:write'),
        canWriteDocuments: can('documents:write'),
        canWriteSettings: can('settings:write'),
        canWriteAdmins: can('admins:write'),
        canWriteRoles: can('roles:write'),
        canWriteNotifications: can('notifications:write'),
    };
}

export function canAccessAdminRoute(pathname: string, can: (permission: string) => boolean): boolean {
    if (pathname === '/admin/dashboard' || pathname === '/admin') return true;
    if (pathname.startsWith('/admin/providers')) return can('providers:read');
    if (pathname.startsWith('/admin/verify-documents')) return can('providers:verify');
    if (pathname.startsWith('/admin/services')) return can('services:read');
    if (pathname.startsWith('/admin/categories') || pathname.startsWith('/admin/subcategories')) {
        return can('catalog:read');
    }
    if (pathname.startsWith('/admin/documents')) return can('documents:read');
    if (pathname.startsWith('/admin/banners') || pathname.startsWith('/admin/coupon')) {
        return can('catalog:read');
    }
    if (pathname.startsWith('/admin/bookings')) return can('bookings:read');
    if (pathname.startsWith('/admin/handyman')) return can('providers:read');
    if (pathname.startsWith('/admin/customers/job-requests')) return can('customers:read');
    if (pathname.startsWith('/admin/customers')) return can('customers:read');
    if (pathname.startsWith('/admin/finance')) return can('finance:read');
    if (pathname.startsWith('/admin/notifications')) return can('notifications:read');
    if (pathname.startsWith('/admin/settings')) return can('settings:read');
    if (pathname.startsWith('/admin/mobile-app-config')) {
        return can('settings:read') || can('contact:read');
    }
    if (pathname.startsWith('/admin/admins')) return can('admins:read');
    if (pathname.startsWith('/admin/roles')) return can('roles:read');
    if (pathname.startsWith('/admin/activity-logs')) return can('logs:read');
    if (pathname.startsWith('/admin/contact-messages')) return can('contact:read');
    if (pathname.startsWith('/admin/push')) return can('notifications:write');
    if (pathname.startsWith('/admin/marketing-tracker')) return can('catalog:read');
    if (pathname.startsWith('/admin/product-scorecard')) return true;
    return false;
}
