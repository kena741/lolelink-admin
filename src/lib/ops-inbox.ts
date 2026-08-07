import type { NotificationItem } from '@/features/notification/notificationSlice';
import type { PayoutRequest } from '@/features/payout/payoutSlice';
import type { VerifyDocument } from '@/features/verifyDocuments/verifyDocumentsSlice';

export type OpsCategory = 'finance' | 'documents' | 'bookings' | 'account' | 'system';
export type OpsSeverity = 'high' | 'medium' | 'low';
export type OpsSource = 'backlog' | 'notification';
export type OpsStatusFilter = 'needs' | 'all' | 'done';
export type OpsCategoryFilter = 'all' | OpsCategory;

export interface OpsInboxItem {
    id: string;
    source: OpsSource;
    category: OpsCategory;
    severity: OpsSeverity;
    title: string;
    body: string;
    href: string;
    createdAt: string | null;
    isRead: boolean;
    entityLabel?: string;
    metaLabel: string;
    notificationId?: string;
    canMarkRead: boolean;
}

export interface OpsInboxCounts {
    needsAttention: number;
    byCategory: Record<OpsCategory, number>;
    highSeverity: number;
}

const USER_LIFECYCLE_TYPES = new Set([
    'booking_created',
    'booking_payment_confirmed',
    'booking_accepted',
    'booking_rejected',
    'booking_cancelled',
    'booking_completed',
    'booking_status_updated',
    'payout_approved',
    'payout_rejected',
    'payout_completed',
    'provider_activation',
    'provider_activated',
    'activation_payment',
    'account',
    'general',
]);

const OPS_TYPE_CATALOG: Record<
    string,
    { category: OpsCategory; severity: OpsSeverity; title?: string; href?: string }
> = {
    payout_transfer_initiated: {
        category: 'finance',
        severity: 'medium',
        title: 'Payout transfer started',
        href: '/admin/finance/payout-request',
    },
    payout_transfer_success: {
        category: 'finance',
        severity: 'low',
        title: 'Payout transfer succeeded',
        href: '/admin/finance/payout-request',
    },
    payout_transfer_failed: {
        category: 'finance',
        severity: 'high',
        title: 'Payout transfer failed',
        href: '/admin/finance/payout-request',
    },
    payout_transfer_pending: {
        category: 'finance',
        severity: 'medium',
        title: 'Payout transfer pending',
        href: '/admin/finance/payout-request',
    },
    payout_request: {
        category: 'finance',
        severity: 'high',
        title: 'Payout request',
        href: '/admin/finance/payout-request',
    },
    document_pending: {
        category: 'documents',
        severity: 'high',
        title: 'Document needs review',
        href: '/admin/verify-documents',
    },
    document_verification: {
        category: 'documents',
        severity: 'high',
        title: 'Document needs review',
        href: '/admin/verify-documents',
    },
    fayda_pending: {
        category: 'documents',
        severity: 'high',
        title: 'Fayda verification pending',
        href: '/admin/verify-documents',
    },
};

const CATEGORY_META: Record<OpsCategory, { label: string; metaLabel: string }> = {
    finance: { label: 'Finance', metaLabel: 'Payout' },
    documents: { label: 'Documents', metaLabel: 'Document' },
    bookings: { label: 'Bookings', metaLabel: 'Booking' },
    account: { label: 'Account', metaLabel: 'Account' },
    system: { label: 'System', metaLabel: 'System' },
};

export function getOpsCategoryLabel(category: OpsCategory): string {
    return CATEGORY_META[category].label;
}

