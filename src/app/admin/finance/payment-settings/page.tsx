'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { 
    CreditCard, 
    ArrowLeft, 
    RefreshCw, 
    Save
} from 'lucide-react';
import Link from 'next/link';
import { fetchSettings, updateSettings, PaymentSettings } from '@/features/settings/settingsSlice';

const PaymentSettingsPage = () => {
    const dispatch = useAppDispatch();
    const { settings, loading, error } = useAppSelector((state) => state.settings);
    const [saving, setSaving] = useState(false);
    const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({});

    useEffect(() => {
        dispatch(fetchSettings()).catch((err) => {
            console.warn('Settings fetch error:', err);
        });
    }, [dispatch]);

    useEffect(() => {
        if (settings) {
            setPaymentSettings(settings.paymentSettings || {});
        }
    }, [settings]);

    const updatePaymentSetting = (provider: 'chapa' | 'telebirr' | 'wallet', key: string, value: string | boolean | number) => {
        setPaymentSettings(prev => ({
            ...prev,
            [provider]: {
                ...prev[provider],
                [key]: value,
            },
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await dispatch(updateSettings({
                paymentSettings,
            })).unwrap();
            alert('Payment settings saved successfully!');
        } catch (err) {
            console.error('Failed to save payment settings:', err);
            alert('Failed to save payment settings. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleRefresh = () => {
        dispatch(fetchSettings());
    };

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
                                            <CreditCard className="h-6 w-6 text-white" />
                                        </div>
                                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                                            Payment Settings
                                        </h1>
                                    </div>
                                    <div className="flex items-center gap-2 text-white/90 text-sm">
                                        <Link href="/admin/dashboard" className="hover:text-white transition-colors">
                                            Dashboard
                                        </Link>
                                        <span>/</span>
                                        <Link href="/admin/finance/payout-request" className="hover:text-white transition-colors">
                                            Finance
                                        </Link>
                                        <span>/</span>
                                        <span className="text-white font-semibold">Payment Settings</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleRefresh}
                                        className="group inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md px-4 py-3 text-sm font-semibold text-white ring-2 ring-white/20 hover:bg-white/20 hover:ring-white/40 transition-all duration-300 hover:scale-105"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
                                        Refresh
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="inline-flex items-center gap-2 rounded-xl bg-white/20 backdrop-blur-md px-4 py-3 text-sm font-semibold text-white ring-2 ring-white/30 hover:bg-white/30 hover:ring-white/50 transition-all duration-300 hover:scale-105 disabled:opacity-50"
                                    >
                                        <Save className="h-4 w-4" />
                                        {saving ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        {error && (
                            <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        <div className="space-y-6">
                            {/* Chapa */}
                            <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Chapa</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                                        <input
                                            type="text"
                                            value={paymentSettings.chapa?.name || ''}
                                            onChange={(e) => updatePaymentSetting('chapa', 'name', e.target.value)}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={paymentSettings.chapa?.enable || false}
                                                onChange={(e) => updatePaymentSetting('chapa', 'enable', e.target.checked)}
                                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">Enable</span>
                                        </label>
                                    </div>
                                    {paymentSettings.chapa && Object.keys(paymentSettings.chapa).filter(k => k !== 'name' && k !== 'enable').map((key) => (
                                        <div key={key}>
                                            <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">{key}</label>
                                            <input
                                                type="text"
                                                value={String(paymentSettings.chapa?.[key] || '')}
                                                onChange={(e) => updatePaymentSetting('chapa', key, e.target.value)}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Telebirr */}
                            <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Telebirr</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                                        <input
                                            type="text"
                                            value={paymentSettings.telebirr?.name || ''}
                                            onChange={(e) => updatePaymentSetting('telebirr', 'name', e.target.value)}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    {paymentSettings.telebirr && Object.keys(paymentSettings.telebirr).filter(k => k !== 'name').map((key) => (
                                        <div key={key}>
                                            <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">{key}</label>
                                            <input
                                                type="text"
                                                value={String(paymentSettings.telebirr?.[key] || '')}
                                                onChange={(e) => updatePaymentSetting('telebirr', key, e.target.value)}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Wallet */}
                            <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Wallet</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                                        <input
                                            type="text"
                                            value={paymentSettings.wallet?.name || ''}
                                            onChange={(e) => updatePaymentSetting('wallet', 'name', e.target.value)}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={paymentSettings.wallet?.enable || false}
                                                onChange={(e) => updatePaymentSetting('wallet', 'enable', e.target.checked)}
                                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">Enable</span>
                                        </label>
                                    </div>
                                    {paymentSettings.wallet && Object.keys(paymentSettings.wallet).filter(k => k !== 'name' && k !== 'enable').map((key) => (
                                        <div key={key}>
                                            <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">{key}</label>
                                            <input
                                                type="text"
                                                value={String(paymentSettings.wallet?.[key] || '')}
                                                onChange={(e) => updatePaymentSetting('wallet', key, e.target.value)}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
};

export default PaymentSettingsPage;

