'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import {
    RefreshCw,
    Save,
    Smartphone,
    Globe,
    Languages,
    Shield,
    Eye,
    EyeOff,
    Mail,
    PercentCircle,
    ListOrdered,
    Coins,
    Plus,
    Trash2,
    CreditCard,
    Receipt,
} from 'lucide-react';
import Link from 'next/link';
import {
    fetchSettings,
    updateSettings,
    AppSettings,
    GeneralSettings,
    PolicySettings,
    ContactUsSettings,
    AdminCommissionSettings,
    BookingStatusOption,
    ConstantSettings,
    LanguageSettings,
} from '@/features/settings/settingsSlice';
import { DEFAULT_CONTACT_US } from '@/features/settings/contactDefaults';
import HTMLEditor from '@/components/RichTextEditor';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { CountryTaxSettingsPanel } from '@/app/admin/settings/CountryTaxSettingsPanel';
import { DEFAULT_SERVICE_POSTING_TIERS } from '@/lib/service-posting-tiers';

type TabType = 'app' | 'general' | 'policy' | 'contact' | 'commission' | 'status' | 'constants' | 'language' | 'country_tax';

const SettingsPage = () => {
    const dispatch = useAppDispatch();
    const { canWriteSettings } = useAdminPermissions();
    const { settings, loading, error } = useAppSelector((state) => state.settings);
    const [activeTab, setActiveTab] = useState<TabType>('app');
    const [saving, setSaving] = useState(false);
    
    // Form states
    const [appSettings, setAppSettings] = useState<AppSettings>({});
    const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({});
    const [policySettings, setPolicySettings] = useState<PolicySettings>({});
    const [contactUs, setContactUs] = useState<ContactUsSettings>(DEFAULT_CONTACT_US);
    const [adminCommission, setAdminCommission] = useState<AdminCommissionSettings>({});
    const [statusOptions, setStatusOptions] = useState<BookingStatusOption[]>([]);
    const [constants, setConstants] = useState<ConstantSettings>({});
    const [languageSettings, setLanguageSettings] = useState<LanguageSettings>([]);
    const [languageDeletedIds, setLanguageDeletedIds] = useState<string[]>([]);
    const [showGoogleMapKey, setShowGoogleMapKey] = useState(false);
    useEffect(() => {
        dispatch(fetchSettings()).catch((err) => {
            console.warn('Settings fetch error (this is OK if table doesn\'t exist yet):', err);
        });
    }, [dispatch]);

    useEffect(() => {
        if (settings) {
            setAppSettings(settings.appSettings || {});
            setGeneralSettings(settings.generalSettings || {});
            setPolicySettings(settings.policySettings || {});
            setContactUs({
                ...DEFAULT_CONTACT_US,
                ...(settings.contactUs || {}),
            });
            setAdminCommission(settings.adminCommission || {});
            setStatusOptions(
                settings.statusOptions && settings.statusOptions.length > 0
                    ? settings.statusOptions.map((s) => ({ ...s }))
                    : [{ flag: '', name: '' }]
            );
            setConstants({
                ...(settings.constants || {}),
                service_posting_tiers:
                    settings.constants?.service_posting_tiers?.length
                        ? settings.constants.service_posting_tiers.map((tier) => ({ ...tier }))
                        : DEFAULT_SERVICE_POSTING_TIERS.map((tier) => ({ ...tier })),
            });
            setLanguageSettings(settings.languageSettings || []);
            setLanguageDeletedIds([]);
        }
    }, [settings]);

    function updateServicePostingTier(index: number, field: 'total_price' | 'max_services', value: string) {
        const parsed = value.trim() === '' ? 0 : Number(value);
        setConstants((prev) => {
            const tiers = [...(prev.service_posting_tiers ?? DEFAULT_SERVICE_POSTING_TIERS)];
            const current = tiers[index] ?? { total_price: 0, max_services: 0 };
            tiers[index] = {
                ...current,
                [field]: Number.isFinite(parsed) ? parsed : current[field],
            };
            return { ...prev, service_posting_tiers: tiers };
        });
    }

    function addServicePostingTier() {
        setConstants((prev) => ({
            ...prev,
            service_posting_tiers: [
                ...(prev.service_posting_tiers ?? DEFAULT_SERVICE_POSTING_TIERS),
                { total_price: 0, max_services: 0 },
            ],
        }));
    }

    function removeServicePostingTier(index: number) {
        setConstants((prev) => {
            const tiers = [...(prev.service_posting_tiers ?? DEFAULT_SERVICE_POSTING_TIERS)];
            if (tiers.length <= 1) return prev;
            return { ...prev, service_posting_tiers: tiers.filter((_, i) => i !== index) };
        });
    }

    const handleSave = async () => {
        setSaving(true);
        try {
            const statusesForSave = statusOptions.filter((s) => s.flag.trim().length > 0);
            const payload: Parameters<typeof updateSettings>[0] = {
                appSettings,
                generalSettings,
                policySettings,
                contactUs,
                adminCommission,
                constants,
                languageSettings,
            };
            if (languageDeletedIds.length > 0)
                payload.languageDeletedIds = languageDeletedIds;
            if (statusesForSave.length > 0)
                payload.statusOptions = statusesForSave;
            await dispatch(updateSettings(payload)).unwrap();
        } catch (err) {
            console.error('Failed to save settings:', err);
        } finally {
            setSaving(false);
        }
    };

    const sections: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
        { id: 'app', label: 'App', icon: Smartphone },
        { id: 'general', label: 'General', icon: Globe },
        { id: 'policy', label: 'Policies', icon: Shield },
        { id: 'contact', label: 'Contact', icon: Mail },
        { id: 'commission', label: 'Commission', icon: PercentCircle },
        { id: 'status', label: 'Statuses', icon: ListOrdered },
        { id: 'constants', label: 'Constants', icon: Coins },
        { id: 'country_tax', label: 'Country tax', icon: Receipt },
        { id: 'language', label: 'Language', icon: Languages },
    ];

    function updateStatusRow(index: number, field: keyof BookingStatusOption, value: string) {
        setStatusOptions((prev) =>
            prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
        );
    }

    function addStatusRow() {
        setStatusOptions((prev) => [...prev, { flag: '', name: '' }]);
    }

    function removeStatusRow(index: number) {
        setStatusOptions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
    }

    function updateLanguageRow(index: number, field: 'name' | 'code' | 'active', value: string | boolean) {
        setLanguageSettings((prev) =>
            prev.map((language, languageIndex) =>
                languageIndex === index
                    ? {
                        ...language,
                        [field]: value,
                    }
                    : language
            )
        );
    }

    function addLanguageRow() {
        setLanguageSettings((prev) => [
            ...prev,
            {
                code: '',
                name: '',
                active: false,
            },
        ]);
    }

    function removeLanguageRow(index: number) {
        setLanguageSettings((prev) => {
            const languageToDelete = prev[index];
            if (languageToDelete?.id)
                setLanguageDeletedIds((ids) => [...ids, languageToDelete.id as string]);
            if (prev.length <= 1)
                return prev;
            return prev.filter((_, languageIndex) => languageIndex !== index);
        });
    }

    return (
        <AuthGuard>
            <div className="flex min-h-screen">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    <div className="mx-auto max-w-275 px-6 py-8 lg:px-8">
                        <AdminPageHeader
                            title="Settings"
                            breadcrumbs={[
                                { label: 'Dashboard', href: '/admin/dashboard' },
                                { label: 'Settings' },
                            ]}
                            actions={
                                <>
                                    <button
                                        type="button"
                                        onClick={() => dispatch(fetchSettings())}
                                        className={adminHeaderButtonClassName()}
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </button>
                                    {canWriteSettings && (
                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        disabled={saving || loading}
                                        className={adminHeaderButtonClassName()}
                                    >
                                        <Save className="h-4 w-4" />
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    )}
                                </>
                            }
                        />
                        <div className="overflow-hidden rounded-2xl border border-white/30 bg-white/95 shadow-lg shadow-gray-200/40 backdrop-blur-sm">
                            <div className="flex flex-col gap-1 border-b border-gray-200/90 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
                                <nav
                                    className="-mb-px flex min-h-13 gap-1 overflow-x-auto px-2 sm:px-4 scrollbar-none [&::-webkit-scrollbar]:hidden"
                                    aria-label="Settings sections"
                                >
                                    {sections.map((s) => {
                                        const Icon = s.icon;
                                        const isActive = activeTab === s.id;
                                        return (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => setActiveTab(s.id)}
                                                className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                                                    isActive
                                                        ? 'border-indigo-600 text-indigo-700'
                                                        : 'border-transparent text-gray-500 hover:text-gray-800'
                                                }`}
                                            >
                                                <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                                                {s.label}
                                            </button>
                                        );
                                    })}
                                </nav>
                                <div className="flex shrink-0 items-center border-t border-gray-100 px-3 py-2 sm:border-t-0 sm:border-l sm:border-gray-100 sm:px-4">
                                    <Link
                                        href="/admin/finance/payment-settings"
                                        className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-md"
                                    >
                                        <CreditCard className="h-4 w-4 shrink-0" aria-hidden />
                                        Payment gateways
                                    </Link>
                                </div>
                            </div>

                            <div className="p-6 md:p-8">
                                {error && !error.toLowerCase().includes('406') && (
                                    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                                        <p className="mb-1 font-semibold">Settings note</p>
                                        <p className="text-amber-700">
                                            The settings table may not exist yet. You can still edit below and save.
                                        </p>
                                    </div>
                                )}

                        {/* App Settings Tab */}
                        {activeTab === 'app' && (
                            <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl p-6">
                                <h2 className="text-xl font-bold text-gray-900 mb-6">App Settings</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">App Name</label>
                                        <input
                                            type="text"
                                            value={appSettings.appName || ''}
                                            onChange={(e) => setAppSettings({ ...appSettings, appName: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">App Version</label>
                                        <input
                                            type="text"
                                            value={appSettings.appVersion || ''}
                                            onChange={(e) => setAppSettings({ ...appSettings, appVersion: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">App Color</label>
                                        <input
                                            type="text"
                                            value={appSettings.appColor || ''}
                                            onChange={(e) => setAppSettings({ ...appSettings, appColor: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Google Map Key</label>
                                        <div className="relative">
                                            <input
                                                type={showGoogleMapKey ? "text" : "password"}
                                                value={appSettings.googleMapKey || ''}
                                                onChange={(e) => setAppSettings({ ...appSettings, googleMapKey: e.target.value })}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pr-10 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowGoogleMapKey(!showGoogleMapKey)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                {showGoogleMapKey ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    {/*
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Amount Deposit</label>
                                        <input
                                            type="text"
                                            value={appSettings.minimum_amount_deposit || ''}
                                            onChange={(e) => setAppSettings({ ...appSettings, minimum_amount_deposit: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Amount Withdraw</label>
                                        <input
                                            type="text"
                                            value={appSettings.minimum_amount_withdraw || ''}
                                            onChange={(e) => setAppSettings({ ...appSettings, minimum_amount_withdraw: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    */}
                                    <div>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={appSettings.extraCharge_GST || false}
                                                onChange={(e) => setAppSettings({ ...appSettings, extraCharge_GST: e.target.checked })}
                                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">Extra Charge GST</span>
                                        </label>
                                    </div>
                                    <div className="md:col-span-2">
                                        <HTMLEditor
                                            label="About app — Zemen Service"
                                            value={policySettings.aboutAppZemenService || ''}
                                            onChange={(html) =>
                                                setPolicySettings({
                                                    ...policySettings,
                                                    aboutAppZemenService: html,
                                                })
                                            }
                                            placeholder="Enter HTML for the Zemen Service about screen..."
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <HTMLEditor
                                            label="About app — Zemen Provider"
                                            value={policySettings.aboutAppZemenProvider || ''}
                                            onChange={(html) =>
                                                setPolicySettings({
                                                    ...policySettings,
                                                    aboutAppZemenProvider: html,
                                                })
                                            }
                                            placeholder="Enter HTML for the Zemen Provider about screen..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* General Settings Tab */}
                        {activeTab === 'general' && (
                            <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl p-6">
                                <h2 className="text-xl font-bold text-gray-900 mb-6">General Settings</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                                        <input
                                            type="text"
                                            value={generalSettings.phoneNumber || ''}
                                            onChange={(e) => setGeneralSettings({ ...generalSettings, phoneNumber: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Support Email</label>
                                        <input
                                            type="email"
                                            value={generalSettings.supportEmail || ''}
                                            onChange={(e) => setGeneralSettings({ ...generalSettings, supportEmail: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Support URL</label>
                                        <input
                                            type="url"
                                            value={generalSettings.supportURL || ''}
                                            onChange={(e) => setGeneralSettings({ ...generalSettings, supportURL: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Radius</label>
                                        <input
                                            type="text"
                                            value={generalSettings.radius || ''}
                                            onChange={(e) => setGeneralSettings({ ...generalSettings, radius: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Referral Amount</label>
                                        <input
                                            type="text"
                                            value={generalSettings.referralAmount || ''}
                                            onChange={(e) => setGeneralSettings({ ...generalSettings, referralAmount: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Notification Server Key</label>
                                        <input
                                            type="text"
                                            value={generalSettings.notification_server_key || ''}
                                            onChange={(e) => setGeneralSettings({ ...generalSettings, notification_server_key: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Policy Settings Tab */}
                        {activeTab === 'policy' && (
                            <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <Shield className="h-6 w-6 text-indigo-600" />
                                    <h2 className="text-xl font-bold text-gray-900">Policy Settings</h2>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <HTMLEditor
                                            label="Privacy Policy"
                                            value={policySettings.privacyPolicy || ''}
                                            onChange={(html) => setPolicySettings({ ...policySettings, privacyPolicy: html })}
                                            placeholder="Enter HTML code for privacy policy..."
                                        />
                                    </div>
                                    <div>
                                        <HTMLEditor
                                            label="Terms & Condition"
                                            value={policySettings.termsAndConditions || ''}
                                            onChange={(html) => setPolicySettings({ ...policySettings, termsAndConditions: html })}
                                            placeholder="Enter HTML code for terms and conditions..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'contact' && (
                            <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <Mail className="h-6 w-6 text-indigo-600" />
                                    <h2 className="text-xl font-bold text-gray-900">Contact Us</h2>
                                </div>
                                <p className="text-sm text-gray-600 mb-6">
                                    Shown in-app for support and contact flows (stored in{' '}
                                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">contact_us</code>).
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                                        <input
                                            type="email"
                                            value={contactUs.email || ''}
                                            onChange={(e) => setContactUs({ ...contactUs, email: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                                        <input
                                            type="text"
                                            value={contactUs.phoneNumber || ''}
                                            onChange={(e) => setContactUs({ ...contactUs, phoneNumber: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                                        <input
                                            type="text"
                                            value={contactUs.address || ''}
                                            onChange={(e) => setContactUs({ ...contactUs, address: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Email subject</label>
                                        <input
                                            type="text"
                                            value={contactUs.emailSubject || ''}
                                            onChange={(e) => setContactUs({ ...contactUs, emailSubject: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'commission' && (
                            <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <PercentCircle className="h-6 w-6 text-indigo-600" />
                                    <h2 className="text-xl font-bold text-gray-900">Admin Commission</h2>
                                </div>
                                <p className="text-sm text-gray-600 mb-6">
                                    Platform commission configuration (
                                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">admin_commission</code>).
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Value</label>
                                        <input
                                            type="text"
                                            value={adminCommission.value || ''}
                                            onChange={(e) =>
                                                setAdminCommission({ ...adminCommission, value: e.target.value })
                                            }
                                            placeholder="e.g. 10 for 10%"
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-4 justify-end pb-1">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={adminCommission.isFix || false}
                                                onChange={(e) =>
                                                    setAdminCommission({ ...adminCommission, isFix: e.target.checked })
                                                }
                                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">Fixed amount (not percentage)</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={adminCommission.active || false}
                                                onChange={(e) =>
                                                    setAdminCommission({ ...adminCommission, active: e.target.checked })
                                                }
                                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">Active</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'status' && (
                            <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl p-6">
                                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                    <div className="flex items-center gap-3">
                                        <ListOrdered className="h-6 w-6 text-indigo-600" />
                                        <h2 className="text-xl font-bold text-gray-900">Booking statuses</h2>
                                    </div>
                                    {canWriteSettings && (
                                    <button
                                        type="button"
                                        onClick={addStatusRow}
                                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add row
                                    </button>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600 mb-4">
                                    Rows without a <strong>flag</strong> are ignored when saving. Flags should match your backend (
                                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">status</code>).
                                </p>
                                <div className="overflow-x-auto rounded-lg border border-gray-200">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50 text-left text-gray-700">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold">Flag</th>
                                                <th className="px-4 py-3 font-semibold">Display name</th>
                                                <th className="w-14 px-2 py-3" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {statusOptions.map((row, index) => (
                                                <tr key={index}>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="text"
                                                            value={row.flag}
                                                            onChange={(e) =>
                                                                updateStatusRow(index, 'flag', e.target.value)
                                                            }
                                                            placeholder="pending"
                                                            className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="text"
                                                            value={row.name}
                                                            onChange={(e) =>
                                                                updateStatusRow(index, 'name', e.target.value)
                                                            }
                                                            placeholder="Pending"
                                                            className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        {canWriteSettings ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeStatusRow(index)}
                                                            disabled={statusOptions.length <= 1}
                                                            className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent"
                                                            aria-label="Remove row"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                        ) : null}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'constants' && (
                            <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <Coins className="h-6 w-6 text-indigo-600" />
                                    <h2 className="text-xl font-bold text-gray-900">Constants</h2>
                                </div>
                                <p className="text-sm text-gray-600 mb-6">
                                    Numeric thresholds and fees (
                                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">constant</code>).
                                </p>
                                <div className="grid grid-cols-1 gap-6 max-w-2xl">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Minimum wallet balance to keep
                                        </label>
                                        <input
                                            type="text"
                                            value={constants.minimum_wallet_balance_to_keep || ''}
                                            onChange={(e) =>
                                                setConstants({
                                                    ...constants,
                                                    minimum_wallet_balance_to_keep: e.target.value,
                                                })
                                            }
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Featured service request fee
                                        </label>
                                        <input
                                            type="text"
                                            value={constants.provider_service_featured_request_fee_amount || ''}
                                            onChange={(e) =>
                                                setConstants({
                                                    ...constants,
                                                    provider_service_featured_request_fee_amount: e.target.value,
                                                })
                                            }
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div>
                                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                            <label className="block text-sm font-medium text-gray-700">
                                                Service posting / activation plans
                                            </label>
                                            {canWriteSettings && (
                                                <button
                                                    type="button"
                                                    onClick={addServicePostingTier}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                    Add plan
                                                </button>
                                            )}
                                        </div>
                                        <p className="mb-3 text-xs text-gray-500">
                                            Shown in Pay Activation Fee. Use <code className="rounded bg-gray-100 px-1">-1</code> for unlimited services.
                                        </p>
                                        <div className="space-y-2">
                                            {(constants.service_posting_tiers ?? DEFAULT_SERVICE_POSTING_TIERS).map((tier, index) => (
                                                <div
                                                    key={`tier-${index}`}
                                                    className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-lg border border-gray-200 bg-white p-2"
                                                >
                                                    <div>
                                                        <label className="mb-1 block text-xs font-medium text-gray-500">
                                                            Price (ETB)
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={tier.total_price}
                                                            disabled={!canWriteSettings}
                                                            onChange={(e) =>
                                                                updateServicePostingTier(index, 'total_price', e.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="mb-1 block text-xs font-medium text-gray-500">
                                                            Max services
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={tier.max_services}
                                                            disabled={!canWriteSettings}
                                                            onChange={(e) =>
                                                                updateServicePostingTier(index, 'max_services', e.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
                                                        />
                                                    </div>
                                                    {canWriteSettings && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeServicePostingTier(index)}
                                                            disabled={(constants.service_posting_tiers ?? []).length <= 1}
                                                            className="mt-5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                                                            aria-label="Remove plan"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'country_tax' && (
                            <CountryTaxSettingsPanel canWrite={canWriteSettings} />
                        )}

                        {/* Language Tab */}
                        {activeTab === 'language' && (
                            <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl p-6">
                                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <Languages className="h-6 w-6 text-indigo-600" />
                                        <h2 className="text-xl font-bold text-gray-900">Language Settings</h2>
                                    </div>
                                    {canWriteSettings && (
                                    <button
                                        type="button"
                                        onClick={addLanguageRow}
                                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add language
                                    </button>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600 mb-4">
                                    Languages are loaded from{' '}
                                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">languages</code>.
                                </p>
                                {languageSettings.length === 0 ? (
                                    <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
                                        No languages found.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50 text-left text-gray-700">
                                                <tr>
                                                    <th className="px-4 py-3 font-semibold">Name</th>
                                                    <th className="px-4 py-3 font-semibold">Code</th>
                                                    <th className="px-4 py-3 font-semibold">Active</th>
                                                    <th className="w-14 px-2 py-3" />
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                                {languageSettings.map((language, index) => (
                                                    <tr key={language.id || `${language.code}-${index}`}>
                                                        <td className="px-4 py-2">
                                                            <input
                                                                type="text"
                                                                value={language.name}
                                                                onChange={(e) => updateLanguageRow(index, 'name', e.target.value)}
                                                                className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <input
                                                                type="text"
                                                                value={language.code}
                                                                onChange={(e) => updateLanguageRow(index, 'code', e.target.value)}
                                                                className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={language.active}
                                                                    onChange={(e) => updateLanguageRow(index, 'active', e.target.checked)}
                                                                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                                                />
                                                                <span className="text-sm font-medium text-gray-700">
                                                                    {language.active ? 'Enabled' : 'Disabled'}
                                                                </span>
                                                            </label>
                                                        </td>
                                                        <td className="px-2 py-2">
                                                            {canWriteSettings ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeLanguageRow(index)}
                                                                disabled={languageSettings.length <= 1}
                                                                className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent"
                                                                aria-label="Remove language"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                            ) : null}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
};

export default SettingsPage;

