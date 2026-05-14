"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import Sidebar from "../../../components/Sidebar";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { fetchProviders, fetchServiceCountsByProvider, archiveProvider, restoreProvider, deleteProvider } from "../../../features/provider/providerSlice";
import type { Provider } from "@/features/provider/providerSlice";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronsUpDown,
    Download,
    RefreshCw, 
    Search, 
    Briefcase, 
    Users, 
    Grid3x3, 
    List, 
    Mail, 
    Phone, 
    MapPin, 
    Calendar,
    ArrowUpRight,
    TrendingUp,
    Zap,
    BadgeCheck,
    Archive,
    ArchiveRestore,
    Trash2,
    Loader2,
    MoreVertical,
    Filter,
    RotateCcw,
    X,
} from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import { ActivationPaymentModal } from "@/components/ActivationPaymentModal";
import { fetchSettings } from "@/features/settings/settingsSlice";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

const PAGE_SIZE = 20;

function providerIsArchived(p: { archived_at?: string | null; archivedAt?: string | null }): boolean {
    const v = p.archived_at ?? p.archivedAt;
    return typeof v === "string" && v.length > 0;
}

function providerActivationPaid(p: Provider): boolean {
    const at = p.activation_paid_at;
    if (typeof at === "string" && at.length > 0) return true;
    const v = p.activation_paid;
    if (v === true) return true;
    if (v === false || v === null || v === undefined) return false;
    if (typeof v === "string") return v === "true" || v === "t" || v === "1";
    if (typeof v === "number") return v === 1;
    return Boolean(v);
}

function providerAccountActive(p: Provider): boolean {
    return p.active !== false;
}

interface SegmentOption<V extends string> {
    value: V;
    label: string;
}

interface SegmentGroupProps<V extends string> {
    label: string;
    value: V;
    options: SegmentOption<V>[];
    onChange: (next: V) => void;
}

