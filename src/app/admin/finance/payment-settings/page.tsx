'use client';
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import { 
    RefreshCw, 
    Save,
    Eye,
    EyeOff
} from 'lucide-react';
import { fetchSettings, updateSettings, PaymentSettings } from '@/features/settings/settingsSlice';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';

interface ChapaFormValues {
    name: string;
    enable: boolean;
    isActive: boolean;
    isSandbox: boolean;
    publicKey: string;
    secretKey: string;
}

interface ToastState {
    message: string;
    variant: 'success' | 'error';
}

const PaymentSettingsPage = () => {
    const dispatch = useAppDispatch();
    const { canWriteFinance, canWriteSettings } = useAdminPermissions();
    const canAlterPaymentSettings = canWriteFinance || canWriteSettings;
    const { settings, loading, error } = useAppSelector((state) => state.settings);
    const [saving, setSaving] = useState(false);
    const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({});
    const [toast, setToast] = useState<ToastState | null>(null);
    const [isSecretVisible, setIsSecretVisible] = useState(false);

    const chapaValues: ChapaFormValues = {
        name: String(paymentSettings.chapa?.name || 'Chapa'),
        enable: Boolean(paymentSettings.chapa?.enable),
        isActive: Boolean(paymentSettings.chapa?.isActive),
        isSandbox: Boolean(paymentSettings.chapa?.isSandbox),
        publicKey: String(paymentSettings.chapa?.publicKey || ''),
        secretKey: String(paymentSettings.chapa?.secretKey || ''),
    };

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

    useEffect(() => {
        if (!toast) return;
        const timeoutId = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(timeoutId);
    }, [toast]);

    const updatePaymentSetting = (
        provider: 'chapa' | 'telebirr' | 'wallet' | 'flutterWave',
        key: string,
        value: string | boolean | number
    ) => {
        setPaymentSettings(prev => ({
            ...prev,
            [provider]: {
                ...prev[provider],
                [key]: value,
            },
        }));
    };

    const updateChapaField = (key: keyof ChapaFormValues, value: string | boolean) => {
        updatePaymentSetting('chapa', key, value);
    };

    const handleSave = async () => {
        if (!canAlterPaymentSettings) return;
        setSaving(true);
        try {
            await dispatch(updateSettings({
                paymentSettings,
            })).unwrap();
            setToast({ message: 'Payment settings saved successfully.', variant: 'success' });
        } catch (err) {
            console.error('Failed to save payment settings:', err);
            setToast({ message: 'Failed to save payment settings. Please try again.', variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleRefresh = () => {
        dispatch(fetchSettings());
    };

    return (
        <AuthGuard>
            <div className="flex min-h-screen">
                {toast && (
                    <div className="fixed right-6 top-6 z-100">
                        <div
                            className={`rounded-lg border px-4 py-3 text-sm font-semibold shadow-xl ${
                                toast.variant === 'success'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-red-200 bg-red-50 text-red-700'
                            }`}
                        >
                            {toast.message}
                        </div>
                    </div>
                )}
                <Sidebar />
                <main className="ml-64 w-full min-h-screen">
                    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                        <AdminPageHeader
                            title="Payment Settings"
                            breadcrumbs={[
                                { label: 'Dashboard', href: '/admin/dashboard' },
                                { label: 'Finance', href: '/admin/finance/payout-request' },
                                { label: 'Payment Settings' },
                            ]}
                            actions={
                                <>
                                    <button
                                        type="button"
                                        onClick={handleRefresh}
                                        className={adminHeaderButtonClassName()}
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </button>
                                    {canAlterPaymentSettings ? (
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={saving}
                                            className={adminHeaderButtonClassName()}
                                        >
                                            <Save className="h-4 w-4" />
                                            {saving ? 'Saving...' : 'Save'}
                                        </button>
                                    ) : null}
                                </>
                            }
                        />
                        {error && (
                            <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        <fieldset disabled={!canAlterPaymentSettings} className="space-y-6 disabled:opacity-90">
                            {/* Chapa */}
                            <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Chapa</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                                        <input
                                            type="text"
                                            value={chapaValues.name}
                                            onChange={(e) => updateChapaField('name', e.target.value)}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div className="flex items-end gap-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={chapaValues.enable}
                                                onChange={(e) => updateChapaField('enable', e.target.checked)}
                                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">Enable</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={chapaValues.isActive}
                                                onChange={(e) => updateChapaField('isActive', e.target.checked)}
                                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">Active</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={chapaValues.isSandbox}
                                                onChange={(e) => updateChapaField('isSandbox', e.target.checked)}
                                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">Sandbox</span>
                                        </label>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Public Key</label>
                                        <input
                                            type="text"
                                            value={chapaValues.publicKey}
                                            onChange={(e) => updateChapaField('publicKey', e.target.value)}
                                            placeholder="CHAPUBK-..."
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Secret Key</label>
                                        <div className="relative">
                                            <input
                                                type={isSecretVisible ? 'text' : 'password'}
                                                value={chapaValues.secretKey}
                                                onChange={(e) => updateChapaField('secretKey', e.target.value)}
                                                placeholder="CHASECK-..."
                                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pr-10 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setIsSecretVisible((prev) => !prev)}
                                                className="absolute inset-y-0 right-2 inline-flex items-center text-gray-500 hover:text-gray-700"
                                                aria-label={isSecretVisible ? 'Hide secret key' : 'Show secret key'}
                                            >
                                                {isSecretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/*
                            <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Flutterwave</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                                        <input
                                            type="text"
                                            value={flutterWaveValues.name}
                                            onChange={(e) => updateFlutterWaveField('name', e.target.value)}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                    <div className="flex items-end gap-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={flutterWaveValues.isActive}
                                                onChange={(e) => updateFlutterWaveField('isActive', e.target.checked)}
                                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">Active</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={flutterWaveValues.isSandBox}
                                                onChange={(e) => updateFlutterWaveField('isSandBox', e.target.checked)}
                                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">Sandbox</span>
                                        </label>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Public Key</label>
                                        <input
                                            type="text"
                                            value={flutterWaveValues.publicKey}
                                            onChange={(e) => updateFlutterWaveField('publicKey', e.target.value)}
                                            placeholder="FLWPUBK_..."
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>
                                </div>
                            </div>
                            */}

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
                        </fieldset>
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
};

export default PaymentSettingsPage;

