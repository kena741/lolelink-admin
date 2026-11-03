'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Landmark, Loader2, Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BankDetails {
    id: string;
    holderName?: string | null;
    accountNumber?: string | null;
    bankName?: string | null;
    swiftCode?: string | null;
    branchCity?: string | null;
    branchCountry?: string | null;
    method_code?: string | null;
    is_default?: boolean | null;
}

interface ChapaBankOption {
    id: string;
    slug: string;
    name: string;
    swift: string;
    acctLength?: number;
}

// Seeded from provider app bank_detail_screen_controller._defaultChapaBanks
const CHAPA_BANKS: ChapaBankOption[] = [
    { id: '130', slug: 'abay_bank', swift: 'ABAYETAA', name: 'Abay Bank', acctLength: 16 },
    { id: '772', slug: 'addis_int_bank', swift: 'ABSCETAA', name: 'Addis International Bank', acctLength: 15 },
    { id: '207', slug: 'ahadu_bank', swift: 'AHUUETAA', name: 'Ahadu Bank', acctLength: 10 },
    { id: '656', slug: 'awash_bank', swift: 'AWINETAA', name: 'Awash Bank', acctLength: 14 },
    { id: '347', slug: 'boa_bank', swift: 'ABYSETAA', name: 'Bank of Abyssinia', acctLength: 8 },
    { id: '571', slug: 'berhan_bank', swift: 'BERHETAA', name: 'Berhan Bank', acctLength: 13 },
    { id: '128', slug: 'cbebirr', swift: 'CBETETAA', name: 'CBEBirr', acctLength: 10 },
    { id: '946', slug: 'cbe_bank', swift: 'CBETETAA', name: 'Commercial Bank of Ethiopia (CBE)', acctLength: 13 },
    { id: '893', slug: 'ebirr', swift: 'CBORETA', name: 'Coopay-Ebirr', acctLength: 10 },
    { id: '880', slug: 'dashen_bank', swift: 'DASHETAA', name: 'Dashen Bank', acctLength: 13 },
    { id: '301', slug: 'global_bank', swift: 'DEGAETAA', name: 'Global Bank Ethiopia', acctLength: 13 },
    { id: '534', slug: 'hibret_bank', swift: 'UNTDETAA', name: 'Hibret Bank', acctLength: 16 },
    { id: '315', slug: 'anbesa_bank', swift: 'LIBSETAA', name: 'Lion International Bank', acctLength: 15 },
    { id: '266', slug: 'mpesa', swift: 'MPESA', name: 'M-Pesa', acctLength: 10 },
    { id: '979', slug: 'nib_bank', swift: 'NIBIETAA', name: 'Nib International Bank', acctLength: 15 },
    { id: '423', slug: 'oromia_bank', swift: 'ORIRETAA', name: 'Oromia International Bank', acctLength: 12 },
    { id: '855', slug: 'telebirr', swift: 'TELEBIRR', name: 'telebirr', acctLength: 10 },
    { id: '472', slug: 'wegagen_bank', swift: 'WEGAETAA', name: 'Wegagen Bank', acctLength: 13 },
    { id: '867', slug: 'yaya', swift: 'YAYAETAA', name: 'Yaya Wallet', acctLength: 12 },
    { id: '687', slug: 'zemen_bank', swift: 'ZEMEETAA', name: 'Zemen Bank', acctLength: 16 },
];

const MAX_LENGTH_SLUGS = new Set(['addis_int_bank', 'anbesa_bank', 'nib_bank']);

interface FormState {
    id: string;
    holderName: string;
    accountNumber: string;
    bankName: string;
    swiftCode: string;
    branchCity: string;
    branchCountry: string;
    method_code: string;
}

const EMPTY_FORM: FormState = {
    id: '',
    holderName: '',
    accountNumber: '',
    bankName: '',
    swiftCode: '',
    branchCity: '',
    branchCountry: '',
    method_code: '',
};

