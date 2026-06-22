'use client';

import React from 'react';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';

interface PermissionGateProps {
    permission: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
    const { can, loading } = useAdminPermissions();

    if (loading) return null;
    if (!can(permission)) return fallback;

    return children;
}
