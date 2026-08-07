'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import { 
    FileCheck, 
    ArrowLeft, 
    RefreshCw, 
    CheckCircle2, 
    XCircle, 
    Clock,
    User,
    Mail,
    Phone,
    FileText,
    MessageSquare,
    Eye,
    Search,
    RotateCcw,
} from 'lucide-react';
import Link from 'next/link';
import { StorageImage } from '@/components/StorageImage';
import { DocumentMediaPreview } from '@/components/DocumentMediaPreview';
import {
    fetchVerifyDocuments,
    verifyDocument,
    rejectDocument,
    approveAllDocuments,
    reapproveAllRejectedDocuments,
} from '@/features/verifyDocuments/verifyDocumentsSlice';
import { getSupabase } from '@/lib/supabaseClient';
import { sendSms, buildRecipient } from '@/lib/sms';
import { cn } from '@/lib/utils';
import { getDisplayImageUrl } from '@/lib/media-url';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const VerifyDocumentsPage = () => {
    const dispatch = useAppDispatch();
    const { canVerifyProviders } = useAdminPermissions();
    const { documents, loading, error } = useAppSelector((state) => state.verifyDocuments);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [processingProviderId, setProcessingProviderId] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [selectedDocument, setSelectedDocument] = useState<typeof documents[0] | null>(null);
    const [providerPhone, setProviderPhone] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [subCategoryFilter, setSubCategoryFilter] = useState<string>('all');

    useEffect(() => {
        dispatch(fetchVerifyDocuments());
    }, [dispatch]);

    function getApproveMessage(providerName?: string, docName?: string) {
        const name = providerName || '';
        return docName
            ? `ሰላም ${name}! ከዘመን ፕሮቫይደር ሰለተመዘገቡ እናመሰግናለን። የእርስዎ ሰነድ "${docName}" ተገምግሞ ጸድቋል። አሁን በዘመን ፕሮቫይደር መተግበሪያ ላይ አገልግሎት መስጠት ይችላሉ። መልካም ስራ!`
            : `ሰላም ${name}! ከዘመን ፕሮቫይደር ሰለተመዘገቡ እናመሰግናለን። ሰነዶችዎ ተገምግመው ጸድቀዋል። አሁን በዘመን ፕሮቫይደር መተግበሪያ ላይ አገልግሎት መስጠት ይችላሉ። መልካም ስራ!`;
    }

    function getApproveAllMessage(providerName?: string) {
        const name = providerName || '';
        return `ሰላም ${name}! ከዘመን ሰለተመዘገቡ ፕሮቫይደር እናመሰግናለን። ሁሉም ሰነዶችዎ ተገምግመው ጸድቀዋል። አሁን በዘመን ፕሮቫይደር መተግበሪያ ላይ አገልግሎት መስጠት ይችላሉ። መልካም ስራ!`;
    }

    function getRejectMessage(providerName?: string) {
        const name = providerName || '';
        return `ሰላም ${name}! ለዘመን አገልግሎት ሰጪነት ያቀረቡት ጥያቄ ውድቅ ተደርጓል እባክዎ ትክክለኛ ሰነድ ያስገቡ ወይም በዚህ ስልክ 0951175959 ደውለው ይጠይቁ:: ለትብብርዎ እናመሰግናለን!!`;
    }

    async function fetchProviderPhone(providerId: string): Promise<string> {
        try {
            const { data } = await getSupabase()
                .from('provider')
                .select('*')
                .eq('id', providerId)
                .single();

            if (!data) return '';
            const row = data as Record<string, unknown>;
            const phone = (row.phoneNumber ?? row.phone ?? row.mobile_number ?? '') as string;
            const code = (row.countryCode ?? row.country_code ?? '') as string;
            return buildRecipient(phone, code);
        } catch {
            return '';
        }
    }

    async function notifyProviderViaSms(providerId: string, message: string) {
        try {
            const recipient = await fetchProviderPhone(providerId);
            if (recipient) {
                const result = await sendSms(recipient, message);
                if (!result.success) console.error('SMS failed:', result.error);
            } else {
                console.error('SMS skipped: no phone number for provider', providerId);
            }
        } catch (err) {
            console.error('SMS notification failed:', err);
        }
    }

    async function openDocumentDetail(doc: typeof documents[0]) {
        setSelectedDocument(doc);
        setRejectionReason(getRejectMessage(doc.providerName));
        setProviderPhone(null);
        const phone = await fetchProviderPhone(doc.providerId);
        setProviderPhone(phone);
    }

    const handleVerify = async (id: string, docHint?: (typeof documents)[0]) => {
        if (!canVerifyProviders) return;
        setProcessingId(id);
        try {
            const result = await dispatch(verifyDocument(id)).unwrap();
            dispatch(fetchVerifyDocuments());
            await notifyProviderViaSms(
                result.providerId,
                getApproveMessage(
                    docHint?.providerName ?? result.providerName,
                    docHint?.documentName ?? result.documentName
                )
            );
        } catch (err) {
            console.error('Failed to verify document:', err);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (
        id: string,
        docHint?: (typeof documents)[0]
    ): Promise<boolean> => {
        if (!canVerifyProviders) return false;
        const trimmedReason = rejectionReason.trim();
        if (!trimmedReason) return false;

        setProcessingId(id);
        try {
            const result = await dispatch(
                rejectDocument({
                    id,
                    rejectionReason: trimmedReason,
                    providerName: docHint?.providerName,
                    documentName: docHint?.documentName,
                })
            ).unwrap();
            dispatch(fetchVerifyDocuments());
            await notifyProviderViaSms(
                result.providerId,
                trimmedReason
            );
            setRejectionReason('');
            return true;
        } catch (err) {
            console.error('Failed to reject document:', err);
            return false;
        } finally {
            setProcessingId(null);
        }
    };

    const handleApproveAll = async (providerId: string, providerName?: string) => {
        if (!canVerifyProviders) return;
        setProcessingProviderId(providerId);
        try {
            await dispatch(approveAllDocuments(providerId)).unwrap();
            dispatch(fetchVerifyDocuments());
            await notifyProviderViaSms(providerId, getApproveAllMessage(providerName));
        } catch (err) {
            console.error('Failed to approve all documents:', err);
        } finally {
            setProcessingProviderId(null);
        }
    };

    const handleReapproveAll = async (providerId: string, providerName?: string) => {
        if (!canVerifyProviders) return;
        setProcessingProviderId(providerId);
        try {
            await dispatch(reapproveAllRejectedDocuments(providerId)).unwrap();
            dispatch(fetchVerifyDocuments());
            await notifyProviderViaSms(providerId, getApproveAllMessage(providerName));
        } catch (err) {
            console.error('Failed to re-approve rejected documents:', err);
        } finally {
            setProcessingProviderId(null);
        }
    };

    const subCategoryOptions = useMemo(() => {
        const names = new Set<string>();
        documents.forEach((doc) => {
            names.add(doc.subCategoryName || 'Uncategorized');
        });
        return [...names].sort((a, b) => a.localeCompare(b));
    }, [documents]);

    useEffect(() => {
        if (subCategoryFilter !== 'all' && !subCategoryOptions.includes(subCategoryFilter)) {
            setSubCategoryFilter('all');
        }
    }, [subCategoryFilter, subCategoryOptions]);

    const filteredDocuments = useMemo(() => {
        let list = documents;
        if (statusFilter === 'pending') {
            list = list.filter((doc) => doc.isVerify === null);
        } else if (statusFilter === 'approved') {
            list = list.filter((doc) => doc.isVerify === true);
        } else if (statusFilter === 'rejected') {
            list = list.filter((doc) => doc.isVerify === false);
        }
        if (subCategoryFilter !== 'all') {
            list = list.filter((doc) => (doc.subCategoryName || 'Uncategorized') === subCategoryFilter);
        }
        const q = searchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter((doc) => {
                const blob = [
                    doc.providerName,
                    doc.providerEmail,
                    doc.documentName,
                    doc.subCategoryName,
                    doc.documentId,
                    doc.providerId,
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                return blob.includes(q);
            });
        }
        return list;
    }, [documents, statusFilter, subCategoryFilter, searchQuery]);

    const documentsByProvider = useMemo(() => {
        return filteredDocuments.reduce(
            (acc, doc) => {
                const key = doc.providerId || 'unknown';
                if (!acc[key]) {
                    acc[key] = {
                        providerId: doc.providerId,
                        providerName: doc.providerName || 'Unknown Provider',
                        providerEmail: doc.providerEmail,
                        documents: [] as typeof documents,
                    };
                }
                acc[key].documents.push(doc);
                return acc;
            },
            {} as Record<string, { providerId: string; providerName: string; providerEmail?: string; documents: typeof documents }>
        );
    }, [filteredDocuments]);

    const providerGroups = useMemo(() => Object.values(documentsByProvider), [documentsByProvider]);

    const hasActiveFilters =
        searchQuery.trim().length > 0 || statusFilter !== 'all' || subCategoryFilter !== 'all';

    const formatDate = (dateString?: string) => {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const pendingDocuments = filteredDocuments.filter((doc) => doc.isVerify === null);
    const verifiedDocuments = filteredDocuments.filter((doc) => doc.isVerify === true);
    const rejectedDocuments = filteredDocuments.filter((doc) => doc.isVerify === false);
    const totalDocuments = filteredDocuments.length;

    return (
        <AuthGuard>
            <div className="flex min-h-screen">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        <AdminPageHeader
                            title="Verify Documents"
                            breadcrumbs={[
                                { label: 'Dashboard', href: '/admin/dashboard' },
                                { label: 'Verify Documents' },
                            ]}
                            actions={
                                <button
                                    type="button"
                                    onClick={() => dispatch(fetchVerifyDocuments())}
                                    className={adminHeaderButtonClassName()}
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                    Refresh
                                </button>
                            }
                        />
                        {/* Minimal Statistics */}
                        <section className="mb-4 flex flex-wrap items-center gap-6 text-sm">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-amber-600" />
                                <span className="text-gray-700">
                                    <span className="font-semibold">{pendingDocuments.length}</span> Pending
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                <span className="text-gray-700">
                                    <span className="font-semibold">{verifiedDocuments.length}</span> Approved
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-red-600" />
                                <span className="text-gray-700">
                                    <span className="font-semibold">{rejectedDocuments.length}</span> Rejected
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-gray-600" />
                                <span className="text-gray-700">
                                    <span className="font-semibold">{totalDocuments}</span> Total
                                </span>
                            </div>
                            {hasActiveFilters ? (
                                <span className="text-xs text-gray-500 sm:ml-auto">
                                    Filtered · {documents.length} in database
                                </span>
                            ) : null}
                        </section>

                        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
                            <div className="relative w-full max-w-md flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search provider, email, document, category…"
                                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200/50"
                                />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(
                                    [
                                        { value: 'all' as const, label: 'All' },
                                        { value: 'pending' as const, label: 'Pending' },
                                        { value: 'approved' as const, label: 'Approved' },
                                        { value: 'rejected' as const, label: 'Rejected' },
                                    ] as const
                                ).map(({ value, label }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setStatusFilter(value)}
                                        className={cn(
                                            'inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors',
                                            statusFilter === value
                                                ? 'bg-primary text-primary-foreground'
                                                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex w-full min-w-50 max-w-xs flex-col gap-1 lg:w-auto">
                                <label htmlFor="verify-doc-subcat" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Category
                                </label>
                                <select
                                    id="verify-doc-subcat"
                                    value={subCategoryFilter}
                                    onChange={(e) => setSubCategoryFilter(e.target.value)}
                                    className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="all">All categories</option>
                                    {subCategoryOptions.map((name) => (
                                        <option key={name} value={name}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {hasActiveFilters ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setStatusFilter('all');
                                        setSubCategoryFilter('all');
                                    }}
                                    className="h-9 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/10 lg:ml-auto"
                                >
                                    Clear filters
                                </button>
                            ) : null}
                        </div>

                        {/* Documents Grid */}
                        {loading && (
                            <div className="mb-4 text-center py-12">
                                <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                                <p className="text-gray-600">Loading documents...</p>
                            </div>
                        )}

                        {error && (
                            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        {!loading && !error && (
                            <div className="space-y-6">
                                {providerGroups.length === 0 ? (
                                    <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 p-12 text-center">
                                        <FileCheck className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                        <p className="text-lg font-semibold text-gray-900 mb-2">
                                            {documents.length === 0 ? 'No documents found' : 'No matching documents'}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            {documents.length === 0
                                                ? 'When providers submit documents they will appear here.'
                                                : hasActiveFilters
                                                  ? 'Try changing or clearing filters.'
                                                  : 'All documents have been processed.'}
                                        </p>
                                    </div>
                                ) : (
                                    providerGroups.map((group) => {
                                        const pendingDocs = group.documents.filter(doc => doc.isVerify === null);
                                        const verifiedDocs = group.documents.filter(doc => doc.isVerify === true);
                                        const rejectedDocs = group.documents.filter(doc => doc.isVerify === false);
                                        const isProcessingAll = processingProviderId === group.providerId;

                                        return (
                                            <div
                                                key={group.providerId || 'unknown'}
                                                className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl overflow-hidden"
                                            >
                                                {/* Provider Header */}
                                                <div className="border-b border-border bg-muted/40 p-6">
                                                    <div className="flex items-center justify-between flex-wrap gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <User className="h-5 w-5 text-primary" />
                                                                {group.providerId ? (
                                                                    <Link 
                                                                        href={`/admin/providers/${group.providerId}`}
                                                                        className="text-xl font-bold text-gray-900 hover:text-primary transition-colors"
                                                                    >
                                                                        {group.providerName}
                                                                    </Link>
                                                                ) : (
                                                                    <span className="text-xl font-bold text-gray-900">{group.providerName}</span>
                                                                )}
                                                            </div>
                                                            {group.providerEmail && (
                                                                <div className="flex items-center gap-2 text-sm text-gray-600 ml-8">
                                                                    <Mail className="h-4 w-4 text-gray-400" />
                                                                    <span>{group.providerEmail}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-4 mt-3 ml-8 text-sm">
                                                                <span className="text-gray-600">
                                                                    <span className="font-semibold text-gray-900">{group.documents.length}</span> Total Documents
                                                                </span>
                                                                <span className="text-amber-600">
                                                                    <span className="font-semibold">{pendingDocs.length}</span> Pending
                                                                </span>
                                                                <span className="text-emerald-600">
                                                                    <span className="font-semibold">{verifiedDocs.length}</span> Approved
                                                                </span>
                                                                <span className="text-red-600">
                                                                    <span className="font-semibold">{rejectedDocs.length}</span> Rejected
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {canVerifyProviders && pendingDocs.length > 0 && (
                                                                <button
                                                                    onClick={() => handleApproveAll(group.providerId, group.providerName)}
                                                                    disabled={isProcessingAll}
                                                                    className="px-4 py-2 rounded-lg bg-linear-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                                                >
                                                                    {isProcessingAll ? 'Processing...' : `Approve All (${pendingDocs.length})`}
                                                                </button>
                                                            )}
                                                            {canVerifyProviders && rejectedDocs.length > 0 && (
                                                                <button
                                                                    onClick={() => handleReapproveAll(group.providerId, group.providerName)}
                                                                    disabled={isProcessingAll}
                                                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-emerald-300 bg-white text-emerald-700 text-sm font-semibold shadow-sm hover:bg-emerald-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                    <RotateCcw className="h-4 w-4" />
                                                                    {isProcessingAll ? 'Processing...' : `Re-approve Rejected (${rejectedDocs.length})`}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Documents grouped by subcategory */}
                                                <div className="p-4">
                                                    {Object.entries(
                                                        group.documents.reduce(
                                                            (acc, doc) => {
                                                                const key = doc.subCategoryName || 'Uncategorized';
                                                                if (!acc[key]) {
                                                                    acc[key] = [] as typeof group.documents;
                                                                }
                                                                acc[key].push(doc);
                                                                return acc;
                                                            },
                                                            {} as Record<string, typeof group.documents>
                                                        )
                                                    ).map(([subName, docsInSub]) => (
                                                        <div key={subName} className="mb-4 last:mb-0">
                                                            <div className="mb-2 flex items-center justify-between">
                                                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                                    {subName}
                                                                </span>
                                                                <span className="text-xs text-gray-400">
                                                                    {docsInSub.length} document{docsInSub.length === 1 ? '' : 's'}
                                                                </span>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {docsInSub.map((doc) => {
                                                                    const status = doc.isVerify;
                                                                    return (
                                                                        <div
                                                                            key={doc.id}
                                                                            onClick={() => openDocumentDetail(doc)}
                                                                            className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer transition-all group"
                                                                        >
                                                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                                <div
                                                                                    className={`shrink-0 w-2 h-2 rounded-full ${
                                                                                        status === true
                                                                                            ? 'bg-emerald-500'
                                                                                            : status === false
                                                                                                ? 'bg-red-500'
                                                                                                : 'bg-amber-500'
                                                                                    }`}
                                                                                />
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="font-medium text-gray-900 truncate">
                                                                                        {doc.documentName || 'Unknown Document'}
                                                                                    </div>
                                                                                    {doc.createdAt && (
                                                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                                                            {formatDate(doc.createdAt)}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 shrink-0">
                                                                                <span
                                                                                    className={`text-xs px-2 py-1 rounded ${
                                                                                        status === true
                                                                                            ? 'bg-emerald-100 text-emerald-700'
                                                                                            : status === false
                                                                                                ? 'bg-red-100 text-red-700'
                                                                                                : 'bg-amber-100 text-amber-700'
                                                                                    }`}
                                                                                >
                                                                                    {status === true
                                                                                        ? 'Approved'
                                                                                        : status === false
                                                                                            ? 'Rejected'
                                                                                            : 'Pending'}
                                                                                </span>
                                                                                <Eye className="h-4 w-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    {/* Document Detail Modal */}
                    {selectedDocument && (
                        <div 
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                            onClick={() => {
                                setSelectedDocument(null);
                                setSelectedImage(null);
                            }}
                        >
                            <div 
                                className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Modal Header */}
                                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">
                                            {selectedDocument.documentName || 'Document Details'}
                                        </h2>
                                        <p className="text-sm text-gray-500 mt-1">Document Information</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedDocument(null);
                                            setSelectedImage(null);
                                        }}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <XCircle className="h-5 w-5 text-gray-500" />
                                    </button>
                                </div>

                                {/* Modal Content */}
                                <div className="p-6 space-y-6">
                                    {/* Provider Info */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Provider</label>
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-gray-400" />
                                                {selectedDocument.providerId ? (
                                                    <Link 
                                                        href={`/admin/providers/${selectedDocument.providerId}`}
                                                        className="font-medium text-gray-900 hover:text-indigo-600 transition-colors"
                                                    >
                                                        {selectedDocument.providerName || 'Unknown Provider'}
                                                    </Link>
                                                ) : (
                                                    <span className="font-medium text-gray-900">{selectedDocument.providerName || 'Unknown Provider'}</span>
                                                )}
                                            </div>
                                        </div>
                                        {selectedDocument.providerEmail && (
                                            <div>
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Email</label>
                                                <div className="flex items-center gap-2">
                                                    <Mail className="h-4 w-4 text-gray-400" />
                                                    <span className="text-gray-900">{selectedDocument.providerEmail}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Document Info */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Document Name</label>
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-gray-400" />
                                                <span className="text-gray-900">{selectedDocument.documentName || 'Unknown Document'}</span>
                                            </div>
                                        </div>
                                        {selectedDocument.documentId && (
                                            <div>
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Document ID</label>
                                                <span className="text-gray-900 font-mono text-sm">{selectedDocument.documentId}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Status and Date */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Status</label>
                                            <span
                                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
                                                    selectedDocument.isVerify === true
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : selectedDocument.isVerify === false
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-amber-100 text-amber-700'
                                                }`}
                                            >
                                                {selectedDocument.isVerify === true ? (
                                                    <>
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        Approved
                                                    </>
                                                ) : selectedDocument.isVerify === false ? (
                                                    <>
                                                        <XCircle className="h-4 w-4" />
                                                        Rejected
                                                    </>
                                                ) : (
                                                    <>
                                                        <Clock className="h-4 w-4" />
                                                        Pending
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                        {selectedDocument.createdAt && (
                                            <div>
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Submitted Date</label>
                                                <span className="text-gray-900">{formatDate(selectedDocument.createdAt)}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Document Image */}
                                    {getDisplayImageUrl(selectedDocument.documentImage) && (
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Document Image</label>
                                            <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                                                <DocumentMediaPreview
                                                    src={getDisplayImageUrl(selectedDocument.documentImage)!}
                                                    alt={selectedDocument.documentName || 'Document'}
                                                    onOpen={() => setSelectedImage(getDisplayImageUrl(selectedDocument.documentImage))}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedImage(getDisplayImageUrl(selectedDocument.documentImage))}
                                                    className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg hover:bg-white transition-colors"
                                                >
                                                    <Eye className="h-5 w-5 text-gray-700" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* SMS / actions copy */}
                                    {(selectedDocument.isVerify === null || selectedDocument.isVerify === true) && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Phone className="h-4 w-4 text-gray-400" />
                                                <span className="font-medium text-gray-700">ስልክ:</span>
                                                <span className="text-gray-700">
                                                    {providerPhone === null
                                                        ? 'Loading...'
                                                        : providerPhone || 'ስልክ ቁጥር አልተገኘም'}
                                                </span>
                                            </div>
                                            {selectedDocument.isVerify === null && (
                                                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
                                                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                                                        <MessageSquare className="h-4 w-4" />
                                                        ሲጸድቅ የሚላከው SMS
                                                    </div>
                                                    <div className="rounded-md bg-white border border-emerald-100 px-3 py-2 text-sm text-gray-800">
                                                        {getApproveMessage(selectedDocument.providerName, selectedDocument.documentName)}
                                                    </div>
                                                </div>
                                            )}
                                            {selectedDocument.isVerify === true && (
                                                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                                                    This document is approved. You can still revoke it and reject — the provider will get the rejection SMS/push below.
                                                </p>
                                            )}
                                            <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 space-y-2">
                                                <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
                                                    <MessageSquare className="h-4 w-4" />
                                                    Rejection message (SMS)
                                                </div>
                                                <textarea
                                                    value={rejectionReason}
                                                    onChange={(e) => setRejectionReason(e.target.value)}
                                                    rows={5}
                                                    placeholder="Edit the full rejection SMS sent to the provider."
                                                    className="w-full rounded-md border border-red-100 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-200"
                                                />
                                                <p className="text-xs text-red-600/80">
                                                    Provider gets this text as SMS, and a push titled &quot;Document rejected&quot; with the same body.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {selectedDocument.isVerify === false && (
                                        <div className="space-y-3">
                                            <p className="text-sm text-gray-600">
                                                Re-approve if this was rejected by mistake or the provider submitted an updated document.
                                            </p>
                                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
                                                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                                                    <MessageSquare className="h-4 w-4" />
                                                    ሲጸድቅ እንደገና የሚላከው SMS
                                                </div>
                                                <div className="rounded-md bg-white border border-emerald-100 px-3 py-2 text-sm text-gray-800">
                                                    {getApproveMessage(selectedDocument.providerName, selectedDocument.documentName)}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    {canVerifyProviders && selectedDocument.isVerify === null && (
                                        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                                            <button
                                                onClick={() => {
                                                    handleVerify(selectedDocument.id, selectedDocument);
                                                    setSelectedDocument(null);
                                                }}
                                                disabled={processingId === selectedDocument.id}
                                                className="flex-1 px-4 py-2.5 rounded-lg bg-linear-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                            >
                                                {processingId === selectedDocument.id ? 'Processing...' : 'Approve Document'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    void handleReject(selectedDocument.id, selectedDocument).then((ok) => {
                                                        if (ok) setSelectedDocument(null);
                                                    });
                                                }}
                                                disabled={
                                                    processingId === selectedDocument.id ||
                                                    !rejectionReason.trim()
                                                }
                                                className="flex-1 px-4 py-2.5 rounded-lg bg-linear-to-r from-red-500 to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                            >
                                                Reject Document
                                            </button>
                                        </div>
                                    )}

                                    {canVerifyProviders && selectedDocument.isVerify === true && (
                                        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                                            <button
                                                onClick={() => {
                                                    void handleReject(selectedDocument.id, selectedDocument).then((ok) => {
                                                        if (ok) setSelectedDocument(null);
                                                    });
                                                }}
                                                disabled={
                                                    processingId === selectedDocument.id ||
                                                    !rejectionReason.trim()
                                                }
                                                className="flex-1 px-4 py-2.5 rounded-lg bg-linear-to-r from-red-500 to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                            >
                                                {processingId === selectedDocument.id
                                                    ? 'Processing...'
                                                    : 'Revoke approval & reject'}
                                            </button>
                                        </div>
                                    )}

                                    {canVerifyProviders && selectedDocument.isVerify === false && (
                                        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                                            <button
                                                onClick={() => {
                                                    handleVerify(selectedDocument.id, selectedDocument);
                                                    setSelectedDocument(null);
                                                }}
                                                disabled={processingId === selectedDocument.id}
                                                className="inline-flex flex-1 items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-linear-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                            >
                                                <RotateCcw className="h-4 w-4" />
                                                {processingId === selectedDocument.id ? 'Processing...' : 'Re-approve Document'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Image Fullscreen Modal */}
                    {selectedImage && (
                        <div 
                            className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                            onClick={() => setSelectedImage(null)}
                        >
                            <div className="relative max-w-6xl max-h-[95vh]">
                                <button
                                    onClick={() => setSelectedImage(null)}
                                    className="absolute -top-12 right-0 p-2 bg-white/10 backdrop-blur-md rounded-lg text-white hover:bg-white/20 transition-colors"
                                >
                                    <XCircle className="h-6 w-6" />
                                </button>
                                <StorageImage
                                    src={selectedImage}
                                    alt="Document Preview"
                                    width={1600}
                                    height={1200}
                                    className="max-w-full max-h-[95vh] rounded-xl shadow-2xl object-contain"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </AuthGuard>
    );
};

export default VerifyDocumentsPage;