function toForm(details: BankDetails | null): FormState {
    if (!details) return { ...EMPTY_FORM };
    return {
        id: details.id || '',
        holderName: details.holderName || '',
        accountNumber: details.accountNumber || '',
        bankName: details.bankName || '',
        swiftCode: details.swiftCode || '',
        branchCity: details.branchCity || '',
        branchCountry: details.branchCountry || '',
        method_code: details.method_code || '',
    };
}

function matchBank(form: FormState): ChapaBankOption | null {
    const code = form.method_code.trim();
    if (/^\d+$/.test(code)) {
        const byId = CHAPA_BANKS.find((b) => b.id === code);
        if (byId) return byId;
    }
    const slug = code.toLowerCase().replace(/\s+/g, '_');
    const bySlug = CHAPA_BANKS.find((b) => b.slug === slug || b.name.toLowerCase() === form.bankName.toLowerCase());
    if (bySlug) return bySlug;
    const bySwift = CHAPA_BANKS.find(
        (b) => b.swift.toLowerCase() === form.swiftCode.toLowerCase()
    );
    return bySwift || null;
}

interface ProviderBankInfoProps {
    providerId: string;
    canEdit: boolean;
}

export function ProviderBankInfo({ providerId, canEdit }: ProviderBankInfoProps) {
    const [details, setDetails] = useState<BankDetails | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const selectedBank = useMemo(() => matchBank(form), [form]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/providers/${providerId}/bank-details`);
            const payload = (await res.json()) as { data?: BankDetails | null; error?: string };
            if (!res.ok) throw new Error(payload.error || 'Failed to load bank details');
            const next = payload.data ?? null;
            setDetails(next);
            setForm(toForm(next));
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load bank details');
            setDetails(null);
            setForm(EMPTY_FORM);
        } finally {
            setLoading(false);
        }
    }, [providerId]);

    useEffect(() => {
        void load();
    }, [load]);

    const startEdit = () => {
        setForm(toForm(details));
        setEditing(true);
        setMessage(null);
        setError(null);
    };

    const cancelEdit = () => {
        setForm(toForm(details));
        setEditing(false);
        setError(null);
    };

    const onSelectBank = (bankId: string) => {
        const bank = CHAPA_BANKS.find((b) => b.id === bankId);
        if (!bank) {
            setForm((prev) => ({ ...prev, method_code: '' }));
            return;
        }
        setForm((prev) => ({
            ...prev,
            method_code: bank.id,
            bankName: bank.name,
            swiftCode: bank.swift,
        }));
    };

    const validate = (): string | null => {
        if (!form.holderName.trim()) return 'Account holder name is required';
        const digits = form.accountNumber.replace(/\s+/g, '');
        if (!digits) return 'Account number is required';
        if (!/^\d+$/.test(digits)) return 'Account number must contain digits only';
        if (!form.bankName.trim()) return 'Bank name is required';
        if (!form.swiftCode.trim()) return 'SWIFT code is required';

        const bank = selectedBank;
        if (bank?.acctLength) {
            if (MAX_LENGTH_SLUGS.has(bank.slug)) {
                if (digits.length > bank.acctLength) {
                    return `Account number must not exceed ${bank.acctLength} digits`;
                }
            } else if (digits.length !== bank.acctLength) {
                return `Account number must be exactly ${bank.acctLength} digits for ${bank.name}`;
            }
        }
        return null;
    };

    const save = async () => {
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }
        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/providers/${providerId}/bank-details`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: form.id || undefined,
                    holderName: form.holderName.trim(),
                    accountNumber: form.accountNumber.replace(/\s+/g, ''),
                    bankName: form.bankName.trim(),
                    swiftCode: form.swiftCode.trim(),
                    branchCity: form.branchCity.trim(),
                    branchCountry: form.branchCountry.trim(),
                    method_code: form.method_code.trim() || undefined,
                }),
            });
            const payload = (await res.json()) as { error?: string; id?: string };
            if (!res.ok) throw new Error(payload.error || 'Failed to save bank details');
            setMessage('Bank details saved.');
            setEditing(false);
            await load();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to save bank details');
        } finally {
            setSaving(false);
        }
    };

    const display = editing ? form : toForm(details);
    const hasBank = Boolean(details?.accountNumber || details?.bankName);

    return (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-emerald-100 p-2">
                        <Landmark className="h-5 w-5 text-emerald-700" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Bank details</h2>
                        <p className="text-sm text-gray-500">Payout account used by the provider app</p>
                    </div>
                </div>
                {canEdit && !editing ? (
                    <Button type="button" variant="outline" size="sm" onClick={startEdit} disabled={loading}>
                        <Pencil className="h-4 w-4" />
                        {hasBank ? 'Edit' : 'Add'}
                    </Button>
                ) : null}
                {canEdit && editing ? (
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={cancelEdit} disabled={saving}>
                            <X className="h-4 w-4" />
                            Cancel
                        </Button>
                        <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save
                        </Button>
                    </div>
                ) : null}
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading bank details…
                </div>
            ) : null}

            {!loading && error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
            {!loading && message ? <p className="mb-3 text-sm text-emerald-700">{message}</p> : null}

            {!loading && !editing && !hasBank ? (
                <p className="text-sm text-gray-500">No bank details on file.</p>
            ) : null}

            {!loading && (editing || hasBank) ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {editing ? (
                        <div className="md:col-span-2 space-y-1.5">
                            <Label htmlFor="bank-select">Bank</Label>
                            <select
                                id="bank-select"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={selectedBank?.id || ''}
                                onChange={(e) => onSelectBank(e.target.value)}
                            >
                                <option value="">Select bank…</option>
                                {CHAPA_BANKS.map((bank) => (
                                    <option key={bank.id} value={bank.id}>
                                        {bank.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : null}

                    <Field
                        label="Account holder"
                        value={display.holderName}
                        editing={editing}
                        onChange={(v) => setForm((p) => ({ ...p, holderName: v }))}
                    />
                    <Field
                        label="Account number"
                        value={display.accountNumber}
                        editing={editing}
                        onChange={(v) => setForm((p) => ({ ...p, accountNumber: v.replace(/[^\d\s]/g, '') }))}
                        hint={
                            selectedBank?.acctLength
                                ? MAX_LENGTH_SLUGS.has(selectedBank.slug)
                                    ? `Up to ${selectedBank.acctLength} digits`
                                    : `Exactly ${selectedBank.acctLength} digits`
                                : undefined
                        }
                    />
                    <Field
                        label="Bank name"
                        value={display.bankName}
                        editing={editing}
                        onChange={(v) => setForm((p) => ({ ...p, bankName: v }))}
                        readOnly={Boolean(selectedBank)}
                    />
                    <Field
                        label="SWIFT"
                        value={display.swiftCode}
                        editing={editing}
                        onChange={(v) => setForm((p) => ({ ...p, swiftCode: v.toUpperCase() }))}
                        readOnly={Boolean(selectedBank)}
                    />
                    <Field
                        label="Branch city"
                        value={display.branchCity}
                        editing={editing}
                        onChange={(v) => setForm((p) => ({ ...p, branchCity: v }))}
                    />
                    <Field
                        label="Branch country"
                        value={display.branchCountry}
                        editing={editing}
                        onChange={(v) => setForm((p) => ({ ...p, branchCountry: v }))}
                    />
                </div>
            ) : null}
        </section>
    );
}

function Field({
    label,
    value,
    editing,
    onChange,
    readOnly,
    hint,
}: {
    label: string;
    value: string;
    editing: boolean;
    onChange: (value: string) => void;
    readOnly?: boolean;
    hint?: string;
}) {
    return (
        <div className="space-y-1.5">
            <Label>{label}</Label>
            {editing ? (
                <>
                    <Input value={value} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} />
                    {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
                </>
            ) : (
                <p className="text-sm font-medium text-gray-900">{value || '—'}</p>
            )}
        </div>
    );
}
