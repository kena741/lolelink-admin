'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { 
    Settings as SettingsIcon, 
    ArrowLeft, 
    RefreshCw, 
    Save,
    Smartphone,
    Globe,
    Languages,
    Shield,
    Eye,
    EyeOff
} from 'lucide-react';
import Link from 'next/link';
import { fetchSettings, updateSettings, AppSettings, GeneralSettings, PolicySettings } from '@/features/settings/settingsSlice';
import HTMLEditor from '@/components/RichTextEditor';

type TabType = 'app' | 'general' | 'policy' | 'language';

const SettingsPage = () => {
    const dispatch = useAppDispatch();
    const { settings, loading, error } = useAppSelector((state) => state.settings);
    const [activeTab, setActiveTab] = useState<TabType>('app');
    const [saving, setSaving] = useState(false);
    
    // Form states
    const [appSettings, setAppSettings] = useState<AppSettings>({});
    const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({});
    const [policySettings, setPolicySettings] = useState<PolicySettings>({});
    const [showGoogleMapKey, setShowGoogleMapKey] = useState(false);

    useEffect(() => {
        dispatch(fetchSettings()).catch((err) => {
            // Silently handle errors - settings will be empty and user can still use the form
            console.warn('Settings fetch error (this is OK if table doesn\'t exist yet):', err);
        });
    }, [dispatch]);

    useEffect(() => {
        if (settings) {
            setAppSettings(settings.appSettings || {});
            setGeneralSettings(settings.generalSettings || {});
            setPolicySettings(settings.policySettings || {});
        }
    }, [settings]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await dispatch(updateSettings({
                appSettings,
                generalSettings,
                policySettings,
            })).unwrap();
        } catch (err) {
            console.error('Failed to save settings:', err);
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'app' as TabType, label: 'App Settings', icon: Smartphone },
        { id: 'general' as TabType, label: 'General Settings', icon: Globe },
        { id: 'policy' as TabType, label: 'Policy Settings', icon: Shield },
        { id: 'language' as TabType, label: 'Language', icon: Languages },
    ];

    return (
        <AuthGuard>
            <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/30">
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    {/* Header */}
                    <div className="relative isolate overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 opacity-90" />
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20" />
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
                                            <SettingsIcon className="h-6 w-6 text-white" />
                                        </div>
                                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                                            Settings
                                        </h1>
                                    </div>
                                    <div className="flex items-center gap-2 text-white/90 text-sm">
                                        <Link href="/admin/dashboard" className="hover:text-white transition-colors">
                                            Dashboard
                                        </Link>
                                        <span>/</span>
                                        <span className="text-white font-semibold">Settings</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => dispatch(fetchSettings())}
                                        className="group inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md px-4 py-3 text-sm font-semibold text-white ring-2 ring-white/20 hover:bg-white/20 hover:ring-white/40 transition-all duration-300 hover:scale-105"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
                                        Refresh
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving || loading}
                                        className="inline-flex items-center gap-2 rounded-xl bg-white/20 backdrop-blur-md px-4 py-3 text-sm font-semibold text-white ring-2 ring-white/30 hover:bg-white/30 hover:ring-white/50 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Save className="h-4 w-4" />
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        {/* Tabs */}
                        <div className="mb-6 flex items-center gap-2 bg-white/80 backdrop-blur-xl rounded-xl p-1 border border-white/20 shadow-lg overflow-x-auto">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                                            isActive
                                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                                                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {error && !error.toLowerCase().includes('406') && (
                            <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-600">
                                <p className="font-semibold mb-1">Settings Note</p>
                                <p>Settings table may not exist yet. You can still configure settings below and save them.</p>
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
                                            label="About App"
                                            value={policySettings.aboutApp || ''}
                                            onChange={(html) => setPolicySettings({ ...policySettings, aboutApp: html })}
                                            placeholder="Enter HTML code for about app..."
                                        />
                                    </div>
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

                        {/* Language Tab */}
                        {activeTab === 'language' && (
                            <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl p-6">
                                <h2 className="text-xl font-bold text-gray-900 mb-6">Language Settings</h2>
                                <div className="text-center py-12">
                                    <Languages className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-600">Language settings coming soon</p>
                                </div>
                            </div>
                        )}

                    </div>
                </main>
            </div>
        </AuthGuard>
    );
};

export default SettingsPage;

