'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, ExternalLink, Loader2, Pencil } from 'lucide-react';
import { StorageImage } from '@/components/StorageImage';
import { formatAdminDateTimeUtc } from '@/lib/admin-datetime';
import { getDisplayImageUrl } from '@/lib/media-url';
import {
    companyVerificationTone,
    formatCompanyVerificationStatus,
    formatProviderType,
    type ProviderCompany,
    type ProviderCompanyVerification,
} from '@/lib/company-display';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ProviderCompanyProfileProps {
    providerId: string;
}

interface CompanyFormState {
    name: string;
    companyName: string;
    website: string;
    industry: string;
    companySize: string;
    headquarters: string;
    founded: string;
    profileBio: string;
    bannerImage: string;
    companyVerificationStatus: string;
    companyLicenseUrl: string;
    companyRejectionReason: string;
}

const VERIFICATION_OPTIONS = [
    'not_submitted',
    'pending',
    'approved',
    'rejected',
] as const;

function verificationBadgeClass(tone: ReturnType<typeof companyVerificationTone>): string {
    if (tone === 'success') return 'bg-emerald-100 text-emerald-700';
    if (tone === 'warning') return 'bg-amber-100 text-amber-700';
    if (tone === 'danger') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
}

function emptyForm(): CompanyFormState {
    return {
        name: '',
        companyName: '',
        website: '',
        industry: '',
        companySize: '',
        headquarters: '',
        founded: '',
        profileBio: '',
        bannerImage: '',
        companyVerificationStatus: 'not_submitted',
        companyLicenseUrl: '',
        companyRejectionReason: '',
    };
}

function formFromData(
    company: ProviderCompany | null,
    verification: ProviderCompanyVerification
): CompanyFormState {
    return {
        name: company?.name ?? '',
        companyName: company?.companyName ?? '',
        website: company?.website ?? '',
        industry: company?.industry ?? '',
        companySize: company?.companySize ?? '',
        headquarters: company?.headquarters ?? '',
        founded: company?.founded ?? '',
        profileBio: company?.profileBio ?? '',
        bannerImage: company?.bannerImage ?? '',
        companyVerificationStatus: verification.companyVerificationStatus ?? 'not_submitted',
        companyLicenseUrl: verification.companyLicenseUrl ?? '',
        companyRejectionReason: verification.companyRejectionReason ?? '',
    };
}

function DetailField({ label, value }: { label: string; value: string | null }) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-1 text-sm text-gray-900">{value?.trim() ? value : '—'}</p>
        </div>
    );
}

