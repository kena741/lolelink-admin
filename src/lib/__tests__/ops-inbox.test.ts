import { describe, expect, it } from 'vitest';
import {
    buildOpsInbox,
    filterOpsInbox,
    isOpsNotification,
    opsNotificationIds,
} from '@/lib/ops-inbox';
import type { NotificationItem } from '@/features/notification/notificationSlice';

function notif(partial: Partial<NotificationItem> & { id: string }): NotificationItem {
    return {
        is_read: false,
        ...partial,
    };
}

describe('ops-inbox', () => {
    it('keeps admin-targeted rows and drops user lifecycle spam', () => {
        expect(
            isOpsNotification(
                notif({
                    id: '1',
                    type: 'payout_transfer_failed',
                    title: 'Transfer failed',
                    description: 'Chapa failed',
                })
            )
        ).toBe(true);

        expect(
            isOpsNotification(
                notif({
                    id: '2',
                    type: 'booking_created',
                    title: 'New Booking',
                    provider_id: 'p1',
                    booking_id: 'b1',
                })
            )
        ).toBe(false);
    });

    it('builds backlog from pending payouts and grouped documents', () => {
        const items = buildOpsInbox({
            notifications: [],
            payouts: [
                {
                    id: 'w1',
                    providerId: 'p1',
                    provider_name: 'Amina',
                    amount: 500,
                    paymentStatus: 'pending',
                    createdDate: '2026-08-01T10:00:00.000Z',
                },
            ],
            documents: [
                {
                    id: 'd1',
                    providerId: 'p9',
                    providerName: 'Beza',
                    documentName: 'National ID',
                    isVerify: null,
                    createdAt: '2026-08-02T10:00:00.000Z',
                },
                {
                    id: 'd2',
                    providerId: 'p9',
                    providerName: 'Beza',
                    documentName: 'License',
                    isVerify: null,
                    createdAt: '2026-08-03T10:00:00.000Z',
                },
                {
                    id: 'd3',
                    providerId: 'p2',
                    providerName: 'Done',
                    isVerify: true,
                },
            ],
        });

        expect(items).toHaveLength(2);
        expect(items.some((i) => i.category === 'finance')).toBe(true);
        expect(items.find((i) => i.category === 'documents')?.title).toMatch(/2 documents/);
    });

    it('filters needs-attention and collects markable notification ids', () => {
        const items = buildOpsInbox({
            notifications: [
                notif({
                    id: 'n1',
                    type: 'payout_transfer_failed',
                    title: 'Failed',
                    description: 'x',
                    is_read: false,
                }),
                notif({
                    id: 'n2',
                    type: 'payout_transfer_success',
                    title: 'Ok',
                    description: 'y',
                    is_read: true,
                }),
            ],
            payouts: [],
            documents: [],
        });

        const needs = filterOpsInbox(items, { status: 'needs', category: 'all' });
        expect(needs).toHaveLength(1);
        expect(opsNotificationIds(items)).toEqual(['n1']);
    });
});