export function formatOpsRelativeTime(value?: string | null): string {
    if (!value) return 'Just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Just now';

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function normalizeType(type?: string | null): string {
    return (type ?? '').trim().toLowerCase();
}

function haystack(item: Pick<NotificationItem, 'type' | 'title' | 'description' | 'action_url'>): string {
    return [item.type, item.title, item.description, item.action_url]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

export function isOpsNotification(item: NotificationItem): boolean {
    const type = normalizeType(item.type);
    if (OPS_TYPE_CATALOG[type]) return true;

    const url = (item.action_url ?? '').trim();
    if (url.startsWith('/admin')) return true;

    const hasUserAudience = Boolean(item.provider_id || item.customer_id || item.handyman_id);
    if (!hasUserAudience) return true;

    if (USER_LIFECYCLE_TYPES.has(type)) return false;

    const text = haystack(item);
    if (/(transfer failed|webhook|reconcile|ops|admin|verify document|pending review)/.test(text)) {
        return true;
    }

    return false;
}

function classifyNotification(item: NotificationItem): {
    category: OpsCategory;
    severity: OpsSeverity;
    title: string;
    href: string;
} {
    const type = normalizeType(item.type);
    const catalog = OPS_TYPE_CATALOG[type];
    const text = haystack(item);

    let category: OpsCategory = catalog?.category ?? 'system';
    let severity: OpsSeverity = catalog?.severity ?? 'medium';

    if (!catalog) {
        if (/(payout|withdraw|wallet|transfer|chapa|payment)/.test(text)) category = 'finance';
        else if (/(document|fayda|national.?id|kyc|verify)/.test(text)) category = 'documents';
        else if (/(booking|job|service request)/.test(text)) category = 'bookings';
        else if (/(provider|activation|account|handyman)/.test(text)) category = 'account';

        if (/(fail|error|reject|decline|stuck|invalid|expired)/.test(text)) severity = 'high';
        else if (/(success|completed|done|confirmed)/.test(text)) severity = 'low';
    }

    const href =
        catalog?.href ||
        item.action_url ||
        (item.booking_id
            ? '/admin/bookings'
            : item.provider_id
              ? `/admin/providers/${item.provider_id}`
              : category === 'finance'
                ? '/admin/finance/payout-request'
                : category === 'documents'
                  ? '/admin/verify-documents'
                  : '/admin/dashboard');

    const title = catalog?.title || item.title?.trim() || 'Ops update';

    return { category, severity, title, href };
}

function formatCurrencyEtb(amount: string | number): string {
    const n = typeof amount === 'number' ? amount : Number(amount);
    if (!Number.isFinite(n)) return String(amount);
    return `ETB ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function buildBacklogItems(
    payouts: PayoutRequest[],
    documents: VerifyDocument[]
): OpsInboxItem[] {
    const items: OpsInboxItem[] = [];

    for (const payout of payouts) {
        if (payout.paymentStatus !== 'pending' && payout.paymentStatus !== 'approved') continue;
        const isPending = payout.paymentStatus === 'pending';
        items.push({
            id: `backlog-payout-${payout.id}`,
            source: 'backlog',
            category: 'finance',
            severity: 'high',
            title: isPending ? 'Payout awaiting decision' : 'Payout approved — complete transfer',
            body: `${payout.provider_name || 'Provider'} · ${formatCurrencyEtb(payout.amount)}`,
            href: '/admin/finance/payout-request',
            createdAt: payout.createdDate ?? null,
            isRead: false,
            entityLabel: payout.provider_name || undefined,
            metaLabel: 'Payout',
            canMarkRead: false,
        });
    }

    const pendingDocs = documents.filter((doc) => doc.isVerify === null);
    const byProvider = new Map<string, VerifyDocument[]>();
    for (const doc of pendingDocs) {
        const key = doc.providerId || doc.id;
        const list = byProvider.get(key) ?? [];
        list.push(doc);
        byProvider.set(key, list);
    }

    for (const [, group] of byProvider) {
        const first = group[0];
        if (!first) continue;
        const providerName = first.providerName?.trim() || 'Provider';
        const count = group.length;
        const newest = group
            .map((d) => d.createdAt)
            .filter(Boolean)
            .sort()
            .at(-1) ?? null;

        items.push({
            id: `backlog-docs-${first.providerId || first.id}`,
            source: 'backlog',
            category: 'documents',
            severity: 'high',
            title:
                count === 1
                    ? 'Document awaiting review'
                    : `${count} documents awaiting review`,
            body:
                count === 1
                    ? `${providerName} · ${first.documentName || 'Document'}`
                    : `${providerName} · ${count} files need a decision`,
            href: '/admin/verify-documents',
            createdAt: newest,
            isRead: false,
            entityLabel: providerName,
            metaLabel: 'Document',
            canMarkRead: false,
        });
    }

    return items;
}

function buildNotificationItems(notifications: NotificationItem[]): OpsInboxItem[] {
    return notifications.filter(isOpsNotification).map((item) => {
        const classified = classifyNotification(item);
        return {
            id: `notification-${item.id}`,
            source: 'notification' as const,
            category: classified.category,
            severity: classified.severity,
            title: classified.title,
            body: (item.description ?? '').trim() || 'Open to review details.',
            href: classified.href,
            createdAt: item.created_at ?? null,
            isRead: Boolean(item.is_read),
            metaLabel: CATEGORY_META[classified.category].metaLabel,
            notificationId: item.id,
            canMarkRead: true,
        };
    });
}

function severityRank(severity: OpsSeverity): number {
    if (severity === 'high') return 0;
    if (severity === 'medium') return 1;
    return 2;
}

function timeRank(value: string | null): number {
    if (!value) return 0;
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
}

export function buildOpsInbox(input: {
    notifications: NotificationItem[];
    payouts: PayoutRequest[];
    documents: VerifyDocument[];
}): OpsInboxItem[] {
    const items = [
        ...buildBacklogItems(input.payouts, input.documents),
        ...buildNotificationItems(input.notifications),
    ];

    items.sort((a, b) => {
        if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
        const severityDiff = severityRank(a.severity) - severityRank(b.severity);
        if (severityDiff !== 0) return severityDiff;
        return timeRank(b.createdAt) - timeRank(a.createdAt);
    });

    return items;
}

export function filterOpsInbox(
    items: OpsInboxItem[],
    options: {
        status: OpsStatusFilter;
        category: OpsCategoryFilter;
        search?: string;
    }
): OpsInboxItem[] {
    const q = (options.search ?? '').trim().toLowerCase();

    return items.filter((item) => {
        if (options.status === 'needs' && item.isRead) return false;
        if (options.status === 'done' && !item.isRead) return false;
        if (options.category !== 'all' && item.category !== options.category) return false;
        if (!q) return true;
        const blob = [item.title, item.body, item.entityLabel, item.metaLabel, item.category]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return blob.includes(q);
    });
}

export function countOpsInbox(items: OpsInboxItem[]): OpsInboxCounts {
    const byCategory: Record<OpsCategory, number> = {
        finance: 0,
        documents: 0,
        bookings: 0,
        account: 0,
        system: 0,
    };

    let needsAttention = 0;
    let highSeverity = 0;

    for (const item of items) {
        if (!item.isRead) {
            needsAttention += 1;
            byCategory[item.category] += 1;
            if (item.severity === 'high') highSeverity += 1;
        }
    }

    return { needsAttention, byCategory, highSeverity };
}

export function opsNotificationIds(items: OpsInboxItem[]): string[] {
    return items
        .filter((item) => item.canMarkRead && item.notificationId && !item.isRead)
        .map((item) => item.notificationId as string);
}
