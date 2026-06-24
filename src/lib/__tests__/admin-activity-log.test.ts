import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logAdminActivity } from '@/lib/admin-activity-log';

const insertMock = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/supabase-env', () => ({
    getSupabaseAdminFromRequest: vi.fn(() => ({
        from: vi.fn(() => ({
            insert: insertMock,
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                        data: {
                            id: 'admin-1',
                            full_name: 'Test Admin',
                            role: 'super_admin',
                            user_id: 'user-1',
                        },
                    }),
                })),
            })),
        })),
    })),
    getSupabaseTargetFromRequest: vi.fn(() => 'test'),
}));

vi.mock('@/lib/supabase-server', () => ({
    createSupabaseServerClientFromRequest: vi.fn(async () => ({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: 'user-1', email: 'admin@test.local' } },
            }),
        },
    })),
}));

describe('logAdminActivity', () => {
    beforeEach(() => {
        insertMock.mockClear();
    });

    it('inserts sanitized activity log row via mock client', async () => {
        const request = new Request('https://admin.test.local/api/banners', { method: 'PATCH' });

        await logAdminActivity({
            request,
            action: 'update',
            resource_type: 'banner',
            resource_id: '1',
            summary: 'Updated banner Home',
            metadata: {
                changes: [{ field: 'bannerName', before: 'A', after: 'B' }],
                password: 'should-redact',
            },
        });

        expect(insertMock).toHaveBeenCalledTimes(1);
        const payload = insertMock.mock.calls[0][0];
        expect(payload).toMatchObject({
            admin_id: 'admin-1',
            admin_email: 'admin@test.local',
            admin_name: 'Test Admin',
            admin_role: 'super_admin',
            action: 'update',
            resource_type: 'banner',
            resource_id: '1',
            route: '/api/banners',
            summary: 'Updated banner Home',
            env: 'test',
        });
        expect(payload.metadata.password).toBe('[redacted]');
    });

    it('records null actor when no authenticated user', async () => {
        const { createSupabaseServerClientFromRequest } = await import('@/lib/supabase-server');
        vi.mocked(createSupabaseServerClientFromRequest).mockResolvedValueOnce({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
            },
        } as never);

        const request = new Request('https://admin.test.local/api/payout/chapa-webhook', {
            method: 'POST',
        });

        await logAdminActivity({
            request,
            action: 'complete',
            resource_type: 'payout',
            resource_id: 'wd-1',
            summary: 'Webhook completed payout',
            metadata: { source: 'chapa_webhook' },
        });

        const payload = insertMock.mock.calls[0][0];
        expect(payload.admin_id).toBeNull();
        expect(payload.admin_email).toBeNull();
        expect(payload.metadata).toEqual({ source: 'chapa_webhook' });
    });
});
