'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { 
    FileCheck, 
    ArrowLeft, 
    RefreshCw, 
    CheckCircle2, 
    XCircle, 
    Clock,
    User,
    Mail,
    FileText,
    Eye
} from 'lucide-react';
import Link from 'next/link';
import { fetchVerifyDocuments, verifyDocument, rejectDocument, approveAllDocuments } from '@/features/verifyDocuments/verifyDocumentsSlice';

const VerifyDocumentsPage = () => {
    const dispatch = useAppDispatch();
    const { documents, loading, error } = useAppSelector((state) => state.verifyDocuments);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [processingProviderId, setProcessingProviderId] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [selectedDocument, setSelectedDocument] = useState<typeof documents[0] | null>(null);

    useEffect(() => {
        dispatch(fetchVerifyDocuments());
    }, [dispatch]);

    const handleVerify = async (id: string) => {
        setProcessingId(id);
        try {
            await dispatch(verifyDocument(id)).unwrap();
            dispatch(fetchVerifyDocuments());
        } catch (err) {
            console.error('Failed to verify document:', err);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id: string) => {
        setProcessingId(id);
        try {
            await dispatch(rejectDocument(id)).unwrap();
            dispatch(fetchVerifyDocuments());
        } catch (err) {
            console.error('Failed to reject document:', err);
        } finally {
            setProcessingId(null);
        }
    };

    const handleApproveAll = async (providerId: string) => {
        setProcessingProviderId(providerId);
        try {
            await dispatch(approveAllDocuments(providerId)).unwrap();
            dispatch(fetchVerifyDocuments());
        } catch (err) {
            console.error('Failed to approve all documents:', err);
        } finally {
            setProcessingProviderId(null);
        }
    };

    // Group documents by provider
    const documentsByProvider = documents.reduce((acc, doc) => {
        const key = doc.providerId || 'unknown';
        if (!acc[key]) {
            acc[key] = {
                providerId: doc.providerId,
                providerName: doc.providerName || 'Unknown Provider',
                providerEmail: doc.providerEmail,
                documents: [],
            };
        }
        acc[key].documents.push(doc);
        return acc;
    }, {} as Record<string, { providerId: string; providerName: string; providerEmail?: string; documents: typeof documents }>);

    const providerGroups = Object.values(documentsByProvider);

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

    const pendingDocuments = documents.filter(doc => !doc.isVerify);
    const verifiedDocuments = documents.filter(doc => doc.isVerify);
    const totalDocuments = documents.length;

    return (
        <AuthGuard>
            <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/30">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    {/* Futuristic Header */}
                    <div className="relative isolate overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 opacity-90" />
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20" />
                        <div className="absolute top-0 left-1/4 w-72 h-72 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
                        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/30 rounded-full blur-3xl animate-pulse delay-1000" />
                        
                        <div className="relative mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-8">
                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <Link 
                                            href="/admin/dashboard"
                                            className="p-2 bg-white/20 rounded-lg backdrop-blur-sm hover:bg-white/30 transition-colors"
                                        >
                                            <ArrowLeft className="h-5 w-5 text-white" />
                                        </Link>
                                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                            <FileCheck className="h-6 w-6 text-white" />
                                        </div>
                                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                                            Verify Documents
                                        </h1>
                                    </div>
                                    <div className="flex items-center gap-2 text-white/90 text-sm">
                                        <Link href="/admin/dashboard" className="hover:text-white transition-colors">
                                            Dashboard
                                        </Link>
                                        <span>/</span>
                                        <span className="text-white font-semibold">Verify Documents</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => dispatch(fetchVerifyDocuments())}
                                    className="group inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md px-4 py-3 text-sm font-semibold text-white ring-2 ring-white/20 hover:bg-white/20 hover:ring-white/40 transition-all duration-300 hover:scale-105"
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        {/* Minimal Statistics */}
                        <section className="mb-6 flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-amber-600" />
                                <span className="text-gray-700"><span className="font-semibold">{pendingDocuments.length}</span> Pending</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                <span className="text-gray-700"><span className="font-semibold">{verifiedDocuments.length}</span> Verified</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-gray-600" />
                                <span className="text-gray-700"><span className="font-semibold">{totalDocuments}</span> Total</span>
                            </div>
                        </section>

                        {/* Documents Grid */}
                        {loading && (
                            <div className="mb-4 text-center py-12">
                                <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
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
                                        <p className="text-lg font-semibold text-gray-900 mb-2">No documents found</p>
                                        <p className="text-sm text-gray-600">All documents have been processed</p>
                                    </div>
                                ) : (
                                    providerGroups.map((group) => {
                                        const pendingDocs = group.documents.filter(doc => !doc.isVerify);
                                        const verifiedDocs = group.documents.filter(doc => doc.isVerify);
                                        const isProcessingAll = processingProviderId === group.providerId;

                                        return (
                                            <div
                                                key={group.providerId || 'unknown'}
                                                className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl overflow-hidden"
                                            >
                                                {/* Provider Header */}
                                                <div className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border-b border-white/20 p-6">
                                                    <div className="flex items-center justify-between flex-wrap gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <User className="h-5 w-5 text-indigo-600" />
                                                                {group.providerId ? (
                                                                    <Link 
                                                                        href={`/admin/providers/${group.providerId}`}
                                                                        className="text-xl font-bold text-gray-900 hover:text-indigo-600 transition-colors"
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
                                                                    <span className="font-semibold">{verifiedDocs.length}</span> Verified
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {pendingDocs.length > 0 && (
                                                            <button
                                                                onClick={() => handleApproveAll(group.providerId)}
                                                                disabled={isProcessingAll}
                                                                className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                                            >
                                                                {isProcessingAll ? 'Processing...' : `Approve All (${pendingDocs.length})`}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Minimal Documents List */}
                                                <div className="p-4">
                                                    <div className="space-y-2">
                                                        {group.documents.map((doc) => {
                                                            const isVerified = doc.isVerify;
                                                            return (
                                                                <div
                                                                    key={doc.id}
                                                                    onClick={() => setSelectedDocument(doc)}
                                                                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer transition-all group"
                                                                >
                                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                        <div className={`flex-shrink-0 w-2 h-2 rounded-full ${
                                                                            isVerified ? 'bg-emerald-500' : 'bg-amber-500'
                                                                        }`} />
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
                                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                                        <span className={`text-xs px-2 py-1 rounded ${
                                                                            isVerified 
                                                                                ? 'bg-emerald-100 text-emerald-700' 
                                                                                : 'bg-amber-100 text-amber-700'
                                                                        }`}>
                                                                            {isVerified ? 'Verified' : 'Pending'}
                                                                        </span>
                                                                        <Eye className="h-4 w-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
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
                                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
                                                selectedDocument.isVerify 
                                                    ? 'bg-emerald-100 text-emerald-700' 
                                                    : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {selectedDocument.isVerify ? (
                                                    <>
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        Verified
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
                                    {selectedDocument.documentImage && (
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Document Image</label>
                                            <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                                                <div className="relative">
                                                    <img
                                                        src={selectedDocument.documentImage}
                                                        alt={selectedDocument.documentName || 'Document'}
                                                        className="w-full h-auto max-h-96 object-contain cursor-pointer"
                                                        onClick={() => setSelectedImage(selectedDocument.documentImage || null)}
                                                    />
                                                    <button
                                                        onClick={() => setSelectedImage(selectedDocument.documentImage || null)}
                                                        className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg hover:bg-white transition-colors"
                                                    >
                                                        <Eye className="h-5 w-5 text-gray-700" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    {!selectedDocument.isVerify && (
                                        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                                            <button
                                                onClick={() => {
                                                    handleVerify(selectedDocument.id);
                                                    setSelectedDocument(null);
                                                }}
                                                disabled={processingId === selectedDocument.id}
                                                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                            >
                                                {processingId === selectedDocument.id ? 'Processing...' : 'Approve Document'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    handleReject(selectedDocument.id);
                                                    setSelectedDocument(null);
                                                }}
                                                disabled={processingId === selectedDocument.id}
                                                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                            >
                                                Reject Document
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
                            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                            onClick={() => setSelectedImage(null)}
                        >
                            <div className="relative max-w-6xl max-h-[95vh]">
                                <button
                                    onClick={() => setSelectedImage(null)}
                                    className="absolute -top-12 right-0 p-2 bg-white/10 backdrop-blur-md rounded-lg text-white hover:bg-white/20 transition-colors"
                                >
                                    <XCircle className="h-6 w-6" />
                                </button>
                                <img
                                    src={selectedImage}
                                    alt="Document Preview"
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


