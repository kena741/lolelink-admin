'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save, Smartphone, Plus, Trash2, AlertTriangle, Dot, CircleCheck } from 'lucide-react';
import AdminPageHeader, { adminHeaderButtonClassName } from '@/components/AdminPageHeader';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface VersionRule {
    version: string;
    build: number;
}

interface MobileAppConfigItem {
    app_key: string;
    maintenance_mode: boolean;
    maintenance_message: string;
    maintenance_affected_versions: VersionRule[];
    update_needed: boolean;
    update_message: string;
    update_affected_versions: VersionRule[];
    created_at: string | null;
    updated_at: string | null;
}

function formatDateTime(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function normalizeRule(rule?: Partial<VersionRule>): VersionRule {
    return {
        version: (rule?.version ?? '').trim(),
        build: Number.isFinite(Number(rule?.build)) ? Math.trunc(Number(rule?.build)) : 0,
    };
}

function getAppLabel(appKey: string): string {
    return appKey
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function VersionEditor(props: {
    title: string;
    rules: VersionRule[];
    disabled: boolean;
    onChange: (next: VersionRule[]) => void;
}) {
    const { title, rules, disabled, onChange } = props;

    const updateRule = (index: number, patch: Partial<VersionRule>) => {
        onChange(rules.map((rule, idx) => (idx === index ? normalizeRule({ ...rule, ...patch }) : rule)));
    };

    const addRule = () => onChange([...rules, { version: '', build: 0 }]);
    const removeRule = (index: number) => onChange(rules.filter((_, idx) => idx !== index));

    return (
        <Card className="gap-4 bg-base py-4 shadow-none">
            <CardHeader className="px-4 pb-0">
                <div className="flex items-center gap-2">
                    <CardTitle className="text-[14px]">{title}</CardTitle>
                    <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-semibold text-secondary">
                        {rules.length}
                    </span>
                </div>
                {!disabled && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addRule}
                        className="h-8 gap-1 px-2.5 text-[13px]"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                    </Button>
                )}
            </CardHeader>

            <CardContent className="px-4 pt-0">
                {rules.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">No versions configured.</p>
                ) : (
                <div className="space-y-2">
                    {rules.map((rule, index) => (
                        <div key={`${title}-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px_auto]">
                            <Input
                                value={rule.version}
                                disabled={disabled}
                                onChange={(event) => updateRule(index, { version: event.target.value })}
                                placeholder="Version (e.g. 1.0.6)"
                                className="h-10 text-[14px]"
                            />
                            <Input
                                type="number"
                                value={rule.build}
                                disabled={disabled}
                                onChange={(event) => updateRule(index, { build: Number(event.target.value || 0) })}
                                placeholder="Build"
                                className="h-10 text-[14px]"
                            />
                            {!disabled && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => removeRule(index)}
                                    className="h-10 w-10"
                                    aria-label="Remove version"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function MobileAppConfigPage() {
    const { canWriteSettings, canWriteContact } = useAdminPermissions();
    const canEditConfig = canWriteSettings || canWriteContact;
    const [items, setItems] = useState<MobileAppConfigItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [snapshotByKey, setSnapshotByKey] = useState<Record<string, string>>({});

    const sortedItems = useMemo(
        () => [...items].sort((a, b) => a.app_key.localeCompare(b.app_key)),
        [items]
    );

    const loadConfigs = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/mobile-app-config');
            const payload = (await response.json()) as {
                data?: MobileAppConfigItem[];
                error?: string;
            };
            if (!response.ok) throw new Error(payload.error || 'Failed to load mobile app config');
            const nextItems = payload.data ?? [];
            setItems(nextItems);
            setSnapshotByKey(
                nextItems.reduce<Record<string, string>>((acc, item) => {
                    acc[item.app_key] = JSON.stringify(item);
                    return acc;
                }, {})
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load mobile app config');
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadConfigs();
    }, []);

    const updateItem = (appKey: string, patch: Partial<MobileAppConfigItem>) => {
        setItems((prev) =>
            prev.map((item) => (item.app_key === appKey ? { ...item, ...patch } : item))
        );
    };

    const saveItem = async (item: MobileAppConfigItem) => {
        setSavingKey(item.app_key);
        setError(null);
        try {
            const response = await fetch('/api/admin/mobile-app-config', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    appKey: item.app_key,
                    maintenanceMode: item.maintenance_mode,
                    maintenanceMessage: item.maintenance_message,
                    maintenanceAffectedVersions: item.maintenance_affected_versions,
                    updateNeeded: item.update_needed,
                    updateMessage: item.update_message,
                    updateAffectedVersions: item.update_affected_versions,
                }),
            });
            const payload = (await response.json()) as {
                data?: MobileAppConfigItem;
                error?: string;
            };
            if (!response.ok) throw new Error(payload.error || 'Failed to save app config');
            if (payload.data) {
                setItems((prev) =>
                    prev.map((existing) =>
                        existing.app_key === item.app_key ? payload.data as MobileAppConfigItem : existing
                    )
                );
                setSnapshotByKey((prev) => ({
                    ...prev,
                    [item.app_key]: JSON.stringify(payload.data),
                }));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save app config');
        } finally {
            setSavingKey(null);
        }
    };

    return (
        <>
            
                
                    <div className="mx-auto max-w-[1100px] px-6 py-8 lg:px-8">
                        <AdminPageHeader
                            title="Mobile App Config"
                            breadcrumbs={[
                                { label: 'Dashboard', href: '/admin/dashboard' },
                                { label: 'Mobile App Config' },
                            ]}
                            actions={
                                <Button
                                    type="button"
                                    onClick={() => void loadConfigs()}
                                    className={adminHeaderButtonClassName()}
                                    disabled={loading}
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                    Refresh
                                </Button>
                            }
                        />

                        <Card className="mb-6 gap-2 bg-surface py-4 shadow-none">
                            <CardHeader className="px-4 py-0">
                                <CardTitle className="text-[16px] font-semibold text-foreground">
                                Control maintenance and force-update behavior per mobile app key.
                                </CardTitle>
                                <CardDescription className="text-[14px] leading-6 text-muted-foreground">
                                Save each app independently after making changes.
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        {error && (
                            <div className="mb-6 rounded-md border border-accent-error bg-accent-error/10 p-3 text-[14px] font-medium text-primary">
                                {error}
                            </div>
                        )}

                        {loading ? (
                            <div className="rounded-md border border-subtle bg-surface p-6">
                                <div className="mb-4 h-6 w-56 animate-pulse rounded bg-muted" />
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div className="h-40 animate-pulse rounded-md bg-muted" />
                                    <div className="h-40 animate-pulse rounded-md bg-muted" />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {sortedItems.map((item) => {
                                    const isSaving = savingKey === item.app_key;
                                    const itemSnapshot = snapshotByKey[item.app_key];
                                    const isDirty = itemSnapshot ? itemSnapshot !== JSON.stringify(item) : true;
                                    const isDisabled = !canEditConfig || isSaving || !isDirty;
                                    return (
                                        <Card
                                            key={item.app_key}
                                            className="gap-6 border-subtle bg-surface py-6 shadow-none"
                                        >
                                            <CardHeader className="px-6">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-[40px] w-[40px] items-center justify-center rounded-md border border-border bg-muted">
                                                        <Smartphone className="h-5 w-5 text-foreground" />
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-[20px] font-bold leading-[1.2] text-foreground">
                                                            {getAppLabel(item.app_key)}
                                                        </CardTitle>
                                                        <p className="text-[13px] font-semibold text-muted-foreground">
                                                            {item.app_key}
                                                        </p>
                                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                                                            <span
                                                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                                                                    item.maintenance_mode
                                                                        ? 'bg-amber-100 text-amber-800'
                                                                        : 'bg-muted text-muted-foreground'
                                                                }`}
                                                            >
                                                                {item.maintenance_mode ? (
                                                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                                                                ) : (
                                                                    <Dot className="h-3.5 w-3.5 text-muted-foreground" />
                                                                )}
                                                                {item.maintenance_mode ? 'Maintenance on' : 'Maintenance off'}
                                                            </span>
                                                            <span
                                                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                                                                    item.update_needed
                                                                        ? 'bg-amber-100 text-amber-800'
                                                                        : 'bg-muted text-muted-foreground'
                                                                }`}
                                                            >
                                                                {item.update_needed ? (
                                                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                                                                ) : (
                                                                    <Dot className="h-3.5 w-3.5 text-muted-foreground" />
                                                                )}
                                                                {item.update_needed ? 'Update required' : 'Update optional'}
                                                            </span>
                                                            {isDirty ? (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-semibold text-foreground">
                                                                    <CircleCheck className="h-3.5 w-3.5" />
                                                                    Unsaved changes
                                                                </span>
                                                            ) : null}
                                                            <span>Updated {formatDateTime(item.updated_at)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <CardAction>
                                                <Button
                                                    type="button"
                                                    onClick={() => void saveItem(item)}
                                                    disabled={isDisabled}
                                                    size="lg"
                                                    className="h-[40px] items-center gap-2 text-[14px]"
                                                >
                                                    <Save className="h-4 w-4" />
                                                    {isSaving ? 'Saving...' : 'Save'}
                                                </Button>
                                                </CardAction>
                                            </div>
                                            </CardHeader>

                                            <CardContent className="px-6">
                                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
                                                        <Switch
                                                            checked={item.maintenance_mode}
                                                            disabled={!canEditConfig}
                                                            onCheckedChange={(checked) =>
                                                                updateItem(item.app_key, {
                                                                    maintenance_mode: checked,
                                                                })
                                                            }
                                                            id={`${item.app_key}-maintenance-mode`}
                                                            className={item.maintenance_mode ? 'data-[state=checked]:bg-amber-500' : ''}
                                                        />
                                                        <Label htmlFor={`${item.app_key}-maintenance-mode`} className="text-[14px] font-semibold">
                                                        Maintenance mode
                                                        </Label>
                                                    </div>
                                                    <textarea
                                                        value={item.maintenance_message}
                                                        disabled={!canEditConfig}
                                                        onChange={(event) =>
                                                            updateItem(item.app_key, {
                                                                maintenance_message: event.target.value,
                                                            })
                                                        }
                                                        rows={4}
                                                        placeholder="Message shown when maintenance mode blocks usage."
                                                        className="w-full rounded-md border border-input bg-card p-3 text-[14px] text-card-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
                                                    />
                                                    <VersionEditor
                                                        title="Maintenance affected versions"
                                                        rules={item.maintenance_affected_versions}
                                                        disabled={!canEditConfig}
                                                        onChange={(next) =>
                                                            updateItem(item.app_key, {
                                                                maintenance_affected_versions: next,
                                                            })
                                                        }
                                                    />
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
                                                        <Switch
                                                            checked={item.update_needed}
                                                            disabled={!canEditConfig}
                                                            onCheckedChange={(checked) =>
                                                                updateItem(item.app_key, {
                                                                    update_needed: checked,
                                                                })
                                                            }
                                                            id={`${item.app_key}-update-needed`}
                                                            className={item.update_needed ? 'data-[state=checked]:bg-amber-500' : ''}
                                                        />
                                                        <Label htmlFor={`${item.app_key}-update-needed`} className="text-[14px] font-semibold">
                                                        Force update
                                                        </Label>
                                                    </div>
                                                    <textarea
                                                        value={item.update_message}
                                                        disabled={!canEditConfig}
                                                        onChange={(event) =>
                                                            updateItem(item.app_key, {
                                                                update_message: event.target.value,
                                                            })
                                                        }
                                                        rows={4}
                                                        placeholder="Message shown when update is required."
                                                        className="w-full rounded-md border border-input bg-card p-3 text-[14px] text-card-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
                                                    />
                                                    <VersionEditor
                                                        title="Update affected versions"
                                                        rules={item.update_affected_versions}
                                                        disabled={!canEditConfig}
                                                        onChange={(next) =>
                                                            updateItem(item.app_key, {
                                                                update_affected_versions: next,
                                                            })
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}

                                {sortedItems.length === 0 && (
                                    <div className="rounded-md border border-subtle bg-surface p-8 text-center text-[14px] text-secondary">
                                        No mobile app configs found.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                
            
        </>
    );
}
