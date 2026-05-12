"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "../../../components/Sidebar";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { fetchProviders, fetchServiceCountsByProvider } from "../../../features/provider/providerSlice";
import type { Provider } from "@/features/provider/providerSlice";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
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
    Zap
} from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import * as XLSX from "xlsx";

const PAGE_SIZE = 20;

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

    const sortedProviders = useMemo(() => {
        const arr = [...providers];
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
    }, [providers, sortBy, sortDir, serviceCounts]);

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
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Providers');
        XLSX.writeFile(wb, `providers_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = (safePage - 1) * PAGE_SIZE;
    const paginated = filtered.slice(startIdx, startIdx + PAGE_SIZE);

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
    }, [dispatch]);

    useEffect(() => {
        setCurrentPage(1);
    }, [query]);

    // Calculate statistics
    const stats = useMemo(() => {
        const totalServices = Object.values(serviceCounts).reduce((sum, count) => sum + count, 0);
        const avgServicesPerProvider = providers.length > 0 ? totalServices / providers.length : 0;
        const providersWithServices = Object.keys(serviceCounts).length;
        
        return {
            totalProviders: providers.length,
            totalServices,
            avgServicesPerProvider: Math.round(avgServicesPerProvider * 10) / 10,
            providersWithServices,
            providersWithoutServices: providers.length - providersWithServices
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
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl border border-primary-foreground/15 bg-card/15 px-4 py-2 backdrop-blur-md">
                                        <div className="text-sm text-primary-foreground/80">Total Providers</div>
                                        <div className="text-2xl font-bold text-primary-foreground">{stats.totalProviders}</div>
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
                        <section className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
                        </section>

                        {/* Search and View Toggle */}
                        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="relative flex-1 max-w-md">
                                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search providers by name, email, phone, address..."
                                    className="w-full rounded-xl border border-white/20 bg-white/80 backdrop-blur-xl py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200/50 shadow-lg transition-all"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={exportToXlsx}
                                    disabled={filtered.length === 0}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/80 backdrop-blur-xl px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-lg transition-all hover:bg-white hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Download className="h-4 w-4" />
                                    Export XLSX
                                </button>
                                <div className="flex items-center gap-2 rounded-xl bg-white/80 backdrop-blur-xl border border-white/20 p-1 shadow-lg">
                                    <button
                                        onClick={() => setViewMode("grid")}
                                        className={`p-2 rounded-lg transition-all ${
                                            viewMode === "grid"
                                                ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg"
                                                : "text-gray-600 hover:text-gray-900"
                                        }`}
                                    >
                                        <Grid3x3 className="h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode("table")}
                                        className={`p-2 rounded-lg transition-all ${
                                            viewMode === "table"
                                                ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg"
                                                : "text-gray-600 hover:text-gray-900"
                                        }`}
                                    >
                                        <List className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

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

                                    return (
                                        <Link
                                            key={p.id}
                                            href={p.id ? `/admin/providers/${p.id}` : "#"}
                                            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] hover:border-white/40"
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
                                                            <span className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                                p.activation_paid
                                                                    ? "bg-emerald-100 text-emerald-700"
                                                                    : "bg-amber-100 text-amber-700"
                                                            }`}>
                                                                {p.activation_paid ? "Activation Paid" : "Activation Fee Pending"}
                                                            </span>
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
                                    );
                                })}
                                {paginated.length === 0 && !loading && (
                                    <div className="col-span-full rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 p-12 text-center">
                                        <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                            <Search className="h-8 w-8 text-gray-400" />
                                        </div>
                                        <p className="text-lg font-semibold text-gray-900 mb-2">No providers found</p>
                                        <p className="text-sm text-gray-600">Try adjusting your search criteria</p>
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

                                                return (
                                                    <TableRow 
                                                        key={p.id} 
                                                        className="hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-purple-50/30 transition-all border-b border-white/20"
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
                                                        <TableCell className="font-medium">
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
                                                                    <span className={`mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                                                        p.activation_paid
                                                                            ? "bg-emerald-100 text-emerald-700"
                                                                            : "bg-amber-100 text-amber-700"
                                                                    }`}>
                                                                        {p.activation_paid ? "Activation Paid" : "Activation Fee Pending"}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold">{label}</span>
                                                                    <span className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                                                        <Mail className="h-3 w-3" />
                                                                        {p.email ?? ""}
                                                                    </span>
                                                                    <span className={`mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                                                        p.activation_paid
                                                                            ? "bg-emerald-100 text-emerald-700"
                                                                            : "bg-amber-100 text-amber-700"
                                                                    }`}>
                                                                        {p.activation_paid ? "Activation Paid" : "Activation Fee Pending"}
                                                                    </span>
                                                                </div>
                                                            )}
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
                                                    </TableRow>
                                                );
                                            })}
                                            {paginated.length === 0 && !loading && (
                                                <TableRow>
                                                    <TableCell className="px-4 py-12 text-center text-gray-500" colSpan={7}>
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                                                                <Search className="h-8 w-8 text-gray-400" />
                                                            </div>
                                                            <p className="text-lg font-semibold text-gray-900">No providers found</p>
                                                            <p className="text-sm text-gray-600">Try adjusting your search criteria</p>
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
                </main>
            </div>
        </AuthGuard>
    );
};

export default ProvidersPage;
