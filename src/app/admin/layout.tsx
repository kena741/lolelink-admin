'use client';

import type { ReactNode } from 'react';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import { AdminSessionProvider } from '@/lib/admin-session';
import { AdminNavProvider } from '@/lib/admin-nav-context';
import { AdminPageLayout, AdminPageMain } from '@/components/admin/admin-layout';

export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <AdminSessionProvider>
            <AuthGuard>
                <AdminNavProvider>
                    <AdminPageLayout>
                        <Sidebar />
                        <AdminPageMain>{children}</AdminPageMain>
                    </AdminPageLayout>
                </AdminNavProvider>
            </AuthGuard>
        </AdminSessionProvider>
    );
}
