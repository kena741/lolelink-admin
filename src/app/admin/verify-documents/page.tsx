'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import { 
    FileCheck, 
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
    ChevronLeft,
    ChevronRight,
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
import { bumpNavActionCount } from '@/hooks/use-nav-action-counts';
import { markAdminListFetched, shouldRefetchAdminList } from '@/lib/admin-list-cache';

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
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
    const [subCategoryFilter, setSubCategoryFilter] = useState<string>('all');
    const phoneCacheRef = useRef<Record<string, string>>({});

    useEffect(() => {
        if (!shouldRefetchAdminList('verify-documents', { hasRows: documents.length > 0 })) return;
        void dispatch(fetchVerifyDocuments()).then((action) => {
            if (fetchVerifyDocuments.fulfilled.match(action)) markAdminListFetched('verify-documents');
        });
    }, [dispatch, documents.length]);

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
        const cached = phoneCacheRef.current[providerId];
        if (cached !== undefined) return cached;
        try {
            const { data } = await getSupabase()
                .from('provider')
                .select('phoneNumber, countryCode')
                .eq('id', providerId)
                .single();

            if (!data) {
                phoneCacheRef.current[providerId] = '';
                return '';
            }
            const row = data as { phoneNumber?: string | null; countryCode?: string | null };
            const phone = row.phoneNumber ?? '';
            const code = row.countryCode ?? '';
            const recipient = buildRecipient(phone, code);
            phoneCacheRef.current[providerId] = recipient;
            return recipient;
        } catch {
            phoneCacheRef.current[providerId] = '';
            return '';
        }
    }

    function notifyProviderViaSms(providerId: string, message: string) {
        void (async () => {
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
        })();
    }

    const reviewProviderId = selectedDocument?.providerId;
    const providerReviewDocs = useMemo(() => {
        if (!reviewProviderId) return [] as typeof documents;
        return documents.filter((doc) => doc.providerId === reviewProviderId);
    }, [documents, reviewProviderId]);

    const selectedDocIndex = useMemo(() => {
        if (!selectedDocument) return -1;
        return providerReviewDocs.findIndex((doc) => doc.id === selectedDocument.id);
    }, [providerReviewDocs, selectedDocument]);

    async function openDocumentDetail(doc: typeof documents[0], options?: { keepPhone?: boolean }) {
        setSelectedDocument(doc);
        setSelectedImage(null);
        setRejectionReason(getRejectMessage(doc.providerName));
        if (!options?.keepPhone) {
            setProviderPhone(null);
            const phone = await fetchProviderPhone(doc.providerId);
            setProviderPhone(phone);
        }
    }

    function goToProviderDoc(nextIndex: number) {
        const next = providerReviewDocs[nextIndex];
        if (!next) return;
        void openDocumentDetail(next, { keepPhone: true });
    }

    function advanceAfterAction(currentId: string) {
        const providerId = selectedDocument?.providerId;
        if (!providerId) {
            setSelectedDocument(null);
            return;
        }
        const list = documents.filter((doc) => doc.providerId === providerId);
        const idx = list.findIndex((doc) => doc.id === currentId);
        const afterPending = list
            .slice(idx + 1)
            .find((doc) => doc.id !== currentId && doc.isVerify === null);
        const beforePending = list
            .slice(0, Math.max(idx, 0))
            .find((doc) => doc.isVerify === null);
        const fallback = list.find((doc) => doc.id !== currentId);
        const next = afterPending ?? beforePending ?? fallback;
        if (next) void openDocumentDetail(next, { keepPhone: true });
        else setSelectedDocument(null);
    }

    useEffect(() => {
        if (!selectedDocument) return;
        const fresh = documents.find((doc) => doc.id === selectedDocument.id);
        if (fresh && fresh !== selectedDocument) setSelectedDocument(fresh);
    }, [documents, selectedDocument]);

    useEffect(() => {
        if (!selectedDocument || selectedDocIndex < 0) return;
        function onKeyDown(event: KeyboardEvent) {
            if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) {
                return;
            }
            if (event.key === 'ArrowLeft' && selectedDocIndex > 0) {
                event.preventDefault();
                goToProviderDoc(selectedDocIndex - 1);
            } else if (
                event.key === 'ArrowRight' &&
                selectedDocIndex < providerReviewDocs.length - 1
            ) {
                event.preventDefault();
                goToProviderDoc(selectedDocIndex + 1);
            }
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [selectedDocument, selectedDocIndex, providerReviewDocs]);

    const handleVerify = async (id: string, docHint?: (typeof documents)[0]) => {
        if (!canVerifyProviders) return;
        const prior =
            docHint?.isVerify ?? documents.find((doc) => doc.id === id)?.isVerify ?? null;
        const leftPending = prior === null;
        if (leftPending) bumpNavActionCount('/admin/verify-documents', -1);
        setProcessingId(id);
        try {
            const result = await dispatch(verifyDocument(id)).unwrap();
            notifyProviderViaSms(
                result.providerId,
                getApproveMessage(
                    docHint?.providerName ?? result.providerName,
                    docHint?.documentName ?? result.documentName
                )
            );
            advanceAfterAction(id);
        } catch (err) {
            if (leftPending) bumpNavActionCount('/admin/verify-documents', 1);
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

        const prior =
            docHint?.isVerify ?? documents.find((doc) => doc.id === id)?.isVerify ?? null;
        const leftPending = prior === null;
        if (leftPending) bumpNavActionCount('/admin/verify-documents', -1);
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
            notifyProviderViaSms(result.providerId, trimmedReason);
            setRejectionReason('');
            advanceAfterAction(id);
            return true;
        } catch (err) {
            if (leftPending) bumpNavActionCount('/admin/verify-documents', 1);
            console.error('Failed to reject document:', err);
            return false;
        } finally {
            setProcessingId(null);
        }
    };

    const handleApproveAll = async (providerId: string, providerName?: string) => {
        if (!canVerifyProviders) return;
        const pendingCount = documents.filter(
            (doc) => doc.providerId === providerId && doc.isVerify === null
        ).length;
        if (pendingCount > 0) bumpNavActionCount('/admin/verify-documents', -pendingCount);
        setProcessingProviderId(providerId);
        try {
            await dispatch(approveAllDocuments(providerId)).unwrap();
            notifyProviderViaSms(providerId, getApproveAllMessage(providerName));
        } catch (err) {
            if (pendingCount > 0) bumpNavActionCount('/admin/verify-documents', pendingCount);
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
            notifyProviderViaSms(providerId, getApproveAllMessage(providerName));
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
        searchQuery.trim().length > 0 || statusFilter !== 'pending' || subCategoryFilter !== 'all';

    useEffect(() => {
        if (selectedDocIndex < 0) return;
        const next = providerReviewDocs[selectedDocIndex + 1];
        const url = next ? getDisplayImageUrl(next.documentImage) : null;
        if (!url || typeof window === 'undefined') return;
        const img = new window.Image();
        img.src = url;
    }, [selectedDocIndex, providerReviewDocs]);

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
        <>
            
                
                    <div className="mx-auto min-w-0 w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
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
                                        setStatusFilter('pending');
                                        setSubCategoryFilter('all');
                                    }}
                                    className="h-9 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/10 lg:ml-auto"
                                >
                                    Clear filters
                                </button>
                            ) : null}
                        </div>

                        {/* Documents Grid */}
                        {loading && documents.length === 0 && (
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

                        {!(loading && documents.length === 0) && !error && (
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
                                                className="overflow-hidden rounded-xl border border-border bg-background shadow-sm"
                                            >
                                                {/* Provider Header */}
                                                <div className="border-b border-border bg-muted/30 p-4 sm:p-5">
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
                                                            {pendingDocs.length > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void openDocumentDetail(pendingDocs[0])}
                                                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors duration-150"
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                    Review ({pendingDocs.length})
                                                                </button>
                                                            )}
                                                            {canVerifyProviders && pendingDocs.length > 0 && (
                                                                <button
                                                                    onClick={() => handleApproveAll(group.providerId, group.providerName)}
                                                                    disabled={isProcessingAll}
                                                                    className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                    {isProcessingAll ? 'Processing...' : `Approve all (${pendingDocs.length})`}
                                                                </button>
                                                            )}
                                                            {canVerifyProviders && rejectedDocs.length > 0 && (
                                                                <button
                                                                    onClick={() => handleReapproveAll(group.providerId, group.providerName)}
                                                                    disabled={isProcessingAll}
                                                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                    <RotateCcw className="h-4 w-4" />
                                                                    {isProcessingAll ? 'Processing...' : `Re-approve (${rejectedDocs.length})`}
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
                                                                            className="group flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 transition-colors duration-150 hover:bg-muted/50"
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
                                className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="shrink-0 border-b border-border bg-white px-4 py-3 sm:px-5 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="text-lg font-bold text-foreground truncate">
                                                    {selectedDocument.documentName || 'Document'}
                                                </h2>
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                                                        selectedDocument.isVerify === true
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : selectedDocument.isVerify === false
                                                                ? 'bg-red-100 text-red-800'
                                                                : 'bg-amber-100 text-amber-800'
                                                    )}
                                                >
                                                    {selectedDocument.isVerify === true
                                                        ? 'Approved'
                                                        : selectedDocument.isVerify === false
                                                            ? 'Rejected'
                                                            : 'Pending'}
                                                </span>
                                            </div>
                                            <p className="mt-0.5 truncate text-sm text-muted-foreground">
                                                {selectedDocument.providerId ? (
                                                    <Link
                                                        href={`/admin/providers/${selectedDocument.providerId}`}
                                                        className="font-medium text-foreground hover:text-primary"
                                                    >
                                                        {selectedDocument.providerName || 'Provider'}
                                                    </Link>
                                                ) : (
                                                    selectedDocument.providerName || 'Provider'
                                                )}
                                                {' · '}
                                                {selectedDocIndex + 1}/{providerReviewDocs.length}
                                                {selectedDocument.createdAt
                                                    ? ` · ${formatDate(selectedDocument.createdAt)}`
                                                    : ''}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedDocument(null);
                                                setSelectedImage(null);
                                            }}
                                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                                            aria-label="Close"
                                        >
                                            <XCircle className="h-5 w-5 text-muted-foreground" />
                                        </button>
                                    </div>
                                    {providerReviewDocs.length > 1 && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => goToProviderDoc(selectedDocIndex - 1)}
                                                disabled={selectedDocIndex <= 0}
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                                                aria-label="Previous document"
                                            >
                                                <ChevronLeft className="h-5 w-5" />
                                            </button>
                                            <div className="flex flex-1 items-center justify-center gap-1.5 overflow-x-auto py-1">
                                                {providerReviewDocs.map((doc, index) => (
                                                    <button
                                                        key={doc.id}
                                                        type="button"
                                                        onClick={() => goToProviderDoc(index)}
                                                        title={doc.documentName || `Document ${index + 1}`}
                                                        aria-label={`Go to ${doc.documentName || `document ${index + 1}`}`}
                                                        className={cn(
                                                            'h-2.5 rounded-full transition-all duration-150',
                                                            index === selectedDocIndex
                                                                ? 'w-6 bg-primary'
                                                                : doc.isVerify === true
                                                                    ? 'w-2.5 bg-emerald-400 hover:bg-emerald-500'
                                                                    : doc.isVerify === false
                                                                        ? 'w-2.5 bg-red-400 hover:bg-red-500'
                                                                        : 'w-2.5 bg-amber-400 hover:bg-amber-500'
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => goToProviderDoc(selectedDocIndex + 1)}
                                                disabled={selectedDocIndex >= providerReviewDocs.length - 1}
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                                                aria-label="Next document"
                                            >
                                                <ChevronRight className="h-5 w-5" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="min-h-0 flex-1 overflow-y-auto">
                                    <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
                                        <div className="bg-muted/30 p-4 sm:p-5">
                                            {getDisplayImageUrl(selectedDocument.documentImage) ? (
                                                <div className="relative overflow-hidden rounded-lg border border-border bg-background">
                                                    <DocumentMediaPreview
                                                        src={getDisplayImageUrl(selectedDocument.documentImage)!}
                                                        alt={selectedDocument.documentName || 'Document'}
                                                        imgClassName="max-h-[min(58vh,560px)]"
                                                        onOpen={() => setSelectedImage(getDisplayImageUrl(selectedDocument.documentImage))}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedImage(getDisplayImageUrl(selectedDocument.documentImage))}
                                                        className="absolute top-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background/95 shadow-sm hover:bg-muted transition-colors"
                                                        aria-label="Open fullscreen"
                                                    >
                                                        <Eye className="h-5 w-5 text-foreground" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-border bg-background px-4 text-sm text-muted-foreground">
                                                    No document preview available
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-4 border-t border-border p-4 sm:p-5 lg:border-t-0 lg:border-l">
                                            <div className="space-y-2 text-sm">
                                                {selectedDocument.providerEmail && (
                                                    <div className="flex items-start gap-2 text-muted-foreground">
                                                        <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                                                        <span className="break-all text-foreground">{selectedDocument.providerEmail}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-start gap-2 text-muted-foreground">
                                                    <Phone className="mt-0.5 h-4 w-4 shrink-0" />
                                                    <span className="text-foreground">
                                                        {providerPhone === null
                                                            ? 'Loading phone…'
                                                            : providerPhone || 'No phone on file'}
                                                    </span>
                                                </div>
                                            </div>

                                            {selectedDocument.isVerify === true && (
                                                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                                    Approved. You can still revoke and reject — provider gets the rejection SMS below.
                                                </p>
                                            )}

                                            {selectedDocument.isVerify === false && (
                                                <p className="text-sm text-muted-foreground">
                                                    Re-approve if this was rejected by mistake or the provider re-submitted.
                                                </p>
                                            )}

                                            {(selectedDocument.isVerify === null || selectedDocument.isVerify === false) && (
                                                <details className="rounded-lg border border-border bg-muted/20">
                                                    <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-foreground marker:content-none flex items-center gap-2">
                                                        <MessageSquare className="h-4 w-4 text-emerald-700" />
                                                        Approve SMS preview
                                                    </summary>
                                                    <div className="border-t border-border px-3 py-2 text-sm text-foreground">
                                                        {getApproveMessage(selectedDocument.providerName, selectedDocument.documentName)}
                                                    </div>
                                                </details>
                                            )}

                                            {(selectedDocument.isVerify === null || selectedDocument.isVerify === true) && (
                                                <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/40 p-3">
                                                    <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
                                                        <MessageSquare className="h-4 w-4" />
                                                        Rejection SMS
                                                    </div>
                                                    <textarea
                                                        value={rejectionReason}
                                                        onChange={(e) => setRejectionReason(e.target.value)}
                                                        rows={4}
                                                        placeholder="Edit rejection SMS sent to the provider."
                                                        className="w-full rounded-md border border-red-100 bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-red-200"
                                                    />
                                                    <p className="text-xs text-red-700/80">
                                                        Sent as SMS + push titled &quot;Document rejected&quot;.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {canVerifyProviders && (
                                    <div className="shrink-0 border-t border-border bg-white px-4 py-3 sm:px-5">
                                        {selectedDocument.isVerify === null && (
                                            <div className="flex flex-col-reverse gap-2 sm:flex-row">
                                                <button
                                                    type="button"
                                                    onClick={() => void handleReject(selectedDocument.id, selectedDocument)}
                                                    disabled={
                                                        processingId === selectedDocument.id ||
                                                        !rejectionReason.trim()
                                                    }
                                                    className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleVerify(selectedDocument.id, selectedDocument)}
                                                    disabled={processingId === selectedDocument.id}
                                                    className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {processingId === selectedDocument.id ? 'Saving…' : 'Approve'}
                                                </button>
                                            </div>
                                        )}
                                        {selectedDocument.isVerify === true && (
                                            <button
                                                type="button"
                                                onClick={() => void handleReject(selectedDocument.id, selectedDocument)}
                                                disabled={
                                                    processingId === selectedDocument.id ||
                                                    !rejectionReason.trim()
                                                }
                                                className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {processingId === selectedDocument.id
                                                    ? 'Saving…'
                                                    : 'Revoke approval & reject'}
                                            </button>
                                        )}
                                        {selectedDocument.isVerify === false && (
                                            <button
                                                type="button"
                                                onClick={() => void handleVerify(selectedDocument.id, selectedDocument)}
                                                disabled={processingId === selectedDocument.id}
                                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <RotateCcw className="h-4 w-4" />
                                                {processingId === selectedDocument.id ? 'Saving…' : 'Re-approve'}
                                            </button>
                                        )}
                                    </div>
                                )}
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
                
            
        </>
    );
};

export default VerifyDocumentsPage;

