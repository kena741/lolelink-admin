'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    ChevronsUpDown,
    Edit,
    Loader2,
    MoreVertical,
    Plus,
    RefreshCw,
    Search,
    Shield,
    Trash2,
    X,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createAdminRole, deleteAdminRole, fetchAdminRoles, updateAdminRole } from '@/features/admin/adminRoleSlice';
import { groupPermissionsByCategory, PERMISSION_DEFINITIONS } from '@/lib/admin-permissions';
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
import type { AdminRole } from '../../../../type/admin';

const PAGE_SIZE = 20;

interface RoleFormState {
    slug: string;
    name: string;
    description: string;
    permissions: string[];
}

const emptyForm: RoleFormState = {
    slug: '',
    name: '',
    description: '',
    permissions: [],
};

type SortKey = 'name' | 'slug' | 'permissions';
type SortDir = 'asc' | 'desc';

function RolesPage() {
    const dispatch = useAppDispatch();
    const { roles, loading, error } = useAppSelector((state) => state.adminRole);
    const [query, setQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
    const [form, setForm] = useState<RoleFormState>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const groupedPermissions = useMemo(
        () => groupPermissionsByCategory(PERMISSION_DEFINITIONS),
        []
    );

    useEffect(() => {
        dispatch(fetchAdminRoles());
    }, [dispatch]);

    const stats = useMemo(() => ({
        total: roles.length,
        system: roles.filter((role) => role.is_system).length,
        custom: roles.filter((role) => !role.is_system).length,
    }), [roles]);

    const sortedRoles = useMemo(() => {
        const arr = [...roles];
        arr.sort((a, b) => {
            let aVal: string | number = '';
            let bVal: string | number = '';
            switch (sortBy) {
                case 'slug':
                    aVal = a.slug.toLowerCase();
                    bVal = b.slug.toLowerCase();
                    break;
                case 'permissions':
                    aVal = a.permissions.length;
                    bVal = b.permissions.length;
                    break;
                case 'name':
                default:
                    aVal = a.name.toLowerCase();
                    bVal = b.name.toLowerCase();
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
    }, [roles, sortBy, sortDir]);

    const filtered = useMemo(() => {
        if (!query.trim()) return sortedRoles;
        const q = query.toLowerCase();
        return sortedRoles.filter((role) => {
            return (
                role.name.toLowerCase().includes(q)
                || role.slug.toLowerCase().includes(q)
                || (role.description || '').toLowerCase().includes(q)
                || role.permissions.some((permission) => permission.toLowerCase().includes(q))
            );
        });
    }, [sortedRoles, query]);

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
        setEditingRole(null);
        setForm(emptyForm);
        setIsModalOpen(true);
    }

    function openEditModal(role: AdminRole) {
        setEditingRole(role);
        setForm({
            slug: role.slug,
            name: role.name,
            description: role.description || '',
            permissions: [...role.permissions],
        });
        setIsModalOpen(true);
    }

    function closeModal() {
        setIsModalOpen(false);
        setEditingRole(null);
        setForm(emptyForm);
    }

    function togglePermission(permission: string) {
        setForm((current) => {
            if (permission === '*') {
                return {
                    ...current,
                    permissions: current.permissions.includes('*') ? [] : ['*'],
                };
            }

            const withoutWildcard = current.permissions.filter((item) => item !== '*');
            const hasPermission = withoutWildcard.includes(permission);
            return {
                ...current,
                permissions: hasPermission
                    ? withoutWildcard.filter((item) => item !== permission)
                    : [...withoutWildcard, permission],
            };
        });
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (!form.name.trim() || form.permissions.length === 0) return;
        setSaving(true);
        try {
            if (editingRole) {
                await dispatch(updateAdminRole({
                    id: editingRole.id,
                    name: form.name.trim(),
                    description: form.description.trim(),
                    permissions: form.permissions,
                    ...(editingRole.is_system ? {} : { slug: form.slug.trim() }),
                })).unwrap();
            } else {
                await dispatch(createAdminRole({
                    slug: form.slug.trim(),
                    name: form.name.trim(),
                    description: form.description.trim(),
                    permissions: form.permissions,
                })).unwrap();
            }
            await dispatch(fetchAdminRoles());
            closeModal();
        } catch (submitError) {
            const message = submitError instanceof Error ? submitError.message : 'Failed to save role';
            alert(message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this role?')) return;
        setDeletingId(id);
        try {
            await dispatch(deleteAdminRole(id)).unwrap();
        } catch (deleteError) {
            const message = deleteError instanceof Error ? deleteError.message : 'Failed to delete role';
            alert(message);
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <AuthGuard>
            <div className="flex min-h-screen bg-background">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    <div className="relative isolate overflow-hidden bg-primary transition-colors dark:!bg-sidebar dark:border-b dark:border-sidebar-border">
                        <div className="relative mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-8">
                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <div className="mb-2 flex items-center gap-3">
                                        <div className="rounded-lg bg-card/15 p-2 backdrop-blur-sm">
                                            <Shield className="h-6 w-6 text-primary-foreground" />
                                        </div>
                                        <h1 className="text-3xl font-bold tracking-tight text-primary-foreground drop-shadow-lg sm:text-4xl">
                                            Role Management
                                        </h1>
                                    </div>
                                    <p className="text-base font-medium text-primary-foreground/90">
                                        Define roles and configure access levels
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-3">
                                    <div className="rounded-xl border border-primary-foreground/15 bg-card/15 px-4 py-2 backdrop-blur-md">
                                        <div className="text-sm text-primary-foreground/80">Total Roles</div>
                                        <div className="text-2xl font-bold text-primary-foreground">{stats.total}</div>
                                    </div>
                                    <button
                                        onClick={() => dispatch(fetchAdminRoles())}
                                        className="group inline-flex items-center gap-2 rounded-xl bg-card/15 px-4 py-3 text-sm font-semibold text-primary-foreground ring-2 ring-primary-foreground/20 transition-all hover:bg-card/25"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
                                        Refresh
                                    </button>
                                    <button
                                        onClick={openCreateModal}
                                        className="inline-flex items-center gap-2 rounded-xl bg-card/20 px-4 py-3 text-sm font-semibold text-primary-foreground ring-2 ring-primary-foreground/25 transition-all hover:bg-card/30"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Role
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        <section className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
                            <div className="rounded-2xl border border-white/20 bg-white/80 p-6 shadow-xl backdrop-blur-xl">
                                <div className="mb-4 inline-flex rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-3 shadow-lg">
                                    <Shield className="h-6 w-6 text-white" />
                                </div>
                                <p className="mb-1 text-sm font-medium text-gray-600">Total Roles</p>
                                <p className="text-3xl font-bold text-gray-900">{loading ? '—' : stats.total}</p>
                            </div>
                            <div className="rounded-2xl border border-white/20 bg-white/80 p-6 shadow-xl backdrop-blur-xl">
                                <div className="mb-4 inline-flex rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-3 shadow-lg">
                                    <Shield className="h-6 w-6 text-white" />
                                </div>
                                <p className="mb-1 text-sm font-medium text-gray-600">System Roles</p>
                                <p className="text-3xl font-bold text-gray-900">{loading ? '—' : stats.system}</p>
                            </div>
                            <div className="rounded-2xl border border-white/20 bg-white/80 p-6 shadow-xl backdrop-blur-xl">
                                <div className="mb-4 inline-flex rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 p-3 shadow-lg">
                                    <Shield className="h-6 w-6 text-white" />
                                </div>
                                <p className="mb-1 text-sm font-medium text-gray-600">Custom Roles</p>
                                <p className="text-3xl font-bold text-gray-900">{loading ? '—' : stats.custom}</p>
                            </div>
                        </section>

                        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="relative w-full max-w-md flex-1">
                                <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search role name, slug, or permission…"
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
                                href="/admin/admins"
                                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/80 px-4 py-3 text-sm font-semibold text-gray-700 shadow-lg backdrop-blur-xl transition-colors hover:bg-white"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to Admins
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
                                Loading roles...
                            </div>
                        )}

                        <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/80 shadow-xl backdrop-blur-xl">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-b border-white/20 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
                                            <TableHead className="w-[60px] font-semibold text-gray-700">#</TableHead>
                                            <TableHead className="font-semibold text-gray-700">
                                                <button
                                                    className="inline-flex items-center gap-1 transition-colors hover:text-indigo-600"
                                                    onClick={() => toggleSort('name')}
                                                >
                                                    Role
                                                    <ChevronsUpDown className="h-4 w-4 opacity-60" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="font-semibold text-gray-700">
                                                <button
                                                    className="inline-flex items-center gap-1 transition-colors hover:text-indigo-600"
                                                    onClick={() => toggleSort('slug')}
                                                >
                                                    Slug
                                                    <ChevronsUpDown className="h-4 w-4 opacity-60" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="font-semibold text-gray-700">Description</TableHead>
                                            <TableHead className="font-semibold text-gray-700">
                                                <button
                                                    className="inline-flex items-center gap-1 transition-colors hover:text-indigo-600"
                                                    onClick={() => toggleSort('permissions')}
                                                >
                                                    Permissions
                                                    <ChevronsUpDown className="h-4 w-4 opacity-60" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="font-semibold text-gray-700">Type</TableHead>
                                            <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginated.map((role, idx) => {
                                            const rowBusy = deletingId === role.id;
                                            const visiblePermissions = role.permissions.includes('*')
                                                ? ['Full access']
                                                : role.permissions.slice(0, 4);
                                            const hiddenCount = role.permissions.includes('*')
                                                ? 0
                                                : Math.max(role.permissions.length - 4, 0);

                                            return (
                                                <TableRow
                                                    key={role.id}
                                                    className="border-b border-white/20 transition-all hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-purple-50/30"
                                                >
                                                    <TableCell className="text-sm font-medium text-gray-500">
                                                        {startIdx + idx + 1}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-semibold text-indigo-700">{role.name}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-mono text-xs text-gray-600">{role.slug}</span>
                                                    </TableCell>
                                                    <TableCell className="max-w-xs">
                                                        <span className="line-clamp-2 text-sm text-gray-600">
                                                            {role.description || '—'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {visiblePermissions.map((permission) => (
                                                                <span
                                                                    key={permission}
                                                                    className="inline-flex rounded-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200"
                                                                >
                                                                    {permission}
                                                                </span>
                                                            ))}
                                                            {hiddenCount > 0 && (
                                                                <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                                                                    +{hiddenCount} more
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                            role.is_system
                                                                ? 'bg-blue-100 text-blue-700'
                                                                : 'bg-fuchsia-100 text-fuchsia-700'
                                                        }`}>
                                                            {role.is_system ? 'System' : 'Custom'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-9 w-9 text-gray-600 hover:text-gray-900"
                                                                    aria-label="Role actions"
                                                                >
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-48">
                                                                <DropdownMenuItem onSelect={() => openEditModal(role)}>
                                                                    <span className="flex items-center gap-2">
                                                                        <Edit className="h-4 w-4 shrink-0" />
                                                                        Edit role
                                                                    </span>
                                                                </DropdownMenuItem>
                                                                {!role.is_system && (
                                                                    <>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem
                                                                            disabled={rowBusy}
                                                                            onSelect={() => {
                                                                                void handleDelete(role.id);
                                                                            }}
                                                                        >
                                                                            <span className="flex items-center gap-2 text-red-600">
                                                                                {rowBusy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Trash2 className="h-4 w-4 shrink-0" />}
                                                                                Delete
                                                                            </span>
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
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
                                                        <p className="text-lg font-semibold text-gray-900">No roles found</p>
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

                    <Dialog open={isModalOpen} onClose={closeModal} className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>{editingRole ? 'Edit Role' : 'Add Role'}</DialogTitle>
                            <DialogDescription>
                                Choose permissions for this role. Use full access only when necessary.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 grid gap-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="role-name">Role Name</Label>
                                    <Input
                                        id="role-name"
                                        value={form.name}
                                        onChange={(event) => setForm({ ...form, name: event.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="role-slug">Slug</Label>
                                    <Input
                                        id="role-slug"
                                        value={form.slug}
                                        onChange={(event) => setForm({ ...form, slug: event.target.value })}
                                        disabled={Boolean(editingRole?.is_system)}
                                        required={!editingRole?.is_system}
                                        placeholder="finance_admin"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="role-description">Description</Label>
                                <Input
                                    id="role-description"
                                    value={form.description}
                                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                                />
                            </div>

                            <div className="rounded-md border border-subtle bg-subtle/40 p-4">
                                <label className="flex items-center gap-2 text-sm font-semibold text-primary">
                                    <input
                                        type="checkbox"
                                        checked={form.permissions.includes('*')}
                                        onChange={() => togglePermission('*')}
                                        className="rounded border-subtle"
                                    />
                                    Full access (*)
                                </label>
                            </div>

                            {!form.permissions.includes('*') && (
                                <div className="max-h-[360px] space-y-4 overflow-y-auto rounded-md border border-subtle p-4">
                                    {Object.entries(groupedPermissions).map(([group, permissions]) => (
                                        <div key={group}>
                                            <p className="mb-2 text-sm font-semibold text-primary">{group}</p>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {permissions.map((permission) => (
                                                    <label
                                                        key={permission.key}
                                                        className="flex items-center gap-2 rounded-md border border-subtle bg-base px-3 py-2 text-sm text-primary"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={form.permissions.includes(permission.key)}
                                                            onChange={() => togglePermission(permission.key)}
                                                            className="rounded border-subtle"
                                                        />
                                                        {permission.label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={closeModal}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={saving}>
                                    {saving ? 'Saving...' : editingRole ? 'Save Changes' : 'Create Role'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Dialog>
                </main>
            </div>
        </AuthGuard>
    );
}

export default RolesPage;