function SegmentGroup<V extends string>({ label, value, options, onChange }: SegmentGroupProps<V>) {
    return (
        <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</span>
            <div
                className="flex flex-wrap gap-1.5"
                role="radiogroup"
                aria-label={label}
            >
                {options.map((opt) => {
                    const selected = value === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => onChange(opt.value)}
                            className={cn(
                                "inline-flex h-9 min-h-[36px] shrink-0 items-center justify-center rounded-lg px-3 text-sm font-medium transition-all duration-200",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white/80",
                                selected
                                    ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
                                    : "border border-gray-200/90 bg-white/90 text-gray-700 hover:border-indigo-200 hover:bg-white hover:text-gray-900"
                            )}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

const ProvidersPage = () => {
    const dispatch = useAppDispatch();
    const { providers, loading, error, serviceCounts } = useAppSelector((state) => state.provider);

    type SortKey = "name" | "email" | "services" | "createdAt";
    type SortDir = "asc" | "desc";
    type ViewMode = "grid" | "table";
    const [sortBy, setSortBy] = useState<SortKey>("createdAt");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [query, setQuery] = useState<string>("");
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [currentPage, setCurrentPage] = useState(1);
    const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
    const [activationTarget, setActivationTarget] = useState<{ id: string; name: string } | null>(null);
    type ArchiveVisibility = "active_only" | "all" | "archived_only";
    type ActivationFilter = "all" | "paid" | "unpaid";
    type ServicesFilter = "all" | "with_services" | "no_services";
    type AccountFilter = "all" | "active" | "inactive";
    const [archiveVisibility, setArchiveVisibility] = useState<ArchiveVisibility>("active_only");
    const [activationFilter, setActivationFilter] = useState<ActivationFilter>("all");
    const [servicesFilter, setServicesFilter] = useState<ServicesFilter>("all");
    const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
    const [actionBusyId, setActionBusyId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [pendingDeleteProviderId, setPendingDeleteProviderId] = useState<string | null>(null);
    const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);

    const nonDefaultFilterCount = useMemo(() => {
        let n = 0;
        if (archiveVisibility !== "active_only") n += 1;
        if (activationFilter !== "all") n += 1;
        if (servicesFilter !== "all") n += 1;
        if (accountFilter !== "all") n += 1;
        return n;
    }, [archiveVisibility, activationFilter, servicesFilter, accountFilter]);

    const resetFilters = useCallback(() => {
        setArchiveVisibility("active_only");
        setActivationFilter("all");
        setServicesFilter("all");
        setAccountFilter("all");
    }, []);

    const toggleSort = (key: SortKey) => {
        setSortBy((prev) => (prev === key ? prev : key));
        setSortDir((prev) => (sortBy === key ? (prev === "asc" ? "desc" : "asc") : "asc"));
    };

    const getName = (p: Provider) => {
        const first = p.firstName ?? p.first_name;
        const last = p.lastName ?? p.last_name;
        const full = [first, last].filter(Boolean).join(" ");
        return (full || p.name || "").toString().toLowerCase();
    };

    const attributeFilteredProviders = useMemo(() => {
        return providers.filter((p) => {
            const archived = providerIsArchived(p);
            if (archiveVisibility === "active_only" && archived) return false;
            if (archiveVisibility === "archived_only" && !archived) return false;
            if (activationFilter === "paid" && !providerActivationPaid(p)) return false;
            if (activationFilter === "unpaid" && providerActivationPaid(p)) return false;
            const svc = p.id ? serviceCounts[p.id] ?? 0 : 0;
            if (servicesFilter === "with_services" && svc < 1) return false;
            if (servicesFilter === "no_services" && svc > 0) return false;
            const ac = providerAccountActive(p);
            if (accountFilter === "active" && !ac) return false;
            if (accountFilter === "inactive" && ac) return false;
            return true;
        });
    }, [providers, archiveVisibility, activationFilter, servicesFilter, accountFilter, serviceCounts]);

    const sortedProviders = useMemo(() => {
        const arr = [...attributeFilteredProviders];
        arr.sort((a, b) => {
            let aVal: string | number = 0;
            let bVal: string | number = 0;
            switch (sortBy) {
                case "name":
                    aVal = getName(a);
                    bVal = getName(b);
                    break;
                case "email":
                    aVal = (a.email ?? "").toString().toLowerCase();
                    bVal = (b.email ?? "").toString().toLowerCase();
                    break;
                case "services":
                    aVal = a.id ? serviceCounts[a.id] ?? 0 : 0;
                    bVal = b.id ? serviceCounts[b.id] ?? 0 : 0;
                    break;
                case "createdAt":
                default:
                    aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    break;
            }
            if (typeof aVal === "number" && typeof bVal === "number") {
                return sortDir === "asc" ? aVal - bVal : bVal - aVal;
            }
            const aStr = aVal.toString();
            const bStr = bVal.toString();
            return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
        });
        return arr;
    }, [attributeFilteredProviders, sortBy, sortDir, serviceCounts]);

    const filtered = useMemo(() => {
        if (!query.trim()) return sortedProviders;
        const q = query.toLowerCase();
        return sortedProviders.filter((p) => {
            const name = getName(p);
            const email = (p.email ?? "").toLowerCase();
            const phone = (p.phoneNumber ?? p.phone ?? "").toString().toLowerCase();
            const address = (p.address ?? "").toLowerCase();
            return name.includes(q) || email.includes(q) || phone.includes(q) || address.includes(q);
        });
    }, [sortedProviders, query]);

    function exportToXlsx() {
        const rows = filtered.map((p) => ({
            'Full Name': [p.firstName ?? p.first_name, p.lastName ?? p.last_name].filter(Boolean).join(' ') || p.name || '',
            'Phone': p.phoneNumber ?? p.phone ?? '',
            'Email': p.email ?? '',
            'Activation paid': providerActivationPaid(p) ? 'Yes' : 'No',
            'Services': p.id ? (serviceCounts[p.id] ?? 0) : 0,
            'Archived': providerIsArchived(p) ? 'Yes' : 'No',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Providers');
        XLSX.writeFile(wb, `providers_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    const totalPages = filtered.length > 0 ? Math.ceil(filtered.length / PAGE_SIZE) : 1;
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = (safePage - 1) * PAGE_SIZE;
    const paginated = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    const getInitials = (p: Provider) => {
        const first = (p.firstName ?? p.first_name ?? "").toString();
        const last = (p.lastName ?? p.last_name ?? "").toString();
        const name = (first || last) ? `${first} ${last}`.trim() : (p.name ?? "");
        const parts = name.trim().split(/\s+/).filter(Boolean);
        const initials = parts.slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");
        return initials || "SP";
    };

    useEffect(() => {
        dispatch(fetchProviders());
        dispatch(fetchServiceCountsByProvider());
        dispatch(fetchSettings());
    }, [dispatch]);

    const handleArchiveProvider = useCallback(
        async (providerId: string) => {
            setActionError(null);
            setActionBusyId(providerId);
            const result = await dispatch(archiveProvider(providerId));
            setActionBusyId(null);
            if (archiveProvider.rejected.match(result)) {
                setActionError(result.payload || "Archive failed");
            }
        },
        [dispatch]
    );

    const handleRestoreProvider = useCallback(
        async (providerId: string) => {
            setActionError(null);
            setActionBusyId(providerId);
            const result = await dispatch(restoreProvider(providerId));
            setActionBusyId(null);
            if (restoreProvider.rejected.match(result)) {
                setActionError(result.payload || "Restore failed");
            }
        },
        [dispatch]
    );

    const handleDeleteProvider = useCallback(async () => {
        if (!pendingDeleteProviderId) return;
        setActionError(null);
        setActionBusyId(pendingDeleteProviderId);
        const result = await dispatch(deleteProvider(pendingDeleteProviderId));
        setActionBusyId(null);
        setPendingDeleteProviderId(null);
        if (deleteProvider.rejected.match(result)) {
            setActionError(result.payload || "Delete failed");
        }
    }, [dispatch, pendingDeleteProviderId]);

    useEffect(() => {
        setCurrentPage(1);
    }, [query, archiveVisibility, activationFilter, servicesFilter, accountFilter]);

    // Calculate statistics
    const stats = useMemo(() => {
        const totalServices = Object.values(serviceCounts).reduce((sum, count) => sum + count, 0);
        const avgServicesPerProvider = providers.length > 0 ? totalServices / providers.length : 0;
        const providersWithServices = Object.keys(serviceCounts).length;
        
        const nonArchived = providers.filter((p) => !providerIsArchived(p));
        const activationPaidCount = nonArchived.filter((p) => providerActivationPaid(p)).length;

        return {
            totalProviders: providers.length,
            totalServices,
            avgServicesPerProvider: Math.round(avgServicesPerProvider * 10) / 10,
            providersWithServices,
            providersWithoutServices: providers.length - providersWithServices,
            activationPaidCount,
        };
    }, [providers, serviceCounts]);

    return (
        <AuthGuard>
            <div className="flex min-h-screen bg-background">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    {/* Futuristic Header */}
                    <div className="relative isolate overflow-hidden bg-primary transition-colors dark:!bg-sidebar dark:border-b dark:border-sidebar-border">
                        
                        <div className="relative mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-8">
                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="rounded-lg bg-card/15 p-2 backdrop-blur-sm">
                                            <Briefcase className="h-6 w-6 text-primary-foreground" />
                                        </div>
                                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-primary-foreground drop-shadow-lg">
                                            Service Providers
                                        </h1>
                                    </div>
                                    <p className="text-primary-foreground/90 text-base font-medium">
                                        Manage and review all providers on the platform
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-3">
                                    <div className="rounded-xl border border-primary-foreground/15 bg-card/15 px-4 py-2 backdrop-blur-md">
                                        <div className="text-sm text-primary-foreground/80">Total Providers</div>
                                        <div className="text-2xl font-bold text-primary-foreground">{stats.totalProviders}</div>
                                    </div>
                                    <div className="flex items-center gap-3 rounded-xl border border-primary-foreground/15 bg-card/15 px-4 py-2 backdrop-blur-md">
                                        <div
                                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-md ring-1 ring-black/20"
                                            style={{ backgroundColor: "#134e4a" }}
                                        >
                                            <BadgeCheck className="h-5 w-5 text-white" strokeWidth={2.5} aria-hidden />
                                        </div>
                                        <div>
                                            <div className="text-sm text-primary-foreground/80">Activation paid</div>
                                            <div className="text-2xl font-bold text-primary-foreground">
                                                {loading ? "—" : stats.activationPaidCount}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { dispatch(fetchProviders()); dispatch(fetchServiceCountsByProvider()); }}
                                        className="group inline-flex items-center gap-2 rounded-xl bg-card/15 backdrop-blur-md px-4 py-3 text-sm font-semibold text-primary-foreground ring-2 ring-primary-foreground/20 hover:bg-card/25 hover:ring-primary-foreground/35 transition-all duration-300 hover:scale-105"
                                    >
                                        <RefreshCw className="h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
                                        Refresh
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        {/* Statistics Cards */}
                        <section className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg">
                                            <Users className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-gray-600 mb-1">Total Providers</p>
                                    <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                        {loading ? <span className="inline-block h-8 w-24 animate-pulse rounded bg-gray-200" /> : stats.totalProviders}
                                    </p>
                                </div>
                            </div>

                            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg">
                                            <Briefcase className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-gray-600 mb-1">Total Services</p>
                                    <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                        {loading ? <span className="inline-block h-8 w-24 animate-pulse rounded bg-gray-200" /> : stats.totalServices}
                                    </p>
                                </div>
                            </div>

                            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                                            <TrendingUp className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-gray-600 mb-1">Avg Services/Provider</p>
                                    <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                        {loading ? <span className="inline-block h-8 w-24 animate-pulse rounded bg-gray-200" /> : stats.avgServicesPerProvider}
                                    </p>
                                </div>
                            </div>

                            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
                                <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 to-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-gradient-to-br from-fuchsia-500 to-rose-600 rounded-xl shadow-lg">
                                            <Zap className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-gray-600 mb-1">Active Providers</p>
                                    <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                        {loading ? <span className="inline-block h-8 w-24 animate-pulse rounded bg-gray-200" /> : stats.providersWithServices}
                                    </p>
                                </div>
                            </div>

                            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <div
                                            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-lg ring-1 ring-teal-950/25"
                                            style={{ backgroundColor: "#115e59" }}
                                        >
                                            <BadgeCheck className="h-6 w-6 text-white" strokeWidth={2.5} aria-hidden />
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-gray-600 mb-1">Activation paid</p>
                                    <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                        {loading ? <span className="inline-block h-8 w-24 animate-pulse rounded bg-gray-200" /> : stats.activationPaidCount}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Search and filters */}
                        <div className="mb-6 flex flex-col gap-5">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="relative w-full max-w-md flex-1">
                                    <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                    <input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search name, email, phone, address…"
                                        className={cn(
                                            "w-full rounded-xl border border-white/20 bg-white/80 py-3 pl-12 text-sm text-gray-900 shadow-lg backdrop-blur-xl placeholder:text-gray-500 transition-all",
                                            "focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200/50",
                                            query.trim() ? "pr-12" : "pr-5"
                                        )}
                                    />
                                    {query.trim() ? (
                                        <button
                                            type="button"
                                            aria-label="Clear search"
                                            onClick={() => setQuery("")}
                                            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    ) : null}
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFiltersPanelOpen((open) => !open)}
                                        aria-expanded={filtersPanelOpen}
                                        aria-controls="providers-filters-panel"
                                        id="providers-filters-trigger"
                                        className={cn(
                                            "inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold backdrop-blur-xl transition-all",
                                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2",
                                            filtersPanelOpen
                                                ? "bg-indigo-50/95 text-indigo-900"
                                                : "bg-white/80 text-gray-800 hover:bg-white"
                                        )}
                                    >
                                        <Filter className="h-4 w-4 shrink-0" />
                                        <span>Filters</span>
                                        {nonDefaultFilterCount > 0 ? (
                                            <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-bold text-white tabular-nums">
                                                {nonDefaultFilterCount}
                                            </span>
                                        ) : null}
                                        <ChevronDown
                                            className={cn(
                                                "h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200",
                                                filtersPanelOpen && "rotate-180 text-indigo-700"
                                            )}
                                            aria-hidden
                                        />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={exportToXlsx}
                                        disabled={filtered.length === 0}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/80 px-4 text-sm font-semibold text-gray-700 shadow-lg backdrop-blur-xl transition-all hover:bg-white hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <Download className="h-4 w-4 shrink-0" />
                                        Export XLSX
                                    </button>
                                    <div className="flex h-10 items-center gap-0.5 rounded-xl border border-white/20 bg-white/80 p-1 shadow-lg backdrop-blur-xl">
                                        <button
                                            type="button"
                                            aria-pressed={viewMode === "grid"}
                                            onClick={() => setViewMode("grid")}
                                            className={cn(
                                                "rounded-lg p-2 transition-all",
                                                viewMode === "grid"
                                                    ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md"
                                                    : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
                                            )}
                                        >
                                            <Grid3x3 className="h-5 w-5" />
                                        </button>
                                        <button
                                            type="button"
                                            aria-pressed={viewMode === "table"}
                                            onClick={() => setViewMode("table")}
                                            className={cn(
                                                "rounded-lg p-2 transition-all",
                                                viewMode === "table"
                                                    ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md"
                                                    : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
                                            )}
                                        >
                                            <List className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {filtersPanelOpen ? (
                            <div
                                id="providers-filters-panel"
                                role="region"
                                aria-labelledby="providers-filters-trigger"
                                className="relative overflow-hidden rounded-2xl border border-white/25 bg-white/75 px-6 py-5 backdrop-blur-xl sm:px-8 sm:py-6"
                            >
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/[0.06] via-transparent to-purple-500/[0.07]" />
                                <div className="relative">
                                    <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-gray-200/60 pb-4">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                                                <Filter className="h-[18px] w-[18px]" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h2 className="text-base font-semibold text-gray-900">Filters</h2>
                                                    {nonDefaultFilterCount > 0 ? (
                                                        <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold tabular-nums text-indigo-800">
                                                            {nonDefaultFilterCount} active
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs font-medium text-gray-400">Defaults</span>
                                                    )}
                                                </div>
                                                <p className="mt-0.5 text-sm text-gray-500">
                                                    Showing <span className="font-semibold text-gray-700">{filtered.length}</span> of{" "}
                                                    <span className="font-semibold text-gray-700">{attributeFilteredProviders.length}</span>
                                                    {query.trim() ? (
                                                        <>
                                                            {" "}
                                                            <span className="text-gray-400">(after search)</span>
                                                        </>
                                                    ) : null}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={resetFilters}
                                                disabled={nonDefaultFilterCount === 0}
                                                className={cn(
                                                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all",
                                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2",
                                                    nonDefaultFilterCount > 0
                                                        ? "bg-indigo-50/90 text-indigo-900 hover:bg-indigo-100/90"
                                                        : "cursor-not-allowed bg-gray-50/80 text-gray-400"
                                                )}
                                            >
                                                <RotateCcw className={cn("h-4 w-4 shrink-0", nonDefaultFilterCount === 0 && "opacity-50")} />
                                                Reset
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFiltersPanelOpen(false)}
                                                className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200/90 bg-white/90 px-3 text-gray-700 transition-all hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
                                                aria-label="Close filters"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                                        <SegmentGroup
                                            label="Archive"
                                            value={archiveVisibility}
                                            onChange={setArchiveVisibility}
                                            options={[
                                                { value: "active_only", label: "Active" },
                                                { value: "all", label: "All" },
                                                { value: "archived_only", label: "Archived" },
                                            ]}
                                        />
                                        <SegmentGroup
                                            label="Activation"
                                            value={activationFilter}
                                            onChange={setActivationFilter}
                                            options={[
                                                { value: "all", label: "All" },
                                                { value: "paid", label: "Paid" },
                                                { value: "unpaid", label: "Unpaid" },
                                            ]}
                                        />
                                        <SegmentGroup
                                            label="Services"
                                            value={servicesFilter}
                                            onChange={setServicesFilter}
                                            options={[
                                                { value: "all", label: "All" },
                                                { value: "with_services", label: "Has listings" },
                                                { value: "no_services", label: "None" },
                                            ]}
                                        />
                                        <SegmentGroup
                                            label="Account"
                                            value={accountFilter}
                                            onChange={setAccountFilter}
                                            options={[
                                                { value: "all", label: "All" },
                                                { value: "active", label: "Active" },
                                                { value: "inactive", label: "Inactive" },
                                            ]}
                                        />
                                    </div>
                                </div>
                            </div>
                            ) : null}
                        </div>

                        {actionError && (
                            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                {actionError}
                            </div>
                        )}

                        {loading && (
                            <div className="mb-4 text-sm text-gray-600 flex items-center gap-2">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Loading providers...
                            </div>
                        )}
                        {error && (
                            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        {/* Grid View */}
                        {viewMode === "grid" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {paginated.map((p) => {
                                    const src = p.profileImage || p.profile_image || p.avatar_url;
                                    const first = p.firstName ?? p.first_name;
                                    const last = p.lastName ?? p.last_name;
                                    const full = [first, last].filter(Boolean).join(" ");
                                    const label = full || p.name || "Unknown Provider";
                                    const serviceCount = p.id ? (serviceCounts[p.id] ?? 0) : 0;
                                    const archived = providerIsArchived(p);
                                    const rowBusy = actionBusyId === p.id;

                                    return (
                                        <div
                                            key={p.id}
                                            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] hover:border-white/40 ${archived ? "opacity-75" : ""}`}
                                        >
                                            <Link
                                                href={p.id ? `/admin/providers/${p.id}` : "#"}
                                                className="group relative block overflow-hidden p-6"
                                            >
                                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                            <div className="relative z-10">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex items-center gap-4">
                                                        {src && !failedImages.has(p.id) ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={src}
                                                                alt={label}
                                                                className="h-16 w-16 rounded-xl object-cover ring-2 ring-white/50 shadow-lg group-hover:ring-indigo-300 transition-all"
                                                                onError={() => setFailedImages((prev) => new Set(prev).add(p.id))}
                                                            />
                                                        ) : (
                                                            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white ring-2 ring-white/50 shadow-lg grid place-items-center text-xl font-bold">
                                                                {getInitials(p)}
                                                            </div>
                                                        )}
                                                        <div className="flex-1">
                                                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                                                                {label}
                                                            </h3>
                                                            <p className="text-sm text-gray-600 mt-1">{p.email ?? "—"}</p>
                                                            {archived ? (
                                                                <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                                                    Archived
                                                                </span>
                                                            ) : null}
                                                            <div className="mt-2 flex items-center gap-2">
                                                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                                    providerActivationPaid(p)
                                                                        ? "bg-emerald-100 text-emerald-700"
                                                                        : "bg-amber-100 text-amber-700"
                                                                }`}>
                                                                    {providerActivationPaid(p) ? "Activation Paid" : "Activation Fee Pending"}
                                                                </span>
                                                                {!providerActivationPaid(p) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            const first = p.firstName ?? p.first_name;
                                                                            const last = p.lastName ?? p.last_name;
                                                                            const name = [first, last].filter(Boolean).join(" ") || p.name || "Provider";
                                                                            setActivationTarget({ id: p.id, name });
                                                                        }}
                                                                        className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-200 transition-colors"
                                                                    >
                                                                        Pay
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    {p.phoneNumber || p.phone ? (
                                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                                            <Phone className="h-4 w-4 text-gray-400" />
                                                            <span>{p.phoneNumber ?? p.phone}</span>
                                                        </div>
                                                    ) : null}
                                                    {p.address ? (
                                                        <div className="flex items-start gap-2 text-sm text-gray-600">
                                                            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                                            <span className="line-clamp-2">{p.address}</span>
                                                        </div>
                                                    ) : null}
                                                    {p.createdAt && (
                                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                                            <Calendar className="h-4 w-4 text-gray-400" />
                                                            <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-4 pt-4 border-t border-gray-200/50 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Briefcase className="h-4 w-4 text-gray-400" />
                                                        <span className="text-sm font-medium text-gray-700">{serviceCount} Services</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className="text-sm font-semibold">View</span>
                                                        <ArrowUpRight className="h-4 w-4" />
                                                    </div>
                                                </div>
                                            </div>
                                            </Link>
                                            <div className="flex items-center justify-end border-t border-gray-200/50 bg-white/50 px-3 py-2">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-9 w-9 text-gray-600 hover:text-gray-900"
                                                            aria-label="Provider actions"
                                                        >
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48">
                                                        {p.id ? (
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/admin/providers/${p.id}`} className="flex cursor-pointer items-center gap-2">
                                                                    <ArrowUpRight className="h-4 w-4 shrink-0" />
                                                                    Open profile
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        ) : null}
                                                        {!archived && p.id ? (
                                                            <DropdownMenuItem
                                                                disabled={rowBusy}
                                                                onSelect={() => {
                                                                    void handleArchiveProvider(p.id);
                                                                }}
                                                            >
                                                                <span className="flex items-center gap-2">
                                                                    {rowBusy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Archive className="h-4 w-4 shrink-0" />}
                                                                    Archive
                                                                </span>
                                                            </DropdownMenuItem>
                                                        ) : null}
                                                        {archived && p.id ? (
                                                            <DropdownMenuItem
                                                                disabled={rowBusy}
                                                                onSelect={() => {
                                                                    void handleRestoreProvider(p.id);
                                                                }}
                                                            >
                                                                <span className="flex items-center gap-2">
                                                                    {rowBusy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <ArchiveRestore className="h-4 w-4 shrink-0" />}
                                                                    Restore
                                                                </span>
                                                            </DropdownMenuItem>
                                                        ) : null}
                                                        {p.id ? (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    variant="destructive"
                                                                    disabled={rowBusy}
                                                                    onSelect={() => setPendingDeleteProviderId(p.id)}
                                                                >
                                                                    <span className="flex items-center gap-2">
                                                                        <Trash2 className="h-4 w-4 shrink-0" />
                                                                        Delete
                                                                    </span>
                                                                </DropdownMenuItem>
                                                            </>
                                                        ) : null}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    );
                                })}
                                {paginated.length === 0 && !loading && (
                                    <div className="col-span-full rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 p-12 text-center">
                                        <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                            <Search className="h-8 w-8 text-gray-400" />
                                        </div>
                                        <p className="text-lg font-semibold text-gray-900 mb-2">No providers found</p>
                                        <p className="text-sm text-gray-600">Try adjusting your search or filters</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Table View */}
                        {viewMode === "table" && (
                            <div className="rounded-2xl border border-white/20 bg-white/80 backdrop-blur-xl shadow-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border-b border-white/20">
                                                <TableHead className="font-semibold text-gray-700 w-[60px]">#</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Provider</TableHead>
                                                <TableHead className="font-semibold text-gray-700">
                                                    <button 
                                                        className="inline-flex items-center gap-1 hover:text-indigo-600 transition-colors" 
                                                        onClick={() => toggleSort("name")}
                                                    >
                                                        Name
                                                        <ChevronsUpDown className="h-4 w-4 opacity-60" />
                                                    </button>
                                                </TableHead>
                                                <TableHead className="font-semibold text-gray-700">Contact</TableHead>
                                                <TableHead className="font-semibold text-gray-700">Location</TableHead>
                                                <TableHead className="font-semibold text-gray-700">
                                                    <button 
                                                        className="inline-flex items-center gap-1 hover:text-indigo-600 transition-colors" 
                                                        onClick={() => toggleSort("services")}
                                                    >
                                                        Services
                                                        <ChevronsUpDown className="h-4 w-4 opacity-60" />
                                                    </button>
                                                </TableHead>
                                                <TableHead className="font-semibold text-gray-700">
                                                    <button 
                                                        className="inline-flex items-center gap-1 hover:text-indigo-600 transition-colors" 
                                                        onClick={() => toggleSort("createdAt")}
                                                    >
                                                        Created
                                                        <ChevronsUpDown className="h-4 w-4 opacity-60" />
                                                    </button>
                                                </TableHead>
                                                <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paginated.map((p, idx) => {
                                                const src = p.profileImage || p.profile_image || p.avatar_url;
                                                const first = p.firstName ?? p.first_name;
                                                const last = p.lastName ?? p.last_name;
                                                const full = [first, last].filter(Boolean).join(" ");
                                                const label = full || p.name || "—";
                                                const serviceCount = p.id ? (serviceCounts[p.id] ?? 0) : 0;
                                                const archived = providerIsArchived(p);
                                                const rowBusy = actionBusyId === p.id;

                                                return (
                                                    <TableRow 
                                                        key={p.id} 
                                                        className={`hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-purple-50/30 transition-all border-b border-white/20 ${archived ? "opacity-75" : ""}`}
                                                    >
                                                        <TableCell className="text-sm font-medium text-gray-500">
                                                            {startIdx + idx + 1}
                                                        </TableCell>
                                                        <TableCell>
                                                            {src && !failedImages.has(p.id) ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img 
                                                                    src={src} 
                                                                    alt={label} 
                                                                    className="h-12 w-12 rounded-xl object-cover ring-2 ring-white/50 shadow-md"
                                                                    onError={() => setFailedImages((prev) => new Set(prev).add(p.id))}
                                                                />
                                                            ) : (
                                                                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white ring-2 ring-white/50 shadow-md grid place-items-center text-sm font-bold">
                                                                    {getInitials(p)}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col gap-1">
                                                                {p.id ? (
                                                                    <div className="flex flex-col">
                                                                        <Link 
                                                                            href={`/admin/providers/${p.id}`} 
                                                                            className="text-indigo-700 hover:text-indigo-900 hover:underline font-semibold transition-colors"
                                                                        >
                                                                            {label}
                                                                        </Link>
                                                                    <span className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                                                        <Mail className="h-3 w-3" />
                                                                        {p.email ?? ""}
                                                                    </span>
                                                                    <div className="mt-1 flex items-center gap-1.5">
                                                                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                                                            providerActivationPaid(p)
                                                                                ? "bg-emerald-100 text-emerald-700"
                                                                                : "bg-amber-100 text-amber-700"
                                                                        }`}>
                                                                            {providerActivationPaid(p) ? "Activation Paid" : "Activation Fee Pending"}
                                                                        </span>
                                                                        {!providerActivationPaid(p) && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.preventDefault();
                                                                                    e.stopPropagation();
                                                                                    setActivationTarget({ id: p.id, name: label });
                                                                                }}
                                                                                className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-200 transition-colors"
                                                                            >
                                                                                Pay
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold">{label}</span>
                                                                    <span className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                                                        <Mail className="h-3 w-3" />
                                                                        {p.email ?? ""}
                                                                    </span>
                                                                    <div className="mt-1 flex items-center gap-1.5">
                                                                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                                                            providerActivationPaid(p)
                                                                                ? "bg-emerald-100 text-emerald-700"
                                                                                : "bg-amber-100 text-amber-700"
                                                                        }`}>
                                                                            {providerActivationPaid(p) ? "Activation Paid" : "Activation Fee Pending"}
                                                                        </span>
                                                                        {!providerActivationPaid(p) && (
                                                                            <button
                                                                                onClick={() => setActivationTarget({ id: p.id, name: label })}
                                                                                className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-200 transition-colors"
                                                                            >
                                                                                Pay
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                                                <Phone className="h-4 w-4 text-gray-400" />
                                                                {p.phoneNumber ?? p.phone ?? "—"}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            {p.address ? (
                                                                <div className="flex items-start gap-2 text-sm text-gray-700 max-w-xs">
                                                                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                                                    <span className="line-clamp-2">{p.address}</span>
                                                                </div>
                                                            ) : (
                                                                "—"
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                                                                {serviceCount}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                                <Calendar className="h-4 w-4 text-gray-400" />
                                                                {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {archived ? (
                                                                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                                                        Archived
                                                                    </span>
                                                                ) : null}
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-9 w-9 text-gray-600 hover:text-gray-900"
                                                                            aria-label="Row actions"
                                                                        >
                                                                            <MoreVertical className="h-4 w-4" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-48">
                                                                        {p.id ? (
                                                                            <DropdownMenuItem asChild>
                                                                                <Link href={`/admin/providers/${p.id}`} className="flex cursor-pointer items-center gap-2">
                                                                                    <ArrowUpRight className="h-4 w-4 shrink-0" />
                                                                                    Open profile
                                                                                </Link>
                                                                            </DropdownMenuItem>
                                                                        ) : null}
                                                                        {!archived && p.id ? (
                                                                            <DropdownMenuItem
                                                                                disabled={rowBusy}
                                                                                onSelect={() => {
                                                                                    void handleArchiveProvider(p.id);
                                                                                }}
                                                                            >
                                                                                <span className="flex items-center gap-2">
                                                                                    {rowBusy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Archive className="h-4 w-4 shrink-0" />}
                                                                                    Archive
                                                                                </span>
                                                                            </DropdownMenuItem>
                                                                        ) : null}
                                                                        {archived && p.id ? (
                                                                            <DropdownMenuItem
                                                                                disabled={rowBusy}
                                                                                onSelect={() => {
                                                                                    void handleRestoreProvider(p.id);
                                                                                }}
                                                                            >
                                                                                <span className="flex items-center gap-2">
                                                                                    {rowBusy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <ArchiveRestore className="h-4 w-4 shrink-0" />}
                                                                                    Restore
                                                                                </span>
                                                                            </DropdownMenuItem>
                                                                        ) : null}
                                                                        {p.id ? (
                                                                            <>
                                                                                <DropdownMenuSeparator />
                                                                                <DropdownMenuItem
                                                                                    variant="destructive"
                                                                                    disabled={rowBusy}
                                                                                    onSelect={() => setPendingDeleteProviderId(p.id)}
                                                                                >
                                                                                    <span className="flex items-center gap-2">
                                                                                        <Trash2 className="h-4 w-4 shrink-0" />
                                                                                        Delete
                                                                                    </span>
                                                                                </DropdownMenuItem>
                                                                            </>
                                                                        ) : null}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                            {paginated.length === 0 && !loading && (
                                                <TableRow>
                                                    <TableCell className="px-4 py-12 text-center text-gray-500" colSpan={8}>
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                                                                <Search className="h-8 w-8 text-gray-400" />
                                                            </div>
                                                            <p className="text-lg font-semibold text-gray-900">No providers found</p>
                                                            <p className="text-sm text-gray-600">Try adjusting your search or filters</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {filtered.length > 0 && (
                            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/20 bg-white/80 backdrop-blur-xl px-6 py-3 shadow-lg">
                                <p className="text-sm text-gray-600">
                                    Showing <span className="font-semibold text-gray-900">{startIdx + 1}</span>–<span className="font-semibold text-gray-900">{Math.min(startIdx + PAGE_SIZE, filtered.length)}</span> of{' '}
                                    <span className="font-semibold text-gray-900">{filtered.length}</span>
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={safePage <= 1}
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <span className="min-w-[80px] text-center text-sm font-medium text-gray-700">
                                        Page {safePage} of {totalPages}
                                    </span>
                                    <button
                                        disabled={safePage >= totalPages}
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {pendingDeleteProviderId && (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                            onClick={() => !actionBusyId && setPendingDeleteProviderId(null)}
                        >
                            <div
                                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete provider</h3>
                                <p className="text-sm text-gray-600 mb-6">
                                    Permanently remove this provider. This cannot be undone. Foreign keys (services, bookings, etc.) may block deletion until related data is removed.
                                </p>
                                <div className="flex items-center gap-3 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setPendingDeleteProviderId(null)}
                                        disabled={Boolean(actionBusyId)}
                                        className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleDeleteProvider()}
                                        disabled={Boolean(actionBusyId)}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                                    >
                                        {actionBusyId === pendingDeleteProviderId ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activationTarget && (
                        <ActivationPaymentModal
                            open={!!activationTarget}
                            onClose={() => setActivationTarget(null)}
                            providerId={activationTarget.id}
                            providerName={activationTarget.name}
                        />
                    )}
                </main>
            </div>
        </AuthGuard>
    );
};

export default ProvidersPage;
