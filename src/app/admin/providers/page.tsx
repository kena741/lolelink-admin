"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { fetchProviders, fetchServiceCountsByProvider, archiveProvider, restoreProvider, deleteProvider, updateProvider } from "../../../features/provider/providerSlice";
import type { Provider } from "@/features/provider/providerSlice";
import { AdminNoteField } from "@/components/AdminNoteField";
import { resolveProfileImageUrl } from "@/lib/media-url";
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
import AdminPageHeader, { adminHeaderButtonClassName } from "@/components/AdminPageHeader";
import { ActivationPaymentModal } from "@/components/ActivationPaymentModal";
import { useAdminPermissions } from "@/hooks/use-admin-permissions";
import { ServiceTierBadge } from "@/components/ServiceTierBadge";
import { fetchSettings } from "@/features/settings/settingsSlice";
import { cn } from "@/lib/utils";
import { markAdminListFetched, shouldRefetchAdminList } from "@/lib/admin-list-cache";
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

function ProviderActivationStatus({
    provider,
    onPay,
}: {
    provider: Provider;
    onPay?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
    const paid = providerActivationPaid(provider);

    if (paid) {
        return (
            <span className="inline-flex h-5 items-center gap-1 rounded-md bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
                <BadgeCheck className="h-3 w-3 shrink-0" strokeWidth={2.25} />
                Activation paid
            </span>
        );
    }

    return (
        <>
            <span className="inline-flex h-5 items-center rounded-md bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                Fee pending
            </span>
            {onPay ? (
                <button
                    type="button"
                    onClick={onPay}
                    className="inline-flex h-5 shrink-0 items-center rounded-md bg-primary px-2 text-[10px] font-medium text-primary-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                    Pay fee
                </button>
            ) : null}
        </>
    );
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
        <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
            <div
                className="inline-flex max-w-full flex-nowrap overflow-x-auto rounded-lg border border-border bg-muted/50 p-0.5"
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
                                "inline-flex h-7 shrink-0 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors duration-150",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                                selected
                                    ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                                    : "text-muted-foreground hover:text-foreground"
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
    const { canWriteProviders } = useAdminPermissions();
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
    type TierFilter = "all" | "0" | "1" | "5" | "10" | "10_plus";
    const [archiveVisibility, setArchiveVisibility] = useState<ArchiveVisibility>("active_only");
    const [activationFilter, setActivationFilter] = useState<ActivationFilter>("all");
    const [servicesFilter, setServicesFilter] = useState<ServicesFilter>("all");
    const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
    const [tierFilter, setTierFilter] = useState<TierFilter>("all");
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
        if (tierFilter !== "all") n += 1;
        return n;
    }, [archiveVisibility, activationFilter, servicesFilter, accountFilter, tierFilter]);

    const resetFilters = useCallback(() => {
        setArchiveVisibility("active_only");
        setActivationFilter("all");
        setServicesFilter("all");
        setAccountFilter("all");
        setTierFilter("all");
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
            const tier = p.service_tier_max ?? 0;
            if (tierFilter === "0" && tier !== 0) return false;
            if (tierFilter === "1" && tier !== 1) return false;
            if (tierFilter === "5" && tier !== 5) return false;
            if (tierFilter === "10" && tier !== 10) return false;
            if (tierFilter === "10_plus" && tier <= 10) return false;
            return true;
        });
    }, [providers, archiveVisibility, activationFilter, servicesFilter, accountFilter, tierFilter, serviceCounts]);

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
            'Service tier max': p.service_tier_max ?? 0,
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
        // Service counts must not ride the providers list TTL — empty {} looks "stale-ok" while cards show 0.
        void dispatch(fetchServiceCountsByProvider());
    }, [dispatch]);

    useEffect(() => {
        if (!shouldRefetchAdminList('providers', { hasRows: providers.length > 0 })) return;
        void Promise.all([
            dispatch(fetchProviders()),
            dispatch(fetchSettings()),
        ]).then(() => markAdminListFetched('providers'));
    }, [dispatch, providers.length]);

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
    }, [query, archiveVisibility, activationFilter, servicesFilter, accountFilter, tierFilter]);

    // Calculate statistics
    const stats = useMemo(() => {
        const totalServices = Object.values(serviceCounts).reduce((sum, count) => sum + count, 0);
        const providersWithServices = Object.keys(serviceCounts).length;
        const avgServicesPerProvider =
            providersWithServices > 0 ? totalServices / providersWithServices : 0;
        
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

    const StatCard = ({
        title,
        value,
        icon: Icon,
        iconBg,
        iconClassName,
    }: {
        title: string;
        value: number | string;
        icon: React.ElementType;
        iconBg: string;
        iconClassName?: string;
    }) => (
        <div className="group relative min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all duration-150 hover:bg-muted/40 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-secondary">
                        {title}
                    </p>
                    {loading ? (
                        <span className="mt-1 inline-block h-7 w-24 animate-pulse rounded bg-muted" />
                    ) : (
                        <p
                            className="mt-1 min-w-0 font-heading text-[clamp(1rem,1.4vw+0.55rem,1.5rem)] font-bold leading-tight tabular-nums tracking-normal text-text-primary"
                            title={typeof value === 'number' ? value.toLocaleString('en-US') : String(value)}
                        >
                            {typeof value === 'number' ? value.toLocaleString('en-US') : value}
                        </p>
                    )}
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${iconBg}`}>
                    <Icon className={`h-5 w-5 ${iconClassName ?? 'text-text-secondary'}`} />
                </div>
            </div>
        </div>
    );

    return (
        <>
            
                
                    <div className="mx-auto min-w-0 w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                        <AdminPageHeader
                            title="Service Providers"
                            description="Manage and review all providers on the platform"
                            actions={
                                <button
                                    type="button"
                                    onClick={() => {
                                        void Promise.all([
                                            dispatch(fetchProviders()),
                                            dispatch(fetchServiceCountsByProvider()),
                                        ]).then(() => markAdminListFetched('providers'));
                                    }}
                                    className={adminHeaderButtonClassName()}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh
                                </button>
                            }
                        />
                        <section className="mb-8 grid grid-cols-1 gap-4 min-w-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                            <StatCard
                                title="Providers"
                                value={stats.totalProviders}
                                icon={Users}
                                iconBg="bg-primary/15"
                            />
                            <StatCard
                                title="Services"
                                value={stats.totalServices}
                                icon={Briefcase}
                                iconBg="bg-chart-2/15"
                                iconClassName="text-chart-2"
                            />
                            <StatCard
                                title="Avg Services"
                                value={stats.avgServicesPerProvider}
                                icon={TrendingUp}
                                iconBg="bg-chart-3/15"
                                iconClassName="text-chart-3"
                            />
                            <StatCard
                                title="With Services"
                                value={stats.providersWithServices}
                                icon={Zap}
                                iconBg="bg-chart-4/15"
                                iconClassName="text-chart-4"
                            />
                            <StatCard
                                title="Activation Paid"
                                value={stats.activationPaidCount}
                                icon={BadgeCheck}
                                iconBg="bg-chart-5/15"
                                iconClassName="text-chart-5"
                            />
                        </section>

                        {/* Search and filters */}
                        <div className="mb-6 flex flex-col gap-5">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="relative w-full max-w-md flex-1">
                                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search name, email, phone, address…"
                                        className={cn(
                                            "h-10 w-full rounded-md border border-border bg-card py-2 pl-11 text-sm text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06)] placeholder:text-muted-foreground transition-colors",
                                            "focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30",
                                            query.trim() ? "pr-11" : "pr-4"
                                        )}
                                    />
                                    {query.trim() ? (
                                        <button
                                            type="button"
                                            aria-label="Clear search"
                                            onClick={() => setQuery("")}
                                            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                                            "inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors duration-150",
                                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                            filtersPanelOpen
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border bg-card text-foreground hover:bg-muted"
                                        )}
                                    >
                                        <Filter className="h-4 w-4 shrink-0" />
                                        <span>Filters</span>
                                        {nonDefaultFilterCount > 0 ? (
                                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary-foreground/20 px-1.5 text-[11px] font-bold tabular-nums">
                                                {nonDefaultFilterCount}
                                            </span>
                                        ) : null}
                                        <ChevronDown
                                            className={cn(
                                                "h-4 w-4 shrink-0 transition-transform duration-200",
                                                filtersPanelOpen && "rotate-180"
                                            )}
                                            aria-hidden
                                        />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={exportToXlsx}
                                        disabled={filtered.length === 0}
                                        className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <Download className="h-4 w-4 shrink-0" />
                                        Export XLSX
                                    </button>
                                    <div className="flex h-10 items-center gap-0.5 rounded-md border border-border bg-card p-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                                        <button
                                            type="button"
                                            aria-pressed={viewMode === "grid"}
                                            onClick={() => setViewMode("grid")}
                                            className={cn(
                                                "rounded-md p-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                                viewMode === "grid"
                                                    ? "bg-primary text-primary-foreground"
                                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                            )}
                                        >
                                            <Grid3x3 className="h-5 w-5" />
                                        </button>
                                        <button
                                            type="button"
                                            aria-pressed={viewMode === "table"}
                                            onClick={() => setViewMode("table")}
                                            className={cn(
                                                "rounded-md p-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                                viewMode === "table"
                                                    ? "bg-primary text-primary-foreground"
                                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
                                className="rounded-xl border border-border bg-card px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:px-5"
                            >
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="text-sm font-semibold text-foreground">Filters</h2>
                                            {nonDefaultFilterCount > 0 ? (
                                                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                                                    {nonDefaultFilterCount} active
                                                </span>
                                            ) : null}
                                            <span className="text-xs text-muted-foreground">
                                                {filtered.length}
                                                {query.trim() ? ` match · ${attributeFilteredProviders.length} before search` : ` providers`}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={resetFilters}
                                            disabled={nonDefaultFilterCount === 0}
                                            className={cn(
                                                "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors duration-150",
                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                                nonDefaultFilterCount > 0
                                                    ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                                                    : "cursor-not-allowed text-muted-foreground/50"
                                            )}
                                        >
                                            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                                            Reset
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFiltersPanelOpen(false)}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                            aria-label="Close filters"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                                            label="Tier"
                                            value={tierFilter}
                                            onChange={setTierFilter}
                                            options={[
                                                { value: "all", label: "All" },
                                                { value: "0", label: "0" },
                                                { value: "1", label: "1" },
                                                { value: "5", label: "5" },
                                                { value: "10", label: "10" },
                                                { value: "10_plus", label: "10+" },
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
                            ) : null}
                        </div>

                        {actionError && (
                            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                                {actionError}
                            </div>
                        )}

                        {loading && (
                            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                                Loading providers...
                            </div>
                        )}
                        {error && (
                            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        {/* Grid View */}
                        {viewMode === "grid" && (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {paginated.map((p) => {
                                    const src = resolveProfileImageUrl(p);
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
                                            className={`relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all duration-150 hover:bg-muted/30 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] ${archived ? "opacity-75" : ""}`}
                                        >
                                            <div className="absolute right-2 top-2 z-10">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
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
                                                        {!archived && p.id && canWriteProviders ? (
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
                                                        {archived && p.id && canWriteProviders ? (
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
                                                        {p.id && canWriteProviders ? (
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
                                            <Link
                                                href={p.id ? `/admin/providers/${p.id}` : "#"}
                                                className="group relative block p-6 pr-12"
                                            >
                                            <div>
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex items-center gap-4">
                                                        {src && !failedImages.has(p.id) ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={src}
                                                                alt={label}
                                                                className="h-16 w-16 rounded-xl object-cover shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all"
                                                                onError={() => setFailedImages((prev) => new Set(prev).add(p.id))}
                                                            />
                                                        ) : (
                                                            <div className="grid h-16 w-16 place-items-center rounded-xl bg-primary text-xl font-bold text-primary-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                                                                {getInitials(p)}
                                                            </div>
                                                        )}
                                                        <div className="flex-1">
                                                            <h3 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary">
                                                                {label}
                                                            </h3>
                                                            <p className="mt-1 text-sm text-muted-foreground">{p.email ?? "—"}</p>
                                                            {archived ? (
                                                                <span className="mt-2 inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                                                                    Archived
                                                                </span>
                                                            ) : null}
                                                            <div className="mt-2 flex flex-nowrap items-center gap-1.5 overflow-x-auto">
                                                                <ProviderActivationStatus
                                                                    provider={p}
                                                                    onPay={
                                                                        canWriteProviders
                                                                            ? (e) => {
                                                                                  e.preventDefault();
                                                                                  e.stopPropagation();
                                                                                  const first = p.firstName ?? p.first_name;
                                                                                  const last = p.lastName ?? p.last_name;
                                                                                  const name = [first, last].filter(Boolean).join(" ") || p.name || "Provider";
                                                                                  setActivationTarget({ id: p.id, name });
                                                                              }
                                                                            : undefined
                                                                    }
                                                                />
                                                                <ServiceTierBadge tierMax={p.service_tier_max} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    {p.phoneNumber || p.phone ? (
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <Phone className="h-4 w-4 text-muted-foreground" />
                                                            <span>{p.phoneNumber ?? p.phone}</span>
                                                        </div>
                                                    ) : null}
                                                    {p.address ? (
                                                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                                            <span className="line-clamp-2">{p.address}</span>
                                                        </div>
                                                    ) : null}
                                                    {p.createdAt && (
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                                            <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-4 flex items-center justify-between pt-1">
                                                    <div className="flex items-center gap-2">
                                                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm font-medium text-foreground">{serviceCount} Services</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                                                        <span className="text-sm font-semibold">View</span>
                                                        <ArrowUpRight className="h-4 w-4" />
                                                    </div>
                                                </div>
                                            </div>
                                            </Link>
                                        </div>
                                    );
                                })}
                                {paginated.length === 0 && !loading && (
                                    <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                            <Search className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <p className="mb-2 text-lg font-semibold text-foreground">No providers found</p>
                                        <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Table View */}
                        {viewMode === "table" && (
                            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="[&_tr]:border-0">
                                            <TableRow className="border-0 bg-muted/40">
                                                <TableHead className="w-15 font-semibold text-foreground">#</TableHead>
                                                <TableHead className="font-semibold text-foreground">Provider</TableHead>
                                                <TableHead className="font-semibold text-foreground">
                                                    <button 
                                                        className="inline-flex items-center gap-1 transition-colors hover:text-primary" 
                                                        onClick={() => toggleSort("name")}
                                                    >
                                                        Name
                                                        <ChevronsUpDown className="h-4 w-4 opacity-60" />
                                                    </button>
                                                </TableHead>
                                                <TableHead className="font-semibold text-foreground">Contact</TableHead>
                                                <TableHead className="font-semibold text-foreground">Location</TableHead>
                                                <TableHead className="font-semibold text-foreground">
                                                    <button 
                                                        className="inline-flex items-center gap-1 transition-colors hover:text-primary" 
                                                        onClick={() => toggleSort("services")}
                                                    >
                                                        Services
                                                        <ChevronsUpDown className="h-4 w-4 opacity-60" />
                                                    </button>
                                                </TableHead>
                                                <TableHead className="font-semibold text-foreground">
                                                    <button 
                                                        className="inline-flex items-center gap-1 transition-colors hover:text-primary" 
                                                        onClick={() => toggleSort("createdAt")}
                                                    >
                                                        Created
                                                        <ChevronsUpDown className="h-4 w-4 opacity-60" />
                                                    </button>
                                                </TableHead>
                                                <TableHead className="min-w-40 font-semibold text-foreground">Note</TableHead>
                                                <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paginated.map((p, idx) => {
                                                const src = resolveProfileImageUrl(p);
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
                                                        className={`border-0 transition-colors hover:bg-muted/30 ${archived ? "opacity-75" : ""}`}
                                                    >
                                                        <TableCell className="text-sm font-medium text-muted-foreground">
                                                            {startIdx + idx + 1}
                                                        </TableCell>
                                                        <TableCell>
                                                            {src && !failedImages.has(p.id) ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img 
                                                                    src={src} 
                                                                    alt={label} 
                                                                    className="h-12 w-12 rounded-xl object-cover shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                                                                    onError={() => setFailedImages((prev) => new Set(prev).add(p.id))}
                                                                />
                                                            ) : (
                                                                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
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
                                                                            className="font-semibold text-primary transition-colors hover:text-primary/80 hover:underline"
                                                                        >
                                                                            {label}
                                                                        </Link>
                                                                    <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                                                        <Mail className="h-3 w-3" />
                                                                        {p.email ?? ""}
                                                                    </span>
                                                                    <div className="mt-1.5 flex flex-nowrap items-center gap-1.5 overflow-x-auto">
                                                                        <ProviderActivationStatus
                                                                            provider={p}
                                                                            onPay={
                                                                                canWriteProviders
                                                                                    ? (e) => {
                                                                                          e.preventDefault();
                                                                                          e.stopPropagation();
                                                                                          setActivationTarget({ id: p.id, name: label });
                                                                                      }
                                                                                    : undefined
                                                                            }
                                                                        />
                                                                        <ServiceTierBadge tierMax={p.service_tier_max} />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold">{label}</span>
                                                                    <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                                                        <Mail className="h-3 w-3" />
                                                                        {p.email ?? ""}
                                                                    </span>
                                                                    <div className="mt-1.5 flex flex-nowrap items-center gap-1.5 overflow-x-auto">
                                                                        <ProviderActivationStatus
                                                                            provider={p}
                                                                            onPay={
                                                                                canWriteProviders
                                                                                    ? () => setActivationTarget({ id: p.id, name: label })
                                                                                    : undefined
                                                                            }
                                                                        />
                                                                        <ServiceTierBadge tierMax={p.service_tier_max} />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2 text-sm text-foreground">
                                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                                {p.phoneNumber ?? p.phone ?? "—"}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            {p.address ? (
                                                                <div className="flex max-w-xs items-start gap-2 text-sm text-foreground">
                                                                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                                                    <span className="line-clamp-2">{p.address}</span>
                                                                </div>
                                                            ) : (
                                                                "—"
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                                                                {serviceCount}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                                {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                                            {p.id ? (
                                                                <AdminNoteField
                                                                    display="text"
                                                                    value={p.admin_note}
                                                                    disabled={!canWriteProviders}
                                                                    onSave={async (note) => {
                                                                        if (!canWriteProviders) return;
                                                                        await dispatch(
                                                                            updateProvider({
                                                                                id: p.id,
                                                                                updates: { admin_note: note || null },
                                                                            })
                                                                        ).unwrap();
                                                                    }}
                                                                />
                                                            ) : null}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {archived ? (
                                                                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                                                                        Archived
                                                                    </span>
                                                                ) : null}
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-9 w-9 text-muted-foreground hover:text-foreground"
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
                                                                        {!archived && p.id && canWriteProviders ? (
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
                                                                        {archived && p.id && canWriteProviders ? (
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
                                                                        {p.id && canWriteProviders ? (
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
                                                    <TableCell className="px-4 py-12 text-center text-muted-foreground" colSpan={8}>
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                                                <Search className="h-8 w-8 text-muted-foreground" />
                                                            </div>
                                                            <p className="text-lg font-semibold text-foreground">No providers found</p>
                                                            <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
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
                            <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-card px-6 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                                <p className="text-sm text-muted-foreground">
                                    Showing <span className="font-semibold text-foreground">{startIdx + 1}</span>–<span className="font-semibold text-foreground">{Math.min(startIdx + PAGE_SIZE, filtered.length)}</span> of{' '}
                                    <span className="font-semibold text-foreground">{filtered.length}</span>
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={safePage <= 1}
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <span className="min-w-20 text-center text-sm font-medium text-foreground">
                                        Page {safePage} of {totalPages}
                                    </span>
                                    <button
                                        disabled={safePage >= totalPages}
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                                className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h3 className="mb-2 text-lg font-bold text-foreground">Delete provider</h3>
                                <p className="mb-6 text-sm text-muted-foreground">
                                    Permanently remove this provider. This cannot be undone. Foreign keys (services, bookings, etc.) may block deletion until related data is removed.
                                </p>
                                <div className="flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setPendingDeleteProviderId(null)}
                                        disabled={Boolean(actionBusyId)}
                                        className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleDeleteProvider()}
                                        disabled={Boolean(actionBusyId)}
                                        className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                
            
        </>
    );
};

export default ProvidersPage;
