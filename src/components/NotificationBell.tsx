'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, CheckCheck, Inbox, MessageSquare, Volume2, VolumeX } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OpsInboxRow } from '@/components/ops-inbox/OpsInboxRow';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
    fetchNotifications,
    markNotificationRead,
    markNotificationsReadBulk,
} from '@/features/notification/notificationSlice';
import { fetchPayoutRequests } from '@/features/payout/payoutSlice';
import { fetchVerifyDocuments } from '@/features/verifyDocuments/verifyDocumentsSlice';
import {
    buildOpsInbox,
    countOpsInbox,
    filterOpsInbox,
    opsNotificationIds,
    type OpsInboxItem,
} from '@/lib/ops-inbox';
import {
    getBrowserNotificationPermission,
    playOpsInboxSound,
    requestOpsDesktopPermission,
    unlockOpsAlertAudio,
} from '@/lib/ops-inbox-alerts';
import { useOpsInboxAlerts } from '@/hooks/use-ops-inbox-alerts';
import { cn } from '@/lib/utils';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';

const PREVIEW_LIMIT = 8;

export function NotificationBell() {
    const pathname = usePathname();
    const dispatch = useAppDispatch();
    const { canWriteNotifications } = useAdminPermissions();
    const notifications = useAppSelector((state) => state.notification.items);
    const payouts = useAppSelector((state) => state.payout.requests);
    const documents = useAppSelector((state) => state.verifyDocuments.documents);
    const [open, setOpen] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
        'default'
    );
    const [alertsReady, setAlertsReady] = useState(false);
    const [smsTestState, setSmsTestState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');

    const isAdmin = Boolean(pathname?.startsWith('/admin'));
    const onInboxPage = Boolean(pathname?.startsWith('/admin/notifications'));

    useEffect(() => {
        if (!isAdmin) {
            setAlertsReady(false);
            return;
        }
        let cancelled = false;
        setAlertsReady(false);
        void Promise.all([
            dispatch(fetchNotifications()),
            dispatch(fetchPayoutRequests()),
            dispatch(fetchVerifyDocuments()),
        ]).finally(() => {
            if (!cancelled) setAlertsReady(true);
        });
        return () => {
            cancelled = true;
        };
    }, [dispatch, isAdmin, pathname]);

    useEffect(() => {
        setPermission(getBrowserNotificationPermission());
    }, [open]);

    const queue = useMemo(
        () =>
            buildOpsInbox({
                notifications,
                payouts,
                documents,
            }),
        [notifications, payouts, documents]
    );

    const needsItems = useMemo(
        () => filterOpsInbox(queue, { status: 'needs', category: 'all' }),
        [queue]
    );

    const counts = useMemo(() => countOpsInbox(queue), [queue]);
    const preview = needsItems.slice(0, PREVIEW_LIMIT);
    const { prefs, updatePrefs } = useOpsInboxAlerts(
        isAdmin ? needsItems : [],
        isAdmin && alertsReady
    );

    if (!isAdmin) return null;

    async function handleOpenItem(item: OpsInboxItem) {
        if (!item.canMarkRead || !item.notificationId || item.isRead) return;
        if (!canWriteNotifications) return;
        await dispatch(markNotificationRead({ id: item.notificationId }));
    }

    async function handleMarkAllRead() {
        if (!canWriteNotifications) return;
        const ids = opsNotificationIds(needsItems);
        if (ids.length === 0) return;
        await dispatch(markNotificationsReadBulk({ ids }));
    }

    function toggleSound() {
        unlockOpsAlertAudio();
        const next = !prefs.sound;
        updatePrefs({ ...prefs, sound: next });
        if (next) playOpsInboxSound({ urgent: false });
    }

    async function toggleDesktop() {
        unlockOpsAlertAudio();
        if (!prefs.desktop) {
            const result = await requestOpsDesktopPermission();
            setPermission(result);
            if (result !== 'granted') {
                updatePrefs({ ...prefs, desktop: false });
                return;
            }
            updatePrefs({ ...prefs, desktop: true });
            return;
        }
        updatePrefs({ ...prefs, desktop: false });
    }

    function toggleSms() {
        updatePrefs({ ...prefs, sms: !prefs.sms });
    }

    async function handleTestSms() {
        setSmsTestState('sending');
        try {
            const response = await fetch('/api/admin/ops-alert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Test alert',
                    body: 'Ops SMS is working. You can ignore this message.',
                }),
            });
            if (!response.ok) {
                setSmsTestState('error');
                return;
            }
            setSmsTestState('ok');
        } catch {
            setSmsTestState('error');
        } finally {
            window.setTimeout(() => setSmsTestState('idle'), 4000);
        }
    }

    const badge = counts.needsAttention;
    const desktopBlocked = permission === 'denied' || permission === 'unsupported';

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-text-primary transition-colors duration-150',
                        'hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        open && 'bg-muted',
                        onInboxPage && 'ring-2 ring-primary/20'
                    )}
                    aria-label={
                        badge > 0
                            ? `Ops inbox, ${badge} items need attention`
                            : 'Ops inbox, clear'
                    }
                >
                    <Bell className="h-5 w-5" />
                    {badge > 0 ? (
                        <span
                            className={cn(
                                'absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white',
                                counts.highSeverity > 0 ? 'bg-destructive' : 'bg-primary'
                            )}
                        >
                            {badge > 99 ? '99+' : badge}
                        </span>
                    ) : null}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-[min(100vw-1.5rem,24rem)] overflow-hidden p-0"
            >
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary">Ops inbox</p>
                        <p className="text-[12px] text-text-secondary">
                            {badge === 0
                                ? 'Nothing waiting on you'
                                : `${badge} need${badge === 1 ? 's' : ''} attention`}
                        </p>
                    </div>
                    {canWriteNotifications && badge > 0 && opsNotificationIds(needsItems).length > 0 ? (
                        <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[12px] font-medium text-text-primary transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <CheckCheck className="h-3.5 w-3.5" />
                            Clear alerts
                        </button>
                    ) : null}
                </div>

                <div className="flex flex-col gap-2 border-b border-border bg-muted/30 px-3 py-2">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={toggleSound}
                            className={cn(
                                'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border text-[12px] font-medium transition-colors duration-150',
                                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                prefs.sound
                                    ? 'border-primary/30 bg-primary/10 text-primary'
                                    : 'border-border bg-card text-text-secondary hover:bg-muted hover:text-text-primary'
                            )}
                            aria-pressed={prefs.sound}
                        >
                            {prefs.sound ? (
                                <Volume2 className="h-3.5 w-3.5" />
                            ) : (
                                <VolumeX className="h-3.5 w-3.5" />
                            )}
                            Sound {prefs.sound ? 'on' : 'off'}
                        </button>
                        <button
                            type="button"
                            onClick={() => void toggleDesktop()}
                            disabled={desktopBlocked}
                            title={
                                permission === 'denied'
                                    ? 'Browser blocked notifications — enable them in site settings'
                                    : permission === 'unsupported'
                                      ? 'This browser does not support desktop notifications'
                                      : undefined
                            }
                            className={cn(
                                'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border text-[12px] font-medium transition-colors duration-150',
                                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                'disabled:cursor-not-allowed disabled:opacity-50',
                                prefs.desktop
                                    ? 'border-primary/30 bg-primary/10 text-primary'
                                    : 'border-border bg-card text-text-secondary hover:bg-muted hover:text-text-primary'
                            )}
                            aria-pressed={prefs.desktop}
                        >
                            <Bell className="h-3.5 w-3.5" />
                            Browser {prefs.desktop ? 'on' : 'off'}
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={toggleSms}
                            className={cn(
                                'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border text-[12px] font-medium transition-colors duration-150',
                                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                prefs.sms
                                    ? 'border-primary/30 bg-primary/10 text-primary'
                                    : 'border-border bg-card text-text-secondary hover:bg-muted hover:text-text-primary'
                            )}
                            aria-pressed={prefs.sms}
                            title="SMS your phone when new ops items appear while admin is open"
                        >
                            <MessageSquare className="h-3.5 w-3.5" />
                            SMS {prefs.sms ? 'on' : 'off'}
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleTestSms()}
                            disabled={smsTestState === 'sending'}
                            className={cn(
                                'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card text-[12px] font-medium text-text-primary transition-colors duration-150',
                                'hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                'disabled:cursor-not-allowed disabled:opacity-50',
                                smsTestState === 'ok' && 'border-primary/30 bg-primary/10 text-primary',
                                smsTestState === 'error' && 'border-destructive/30 bg-destructive/10 text-destructive'
                            )}
                        >
                            {smsTestState === 'sending'
                                ? 'Sending…'
                                : smsTestState === 'ok'
                                  ? 'Sent ✓'
                                  : smsTestState === 'error'
                                    ? 'Failed'
                                    : 'Test SMS'}
                        </button>
                    </div>
                    <p className="px-0.5 text-[11px] leading-snug text-text-hint">
                        Alerts go to +251941024355 · Test sends one message now
                    </p>
                </div>

                <div className="max-h-[min(70vh,28rem)] overflow-y-auto">
                    {preview.length === 0 ? (
                        <div className="flex flex-col items-center px-4 py-10 text-center">
                            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
                                <Inbox className="h-5 w-5" />
                            </div>
                            <p className="text-sm font-semibold text-text-primary">You&apos;re clear</p>
                            <p className="mt-1 max-w-[16rem] text-[12px] leading-relaxed text-text-secondary">
                                Pending payouts, document reviews, and ops alerts show up here.
                            </p>
                        </div>
                    ) : (
                        preview.map((item) => (
                            <OpsInboxRow
                                key={item.id}
                                item={item}
                                compact
                                onOpen={(opened) => {
                                    void handleOpenItem(opened);
                                    setOpen(false);
                                }}
                            />
                        ))
                    )}
                </div>

                <div className="border-t border-border bg-muted/40 px-2 py-2">
                    <Link
                        href="/admin/notifications"
                        onClick={() => setOpen(false)}
                        className="flex h-9 items-center justify-center rounded-md text-sm font-medium text-text-primary transition-colors hover:bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        Open full inbox
                        {needsItems.length > PREVIEW_LIMIT
                            ? ` · ${needsItems.length - PREVIEW_LIMIT} more`
                            : ''}
                    </Link>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
