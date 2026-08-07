'use client';

import { useEffect, useRef, useState } from 'react';
import type { OpsInboxItem } from '@/lib/ops-inbox';
import {
    loadOpsDeskAlertPrefs,
    playOpsInboxSound,
    saveOpsDeskAlertPrefs,
    showOpsDesktopNotification,
    unlockOpsAlertAudio,
    type OpsDeskAlertPrefs,
} from '@/lib/ops-inbox-alerts';

export function useOpsInboxAlerts(needsItems: OpsInboxItem[], ready: boolean) {
    const [prefs, setPrefs] = useState<OpsDeskAlertPrefs>(() => loadOpsDeskAlertPrefs());
    const seenRef = useRef<Set<string> | null>(null);

    useEffect(() => {
        setPrefs(loadOpsDeskAlertPrefs());
    }, []);

    useEffect(() => {
        if (!ready) {
            seenRef.current = null;
            return;
        }

        const currentIds = needsItems.map((item) => item.id);

        // Baseline after first ready snapshot so login backlog does not spam.
        if (seenRef.current === null) {
            seenRef.current = new Set(currentIds);
            return;
        }

        const newcomers = currentIds.filter((id) => !seenRef.current!.has(id));
        seenRef.current = new Set(currentIds);

        if (newcomers.length === 0) return;

        const newItems = needsItems.filter((item) => newcomers.includes(item.id));
        const hasUrgent = newItems.some((item) => item.severity === 'high');

        if (prefs.sound) {
            playOpsInboxSound({ urgent: hasUrgent });
        }

        if (prefs.desktop) {
            if (newItems.length === 1) {
                const item = newItems[0];
                if (item) {
                    showOpsDesktopNotification({
                        title: item.title,
                        body: item.body,
                        href: item.href,
                        tag: item.id,
                    });
                }
            } else {
                const highCount = newItems.filter((item) => item.severity === 'high').length;
                showOpsDesktopNotification({
                    title: `${newItems.length} new ops items`,
                    body:
                        highCount > 0
                            ? `${highCount} high priority · open the ops inbox`
                            : 'Open the ops inbox to review',
                    href: '/admin/notifications',
                    tag: `ops-batch-${Date.now()}`,
                });
            }
        }
    }, [needsItems, prefs.desktop, prefs.sound, ready]);

    function updatePrefs(next: OpsDeskAlertPrefs) {
        if (next.sound || next.desktop) {
            unlockOpsAlertAudio();
        }
        setPrefs(next);
        saveOpsDeskAlertPrefs(next);
    }

    return { prefs, updatePrefs };
}
