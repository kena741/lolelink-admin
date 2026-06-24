import { beforeEach, describe, expect, it, vi } from 'vitest';

const logAdminActivity = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/admin-activity-log', () => ({
    logAdminActivity: (...args: unknown[]) => logAdminActivity(...args),
}));

vi.mock('@/lib/admin-auth', () => ({
    requireAdminSession: vi.fn().mockResolvedValue({ ok: true }),
}));

describe('POST /api/admin/activity-logs', () => {
    beforeEach(() => {
        logAdminActivity.mockClear();
    });

    it('accepts client activity payload and forwards to logAdminActivity', async () => {
        const { POST } = await import('@/app/api/admin/activity-logs/route');
        const request = new Request('https://admin.test.local/api/admin/activity-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'create',
                resource_type: 'coupon',
                resource_id: '42',
                summary: 'Created coupon SAVE10',
                metadata: { code: 'SAVE10' },
            }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
        expect(logAdminActivity).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'create',
                resource_type: 'coupon',
                resource_id: '42',
                summary: 'Created coupon SAVE10',
                metadata: { code: 'SAVE10' },
            })
        );
    });

    it('returns 400 when required fields are missing', async () => {
        const { POST } = await import('@/app/api/admin/activity-logs/route');
        const request = new Request('https://admin.test.local/api/admin/activity-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create' }),
        });

        const response = await POST(request);
        expect(response.status).toBe(400);
        expect(logAdminActivity).not.toHaveBeenCalled();
    });
});