export function ProviderCompanyProfile({ providerId }: ProviderCompanyProfileProps) {
    const { canWriteProviders } = useAdminPermissions();
    const [company, setCompany] = useState<ProviderCompany | null>(null);
    const [verification, setVerification] = useState<ProviderCompanyVerification | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [form, setForm] = useState<CompanyFormState>(emptyForm);
    const [bannerPreviewFailed, setBannerPreviewFailed] = useState(false);
    const [licensePreviewFailed, setLicensePreviewFailed] = useState(false);

    const loadCompany = useCallback(async () => {
        if (!providerId) return;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/admin/providers/${providerId}/company`);
            const payload = (await response.json()) as {
                data?: {
                    company: ProviderCompany | null;
                    verification: ProviderCompanyVerification;
                };
                error?: string;
            };
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to load company profile');
            }
            setCompany(payload.data?.company ?? null);
            setVerification(payload.data?.verification ?? null);
        } catch (loadError: unknown) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load company profile');
            setCompany(null);
            setVerification(null);
        } finally {
            setLoading(false);
        }
    }, [providerId]);

    useEffect(() => {
        void loadCompany();
    }, [loadCompany]);

    const openEdit = () => {
        setForm(formFromData(company, verification ?? {
            providerType: null,
            companyVerificationStatus: null,
            companyLicenseUrl: null,
            companyRejectionReason: null,
        }));
        setSaveError(null);
        setEditOpen(true);
    };

    const onSave = async () => {
        if (!providerId) return;
        setSaveLoading(true);
        setSaveError(null);
        try {
            const response = await fetch(`/api/admin/providers/${providerId}/company`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name.trim() || form.companyName.trim() || 'Company',
                    companyName: form.companyName.trim() || null,
                    website: form.website.trim() || null,
                    industry: form.industry.trim() || null,
                    companySize: form.companySize.trim() || null,
                    headquarters: form.headquarters.trim() || null,
                    founded: form.founded.trim() || null,
                    profileBio: form.profileBio.trim() || null,
                    bannerImage: form.bannerImage.trim() || null,
                    companyVerificationStatus: form.companyVerificationStatus.trim() || null,
                    companyLicenseUrl: form.companyLicenseUrl.trim() || null,
                    companyRejectionReason: form.companyRejectionReason.trim() || null,
                }),
            });
            const payload = (await response.json()) as {
                data?: {
                    company: ProviderCompany | null;
                    verification: ProviderCompanyVerification;
                };
                error?: string;
            };
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to save company profile');
            }
            setCompany(payload.data?.company ?? null);
            setVerification(payload.data?.verification ?? null);
            setEditOpen(false);
        } catch (saveErr: unknown) {
            setSaveError(saveErr instanceof Error ? saveErr.message : 'Failed to save company profile');
        } finally {
            setSaveLoading(false);
        }
    };

    const bannerSrc = getDisplayImageUrl(company?.bannerImage);
    const licenseSrc = getDisplayImageUrl(verification?.companyLicenseUrl);
    const verificationTone = companyVerificationTone(
        verification?.companyVerificationStatus ?? null
    );

    useEffect(() => {
        setBannerPreviewFailed(false);
    }, [bannerSrc]);

    useEffect(() => {
        setLicensePreviewFailed(false);
    }, [licenseSrc]);

    if (loading) {
        return (
            <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">
                {error}
            </div>
        );
    }

    return (
        <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-semibold text-gray-900">Company</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Company profile linked to this provider account.
                    </p>
                </div>
                {canWriteProviders ? (
                    <Button type="button" onClick={openEdit}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {company ? 'Edit company' : 'Add company'}
                    </Button>
                ) : null}
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
                {bannerSrc && !bannerPreviewFailed ? (
                    <div className="relative h-40 w-full bg-gray-100">
                        <StorageImage
                            src={bannerSrc}
                            alt={company?.companyName || company?.name || 'Company banner'}
                            fill
                            className="object-cover"
                            onError={() => setBannerPreviewFailed(true)}
                        />
                    </div>
                ) : (
                    <div className="flex h-32 items-center justify-center bg-gray-50">
                        <Building2 className="h-10 w-10 text-gray-300" />
                    </div>
                )}

                <div className="space-y-6 p-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                            {formatProviderType(verification?.providerType ?? null)}
                        </span>
                        <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${verificationBadgeClass(verificationTone)}`}
                        >
                            {formatCompanyVerificationStatus(
                                verification?.companyVerificationStatus ?? null
                            )}
                        </span>
                    </div>

                    {!company ? (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center">
                            <Building2 className="mx-auto h-10 w-10 text-gray-300" />
                            <p className="mt-3 text-sm font-medium text-gray-900">No company profile yet</p>
                            <p className="mt-1 text-sm text-gray-600">
                                This provider has not created a company record.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">
                                    {company.companyName || company.name}
                                </h3>
                                {company.companyName && company.name !== company.companyName ? (
                                    <p className="mt-1 text-sm text-gray-600">Registered as {company.name}</p>
                                ) : null}
                            </div>

                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                <DetailField label="Industry" value={company.industry} />
                                <DetailField label="Company size" value={company.companySize} />
                                <DetailField label="Headquarters" value={company.headquarters} />
                                <DetailField label="Founded" value={company.founded} />
                                <DetailField label="Website" value={company.website} />
                                <DetailField
                                    label="Created"
                                    value={company.createdAt ? formatAdminDateTimeUtc(company.createdAt) : null}
                                />
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Profile bio
                                </p>
                                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-900">
                                    {company.profileBio?.trim() ? company.profileBio : '—'}
                                </p>
                            </div>
                        </>
                    )}

                    <div className="border-t border-gray-200 pt-6">
                        <h4 className="text-sm font-semibold text-gray-900">Verification</h4>
                        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    License document
                                </p>
                                {licenseSrc && !licensePreviewFailed ? (
                                    <div className="mt-2 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                                        <StorageImage
                                            src={licenseSrc}
                                            alt="Company license"
                                            width={800}
                                            height={448}
                                            className="h-56 w-full object-contain bg-white"
                                            onError={() => setLicensePreviewFailed(true)}
                                        />
                                    </div>
                                ) : (
                                    <div className="mt-2 flex h-56 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50">
                                        <div className="text-center">
                                            <Building2 className="mx-auto h-8 w-8 text-gray-300" />
                                            <p className="mt-2 text-sm font-medium text-gray-700">
                                                License preview unavailable
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                File not found or invalid image URL
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <DetailField
                                label="Rejection reason"
                                value={verification?.companyRejectionReason ?? null}
                            />
                        </div>
                        {licenseSrc ? (
                            <a
                                href={licenseSrc}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                            >
                                View license
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        ) : null}
                    </div>
                </div>
            </div>

            <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
                <DialogHeader>
                    <DialogTitle>{company ? 'Edit company' : 'Add company'}</DialogTitle>
                    <DialogDescription>
                        Update the company profile and verification details for this provider.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-2">
                    <div className="grid gap-2">
                        <Label htmlFor="company-name">Display name</Label>
                        <Input
                            id="company-name"
                            value={form.companyName}
                            onChange={(event) => setForm((prev) => ({
                                ...prev,
                                companyName: event.target.value,
                            }))}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="company-registered-name">Registered name</Label>
                        <Input
                            id="company-registered-name"
                            value={form.name}
                            onChange={(event) => setForm((prev) => ({
                                ...prev,
                                name: event.target.value,
                            }))}
                        />
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="company-industry">Industry</Label>
                            <Input
                                id="company-industry"
                                value={form.industry}
                                onChange={(event) => setForm((prev) => ({
                                    ...prev,
                                    industry: event.target.value,
                                }))}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="company-size">Company size</Label>
                            <Input
                                id="company-size"
                                value={form.companySize}
                                onChange={(event) => setForm((prev) => ({
                                    ...prev,
                                    companySize: event.target.value,
                                }))}
                            />
                        </div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="company-headquarters">Headquarters</Label>
                            <Input
                                id="company-headquarters"
                                value={form.headquarters}
                                onChange={(event) => setForm((prev) => ({
                                    ...prev,
                                    headquarters: event.target.value,
                                }))}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="company-founded">Founded</Label>
                            <Input
                                id="company-founded"
                                value={form.founded}
                                onChange={(event) => setForm((prev) => ({
                                    ...prev,
                                    founded: event.target.value,
                                }))}
                            />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="company-website">Website</Label>
                        <Input
                            id="company-website"
                            value={form.website}
                            onChange={(event) => setForm((prev) => ({
                                ...prev,
                                website: event.target.value,
                            }))}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="company-banner">Banner image URL</Label>
                        <Input
                            id="company-banner"
                            value={form.bannerImage}
                            onChange={(event) => setForm((prev) => ({
                                ...prev,
                                bannerImage: event.target.value,
                            }))}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="company-bio">Profile bio</Label>
                        <textarea
                            id="company-bio"
                            value={form.profileBio}
                            onChange={(event) => setForm((prev) => ({
                                ...prev,
                                profileBio: event.target.value,
                            }))}
                            rows={4}
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="company-verification-status">Verification status</Label>
                            <select
                                id="company-verification-status"
                                value={form.companyVerificationStatus}
                                onChange={(event) => setForm((prev) => ({
                                    ...prev,
                                    companyVerificationStatus: event.target.value,
                                }))}
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            >
                                {VERIFICATION_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                        {formatCompanyVerificationStatus(option)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="company-license-url">License URL</Label>
                            <Input
                                id="company-license-url"
                                value={form.companyLicenseUrl}
                                onChange={(event) => setForm((prev) => ({
                                    ...prev,
                                    companyLicenseUrl: event.target.value,
                                }))}
                            />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="company-rejection-reason">Rejection reason</Label>
                        <Input
                            id="company-rejection-reason"
                            value={form.companyRejectionReason}
                            onChange={(event) => setForm((prev) => ({
                                ...prev,
                                companyRejectionReason: event.target.value,
                            }))}
                        />
                    </div>
                    {saveError ? (
                        <p className="text-sm text-red-600">{saveError}</p>
                    ) : null}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={() => void onSave()} disabled={saveLoading}>
                        {saveLoading ? 'Saving…' : 'Save'}
                    </Button>
                </DialogFooter>
            </Dialog>
        </section>
    );
}
