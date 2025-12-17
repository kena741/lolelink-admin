'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { CreditCard, ArrowLeft, RefreshCw, Save, Key, Lock, Smartphone, Barcode } from 'lucide-react';
import Link from 'next/link';
import { fetchSettings, updateSettings, PaymentSettings } from '@/features/settings/settingsSlice';

const PaymentPage = () => {
    const dispatch = useAppDispatch();
    const { settings, loading, error } = useAppSelector((state) => state.settings);
    const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({});
    const [saving, setSaving] = useState(false);

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

    const updatePaymentSetting = (provider: 'chapa' | 'telebirr' | 'wallet', key: string, value: any) => {
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
        } catch (err) {
            console.error('Failed to save payment settings:', err);
        } finally {
            setSaving(false);
        }
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
                                        <span className="text-white font-semibold">Payment</span>
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
                                        Save Changes
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
                                <h3 className="text-lg font-bold text-gray-900 mb-6">CHAPA</h3>
                                <div className="space-y-6">
                                    {/* Input Fields */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">ABC</div>
                                                <input
                                                    type="text"
                                                    value={paymentSettings.chapa?.name || ''}
                                                    onChange={(e) => updatePaymentSetting('chapa', 'name', e.target.value)}
                                                    className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                    placeholder="chapa"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Public Key</label>
                                            <div className="relative">
                                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={paymentSettings.chapa?.publicKey || ''}
                                                    onChange={(e) => updatePaymentSetting('chapa', 'publicKey', e.target.value)}
                                                    className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                    placeholder="CHAPUBK_TEST-..."
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Secret Key</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                <input
                                                    type="password"
                                                    value={paymentSettings.chapa?.secretKey || ''}
                                                    onChange={(e) => updatePaymentSetting('chapa', 'secretKey', e.target.value)}
                                                    className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Radio Button Groups */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-3">Status</label>
                                            <div className="flex items-center gap-6">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="chapa-status"
                                                        checked={paymentSettings.chapa?.status === 'active' || paymentSettings.chapa?.status === true}
                                                        onChange={() => updatePaymentSetting('chapa', 'status', 'active')}
                                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Active</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="chapa-status"
                                                        checked={paymentSettings.chapa?.status === 'inactive' || paymentSettings.chapa?.status === false}
                                                        onChange={() => updatePaymentSetting('chapa', 'status', 'inactive')}
                                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Inactive</span>
                                                </label>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-3">Sandbox Mode</label>
                                            <div className="flex items-center gap-6">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="chapa-sandbox"
                                                        checked={paymentSettings.chapa?.sandboxMode === true || paymentSettings.chapa?.sandboxMode === 'enabled'}
                                                        onChange={() => updatePaymentSetting('chapa', 'sandboxMode', true)}
                                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Enabled</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="chapa-sandbox"
                                                        checked={paymentSettings.chapa?.sandboxMode === false || paymentSettings.chapa?.sandboxMode === 'disabled'}
                                                        onChange={() => updatePaymentSetting('chapa', 'sandboxMode', false)}
                                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Disabled</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Telebirr */}
                            <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-6">TELEBIRR</h3>
                                <div className="space-y-6">
                                    {/* Input Fields */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">ABC</div>
                                                <input
                                                    type="text"
                                                    value={paymentSettings.telebirr?.name || ''}
                                                    onChange={(e) => updatePaymentSetting('telebirr', 'name', e.target.value)}
                                                    className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                    placeholder="Telebir"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">App ID</label>
                                            <div className="relative">
                                                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={paymentSettings.telebirr?.appId || ''}
                                                    onChange={(e) => updatePaymentSetting('telebirr', 'appId', e.target.value)}
                                                    className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                    placeholder="example"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">App Key</label>
                                            <div className="relative">
                                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={paymentSettings.telebirr?.appKey || ''}
                                                    onChange={(e) => updatePaymentSetting('telebirr', 'appKey', e.target.value)}
                                                    className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                    placeholder="example"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Public Key</label>
                                            <div className="relative">
                                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={paymentSettings.telebirr?.publicKey || ''}
                                                    onChange={(e) => updatePaymentSetting('telebirr', 'publicKey', e.target.value)}
                                                    className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                    placeholder="example"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Short Code</label>
                                            <div className="relative">
                                                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={paymentSettings.telebirr?.shortCode || ''}
                                                    onChange={(e) => updatePaymentSetting('telebirr', 'shortCode', e.target.value)}
                                                    className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                    placeholder="123456"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Radio Button Groups */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-3">Status</label>
                                            <div className="flex items-center gap-6">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="telebirr-status"
                                                        checked={paymentSettings.telebirr?.status === 'active' || paymentSettings.telebirr?.status === true}
                                                        onChange={() => updatePaymentSetting('telebirr', 'status', 'active')}
                                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Active</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="telebirr-status"
                                                        checked={paymentSettings.telebirr?.status === 'inactive' || paymentSettings.telebirr?.status === false}
                                                        onChange={() => updatePaymentSetting('telebirr', 'status', 'inactive')}
                                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Inactive</span>
                                                </label>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-3">Sandbox Mode</label>
                                            <div className="flex items-center gap-6">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="telebirr-sandbox"
                                                        checked={paymentSettings.telebirr?.sandboxMode === true || paymentSettings.telebirr?.sandboxMode === 'enabled'}
                                                        onChange={() => updatePaymentSetting('telebirr', 'sandboxMode', true)}
                                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Enabled</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="telebirr-sandbox"
                                                        checked={paymentSettings.telebirr?.sandboxMode === false || paymentSettings.telebirr?.sandboxMode === 'disabled'}
                                                        onChange={() => updatePaymentSetting('telebirr', 'sandboxMode', false)}
                                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Disabled</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Wallet */}
                            <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-6">WALLET</h3>
                                <div className="space-y-6">
                                    {/* Input Fields */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">ABC</div>
                                                <input
                                                    type="text"
                                                    value={paymentSettings.wallet?.name || ''}
                                                    onChange={(e) => updatePaymentSetting('wallet', 'name', e.target.value)}
                                                    className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                    placeholder="wallet"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Radio Button Groups */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-3">Status</label>
                                            <div className="flex items-center gap-6">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="wallet-status"
                                                        checked={paymentSettings.wallet?.status === 'active' || paymentSettings.wallet?.status === true}
                                                        onChange={() => updatePaymentSetting('wallet', 'status', 'active')}
                                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Active</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="wallet-status"
                                                        checked={paymentSettings.wallet?.status === 'inactive' || paymentSettings.wallet?.status === false}
                                                        onChange={() => updatePaymentSetting('wallet', 'status', 'inactive')}
                                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Inactive</span>
                                                </label>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-3">Sandbox Mode</label>
                                            <div className="flex items-center gap-6">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="wallet-sandbox"
                                                        checked={paymentSettings.wallet?.sandboxMode === true || paymentSettings.wallet?.sandboxMode === 'enabled'}
                                                        onChange={() => updatePaymentSetting('wallet', 'sandboxMode', true)}
                                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Enabled</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="wallet-sandbox"
                                                        checked={paymentSettings.wallet?.sandboxMode === false || paymentSettings.wallet?.sandboxMode === 'disabled'}
                                                        onChange={() => updatePaymentSetting('wallet', 'sandboxMode', false)}
                                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Disabled</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
};

export default PaymentPage;
