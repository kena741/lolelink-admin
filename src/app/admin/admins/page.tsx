'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    Calendar,
    ChevronLeft,
    ChevronRight,
    ChevronsUpDown,
    Edit,
    Loader2,
    Mail,
    MoreVertical,
    Plus,
    RefreshCw,
    Search,
    Shield,
    Trash2,
    UserCog,
    Users,
    X,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createAdmin, deleteAdmin, fetchAdmins, updateAdmin } from '@/features/admin/adminSlice';
import { fetchAdminRoles } from '@/features/admin/adminRoleSlice';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { AdminUser } from '../../../../type/admin';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';

const PAGE_SIZE = 20;

interface AdminFormState {
    email: string;
    password: string;
    full_name: string;
    role: string;
    is_active: boolean;
}

const emptyForm: AdminFormState = {
    email: '',
    password: '',
    full_name: '',
    role: 'viewer',
    is_active: true,
};

type SortKey = 'name' | 'email' | 'role' | 'created_at';
type SortDir = 'asc' | 'desc';

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'AD';
}

function AdminsPage() {
    const dispatch = useAppDispatch();
    const { canWriteAdmins } = useAdminPermissions();
    const { admins, loading, error } = useAppSelector((state) => state.admin);
    const { roles } = useAppSelector((state) => state.adminRole);
    const [query, setQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortKey>('created_at');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
    const [form, setForm] = useState<AdminFormState>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        dispatch(fetchAdmins());
        dispatch(fetchAdminRoles());
    }, [dispatch]);

    const roleOptions = roles.length > 0
        ? roles
        : [{ id: 'viewer', slug: 'viewer', name: 'Viewer', description: null, permissions: [], is_system: true, created_at: '', updated_at: '' }];

    const stats = useMemo(() => ({
        total: admins.length,
        active: admins.filter((admin) => admin.is_active).length,
        inactive: admins.filter((admin) => !admin.is_active).length,
    }), [admins]);

    const sortedAdmins = useMemo(() => {
        const arr = [...admins];
        arr.sort((a, b) => {
            let aVal: string | number = '';
            let bVal: string | number = '';
            switch (sortBy) {
                case 'name':
                    aVal = (a.full_name || '').toLowerCase();
                    bVal = (b.full_name || '').toLowerCase();
                    break;
                case 'email':
                    aVal = (a.email || '').toLowerCase();
                    bVal = (b.email || '').toLowerCase();
                    break;
                case 'role':
                    aVal = a.role.toLowerCase();
                    bVal = b.role.toLowerCase();
                    break;
                case 'created_at':
                default:
                    aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
                    bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
                    break;
            }
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
            }
            const aStr = aVal.toString();
            const bStr = bVal.toString();
            return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
        });
        return arr;
    }, [admins, sortBy, sortDir]);

    const filtered = useMemo(() => {
        if (!query.trim()) return sortedAdmins;
        const q = query.toLowerCase();
        return sortedAdmins.filter((admin) => {
            const roleName = roleOptions.find((role) => role.slug === admin.role)?.name || admin.role;
            return (
                (admin.full_name || '').toLowerCase().includes(q)
                || (admin.email || '').toLowerCase().includes(q)
                || admin.role.toLowerCase().includes(q)
                || roleName.toLowerCase().includes(q)
            );
        });
    }, [sortedAdmins, query, roleOptions]);

    const totalPages = filtered.length > 0 ? Math.ceil(filtered.length / PAGE_SIZE) : 1;
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = (safePage - 1) * PAGE_SIZE;
    const paginated = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    useEffect(() => {
        setCurrentPage(1);
    }, [query]);

    function toggleSort(key: SortKey) {
        setSortBy((prev) => (prev === key ? prev : key));
        setSortDir((prev) => (sortBy === key ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
    }

    function openCreateModal() {
        setEditingAdmin(null);
        setForm({
            ...emptyForm,
            role: roleOptions[0]?.slug || 'viewer',
        });
        setIsModalOpen(true);
    }

    function openEditModal(admin: AdminUser) {
        setEditingAdmin(admin);
        setForm({
            email: admin.email || '',
            password: '',
            full_name: admin.full_name || '',
            role: admin.role,
            is_active: admin.is_active,
        });
        setIsModalOpen(true);
    }

    function closeModal() {
        setIsModalOpen(false);
        setEditingAdmin(null);
        setForm(emptyForm);
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (!form.full_name.trim() || !form.role) return;
        setSaving(true);
        try {
            if (editingAdmin) {
                await dispatch(updateAdmin({
                    id: editingAdmin.id,
                    updates: {
                        full_name: form.full_name.trim(),
                        role: form.role,
                        is_active: form.is_active,
                        ...(form.password.trim() ? { password: form.password.trim() } : {}),
                    },
                })).unwrap();
            } else {
                if (!form.email.trim() || !form.password.trim()) return;
                await dispatch(createAdmin({
                    email: form.email.trim(),
                    password: form.password.trim(),
                    full_name: form.full_name.trim(),
                    role: form.role,
                    is_active: form.is_active,
                })).unwrap();
            }
            await dispatch(fetchAdmins());
            closeModal();
        } catch (submitError) {
            const message = submitError instanceof Error ? submitError.message : 'Failed to save admin';
            alert(message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this admin account? This also removes the auth user.')) return;
        setDeletingId(id);
        try {
            await dispatch(deleteAdmin(id)).unwrap();
        } catch (deleteError) {
            const message = deleteError instanceof Error ? deleteError.message : 'Failed to delete admin';
            alert(message);
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <AuthGuard>
            <div className="flex min-h-screen">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        <AdminPageHeader
                            title="Admin Management"
                            description="Create admin accounts and assign roles"
                            actions={
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            dispatch(fetchAdmins());
                                            dispatch(fetchAdminRoles());
                                        }}
                                        className={adminHeaderButtonClassName()}
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </button>
                                    {canWriteAdmins && (
                                    <button
                                        type="button"
                                        onClick={openCreateModal}
                                        className={adminHeaderButtonClassName()}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Admin
                                    </button>
                                    )}
                                </>
                            }
                        />
                        <section className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
                            <div className="rounded-2xl border border-white/20 bg-white/80 p-6 shadow-xl backdrop-blur-xl">
                                <div className="mb-4 inline-flex rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 p-3 shadow-lg">
                                    <Users className="h-6 w-6 text-white" />
                                </div>
                                <p className="mb-1 text-sm font-medium text-gray-600">Total Admins</p>
                                <p className="text-3xl font-bold text-gray-900">{loading ? '—' : stats.total}</p>
                            </div>
                            <div className="rounded-2xl border border-white/20 bg-white/80 p-6 shadow-xl backdrop-blur-xl">
                                <div className="mb-4 inline-flex rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-3 shadow-lg">
                                    <UserCog className="h-6 w-6 text-white" />
                                </div>
                                <p className="mb-1 text-sm font-medium text-gray-600">Active</p>
                                <p className="text-3xl font-bold text-gray-900">{loading ? '—' : stats.active}</p>
                            </div>
                            <div className="rounded-2xl border border-white/20 bg-white/80 p-6 shadow-xl backdrop-blur-xl">
                                <div className="mb-4 inline-flex rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-3 shadow-lg">
                                    <Shield className="h-6 w-6 text-white" />
                                </div>
                                <p className="mb-1 text-sm font-medium text-gray-600">Inactive</p>
                                <p className="text-3xl font-bold text-gray-900">{loading ? '—' : stats.inactive}</p>
                            </div>
                        </section>

                        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="relative w-full max-w-md flex-1">
                                <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search name, email, or role…"
                                    className={cn(
                                        'w-full rounded-xl border border-white/20 bg-white/80 py-3 pl-12 text-sm text-gray-900 shadow-lg backdrop-blur-xl placeholder:text-gray-500 transition-all',
                                        'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200/50',
                                        query.trim() ? 'pr-12' : 'pr-5'
                                    )}
                                />
                                {query.trim() ? (
                                    <button
                                        type="button"
                                        aria-label="Clear search"
                                        onClick={() => setQuery('')}
                                        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                ) : null}
                            </div>
                            <Link
                                href="/admin/roles"
                                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/80 px-4 py-3 text-sm font-semibold text-gray-700 shadow-lg backdrop-blur-xl transition-colors hover:bg-white"
                            >
                                <Shield className="h-4 w-4" />
                                Manage Roles
                            </Link>
                        </div>

                        {error && (
                            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        {loading && (
                            <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Loading admins...
                            </div>
                        )}

                        <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/80 shadow-xl backdrop-blur-xl">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-b border-white/20 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
                                            <TableHead className="w-[60px] font-semibold text-gray-700">#</TableHead>
                                            <TableHead className="font-semibold text-gray-700">Admin</TableHead>
                                            <TableHead className="font-semibold text-gray-700">
                                                <button
                                                    className="inline-flex items-center gap-1 transition-colors hover:text-indigo-600"
                                                    onClick={() => toggleSort('name')}
                                                >
                                                    Name
                                                    <ChevronsUpDown className="h-4 w-4 opacity-60" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="font-semibold text-gray-700">
                                                <button
                                                    className="inline-flex items-center gap-1 transition-colors hover:text-indigo-600"
                                                    onClick={() => toggleSort('role')}
                                                >
                                                    Role
                                                    <ChevronsUpDown className="h-4 w-4 opacity-60" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="font-semibold text-gray-700">Status</TableHead>
                                            <TableHead className="font-semibold text-gray-700">
                                                <button
                                                    className="inline-flex items-center gap-1 transition-colors hover:text-indigo-600"
                                                    onClick={() => toggleSort('created_at')}
                                                >
                                                    Created
                                                    <ChevronsUpDown className="h-4 w-4 opacity-60" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginated.map((admin, idx) => {
                                            const label = admin.full_name || 'Unknown Admin';
                                            const roleName = roleOptions.find((role) => role.slug === admin.role)?.name || admin.role;
                                            const rowBusy = deletingId === admin.id;

                                            return (
                                                <TableRow
                                                    key={admin.id}
                                                    className="border-b border-white/20 transition-all hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-purple-50/30"
                                                >
                                                    <TableCell className="text-sm font-medium text-gray-500">
                                                        {startIdx + idx + 1}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-md ring-2 ring-white/50">
                                                            {getInitials(label)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-indigo-700">{label}</span>
                                                            <span className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                                                                <Mail className="h-3 w-3" />
                                                                {admin.email || '—'}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="inline-flex items-center rounded-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                                                            {roleName}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                            admin.is_active
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                            {admin.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                                            <Calendar className="h-4 w-4 text-gray-400" />
                                                            {admin.created_at ? new Date(admin.created_at).toLocaleDateString() : '—'}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {canWriteAdmins ? (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-9 w-9 text-gray-600 hover:text-gray-900"
                                                                    aria-label="Admin actions"
                                                                >
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-48">
                                                                <DropdownMenuItem onSelect={() => openEditModal(admin)}>
                                                                    <span className="flex items-center gap-2">
                                                                        <Edit className="h-4 w-4 shrink-0" />
                                                                        Edit admin
                                                                    </span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    disabled={rowBusy}
                                                                    onSelect={() => {
                                                                        void handleDelete(admin.id);
                                                                    }}
                                                                >
                                                                    <span className="flex items-center gap-2 text-red-600">
                                                                        {rowBusy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Trash2 className="h-4 w-4 shrink-0" />}
                                                                        Delete
                                                                    </span>
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                        ) : null}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {paginated.length === 0 && !loading && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="px-4 py-12 text-center text-gray-500">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                                                            <Search className="h-8 w-8 text-gray-400" />
                                                        </div>
                                                        <p className="text-lg font-semibold text-gray-900">No admins found</p>
                                                        <p className="text-sm text-gray-600">Try adjusting your search</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {filtered.length > 0 && (
                            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/20 bg-white/80 px-6 py-3 shadow-lg backdrop-blur-xl">
                                <p className="text-sm text-gray-600">
                                    Showing <span className="font-semibold text-gray-900">{startIdx + 1}</span>–<span className="font-semibold text-gray-900">{Math.min(startIdx + PAGE_SIZE, filtered.length)}</span> of{' '}
                                    <span className="font-semibold text-gray-900">{filtered.length}</span>
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={safePage <= 1}
                                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <span className="min-w-[80px] text-center text-sm font-medium text-gray-700">
                                        Page {safePage} of {totalPages}
                                    </span>
                                    <button
                                        disabled={safePage >= totalPages}
                                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <Dialog open={isModalOpen} onClose={closeModal} className="max-w-xl">
                        <DialogHeader>
                            <DialogTitle>{editingAdmin ? 'Edit Admin' : 'Add Admin'}</DialogTitle>
                            <DialogDescription>
                                {editingAdmin
                                    ? 'Update role, status, or reset password.'
                                    : 'Create a new admin account with email, password, and role.'}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 grid gap-4">
                            {!editingAdmin && (
                                <div className="grid gap-1.5">
                                    <Label htmlFor="admin-email">Email</Label>
                                    <Input
                                        id="admin-email"
                                        type="email"
                                        value={form.email}
                                        onChange={(event) => setForm({ ...form, email: event.target.value })}
                                        required
                                    />
                                </div>
                            )}
                            <div className="grid gap-1.5">
                                <Label htmlFor="admin-full-name">Full Name</Label>
                                <Input
                                    id="admin-full-name"
                                    value={form.full_name}
                                    onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="admin-password">
                                    {editingAdmin ? 'New Password (optional)' : 'Password'}
                                </Label>
                                <Input
                                    id="admin-password"
                                    type="password"
                                    value={form.password}
                                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                                    required={!editingAdmin}
                                    minLength={6}
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="admin-role">Role</Label>
                                <select
                                    id="admin-role"
                                    value={form.role}
                                    onChange={(event) => setForm({ ...form, role: event.target.value })}
                                    className="flex h-10 w-full rounded-md border border-subtle bg-base px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-info"
                                >
                                    {roleOptions.map((role) => (
                                        <option key={role.id} value={role.slug}>
                                            {role.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <label className="flex items-center gap-2 text-sm font-medium text-primary">
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                                    className="rounded border-subtle"
                                />
                                Active account
                            </label>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={closeModal}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={saving}>
                                    {saving ? 'Saving...' : editingAdmin ? 'Save Changes' : 'Create Admin'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Dialog>
                </main>
            </div>
        </AuthGuard>
    );
}

export default AdminsPage;
