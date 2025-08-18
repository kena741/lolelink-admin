"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "../../../components/Sidebar";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { fetchProviders, fetchServiceCountsByProvider } from "../../../features/provider/providerSlice";
import type { Provider } from "@/features/provider/providerSlice";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronsUpDown } from "lucide-react";

const ProvidersPage = () => {
  const dispatch = useAppDispatch();
  const { providers, loading, error, serviceCounts } = useAppSelector((state) => state.provider);

  type SortKey = "name" | "email" | "services" | "createdAt";
  type SortDir = "asc" | "desc";
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  useEffect(() => {
  dispatch(fetchProviders());
  dispatch(fetchServiceCountsByProvider());
  }, [dispatch]);

  return (
    <div className="flex">
      <Sidebar />
      <main className="ml-64 w-full p-10 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Service Providers</h1>
          <button
            onClick={() => dispatch(fetchProviders())}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        {loading && <div className="mb-4">Loading providers...</div>}
        {error && <div className="mb-4 text-red-600">{error}</div>}

        <div className="bg-white rounded shadow overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profile</TableHead>
                <TableHead>
                  <button className="inline-flex items-center gap-1" onClick={() => toggleSort("name")}>
                    Name
                    <ChevronsUpDown className="h-4 w-4 opacity-60" />
                  </button>
                </TableHead>
                <TableHead>
                  <button className="inline-flex items-center gap-1" onClick={() => toggleSort("email")}>
                    Email
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
              {sortedProviders.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {(() => {
                      const src = p.profileImage || p.profile_image || p.avatar_url;
                      if (!src) return <div className="h-10 w-10 rounded-full bg-gray-200" />;
                      return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt={p.name} className="h-10 w-10 rounded-full object-cover" />
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
                        <Link href={`/admin/providers/${p.id}`} className="text-blue-600 hover:underline">
                          {label}
                        </Link>
                      ) : (
                        label
                      );
                    })()}
                  </TableCell>
                  <TableCell>{p.email ?? "—"}</TableCell>
                  <TableCell>{p.phoneNumber ?? p.phone ?? "—"}</TableCell>
                  <TableCell>{p.address ?? "—"}</TableCell>
                  <TableCell>{p.id ? (serviceCounts[p.id] ?? 0) : 0}</TableCell>
                  <TableCell>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}</TableCell>
                </TableRow>
              ))}
              {providers.length === 0 && !loading && (
                <TableRow>
                  <TableCell className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                    No providers found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableCaption>All registered service providers</TableCaption>
          </Table>
        </div>
      </main>
    </div>
  );
};

export default ProvidersPage;
