"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "../../../components/Sidebar";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { fetchProviders, fetchServiceCountsByProvider } from "../../../features/provider/providerSlice";
import type { Provider } from "@/features/provider/providerSlice";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronsUpDown, RefreshCw, Search, Briefcase } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";

const ProvidersPage = () => {
  const dispatch = useAppDispatch();
  const { providers, loading, error, serviceCounts } = useAppSelector((state) => state.provider);

  type SortKey = "name" | "email" | "services" | "createdAt";
  type SortDir = "asc" | "desc";
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [query, setQuery] = useState<string>("");

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

  return (
    <AuthGuard>
      <div className="flex">
        <Sidebar />
        <main className="ml-64 w-full min-h-screen">
        {/* Page header */}
        <div className="relative isolate overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600">
          <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-white/15 p-2 text-white ring-1 ring-white/20">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Service Providers</h1>
                  <p className="mt-2 text-white/80 text-sm">Manage and review all providers on the platform.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm text-white/80">{providers.length} total</div>
                <button
                  onClick={() => { dispatch(fetchProviders()); dispatch(fetchServiceCountsByProvider()); }}
                  className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white ring-1 ring-white/20 hover:bg-white/15"
                >
                  <RefreshCw className="h-4 w-4" /> Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8 bg-gray-50">
          {/* Toolbar */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-80">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, email, phone, address..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </div>
          </div>

          {loading && <div className="mb-4 text-sm text-gray-600">Loading providers...</div>}
          {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>
                  <button className="inline-flex items-center gap-1" onClick={() => toggleSort("name")}>
                    Name
                    <ChevronsUpDown className="h-4 w-4 opacity-60" />
                  </button>
                </TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>
                  <button className="inline-flex items-center gap-1" onClick={() => toggleSort("services")}>
                    Services
                    <ChevronsUpDown className="h-4 w-4 opacity-60" />
                  </button>
                </TableHead>
                <TableHead>
                  <button className="inline-flex items-center gap-1" onClick={() => toggleSort("createdAt")}>
                    Created
                    <ChevronsUpDown className="h-4 w-4 opacity-60" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} className="hover:bg-gray-50/60">
                  <TableCell>
                    {(() => {
                      const src = p.profileImage || p.profile_image || p.avatar_url;
                      if (!src) {
                        return (
                          <div className="h-10 w-10 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 grid place-items-center text-xs font-semibold">
                            {getInitials(p)}
                          </div>
                        );
                      }
                      return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt={p.name} className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200" />
                      );
                    })()}
                  </TableCell>
                  <TableCell className="font-medium">
                    {(() => {
                      const first = p.firstName ?? p.first_name;
                      const last = p.lastName ?? p.last_name;
                      const full = [first, last].filter(Boolean).join(" ");
                      const label = full || p.name || "—";
                      return p.id ? (
                        <div className="flex flex-col">
                          <Link href={`/admin/providers/${p.id}`} className="text-indigo-700 hover:underline">
                            {label}
                          </Link>
                          <span className="text-xs text-gray-500">{p.email ?? ""}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span>{label}</span>
                          <span className="text-xs text-gray-500">{p.email ?? ""}</span>
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>{p.phoneNumber ?? p.phone ?? "—"}</TableCell>
                  <TableCell>{p.address ?? "—"}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
                      {p.id ? (serviceCounts[p.id] ?? 0) : 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}</span>
                  </TableCell>
                </TableRow>
              ))}
        {filtered.length === 0 && !loading && (
                <TableRow>
          <TableCell className="px-4 py-6 text-center text-gray-500" colSpan={6}>
                    No providers found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableCaption>All registered service providers</TableCaption>
            </Table>
          </div>
        </div>
        </main>
      </div>
    </AuthGuard>
  );
};

export default ProvidersPage;
