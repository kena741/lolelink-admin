import { beforeEach, describe, expect, it, vi } from 'vitest';

const logAdminActivity = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/admin-activity-log', () => ({
    logAdminActivity: (...args: unknown[]) => logAdminActivity(...args),
}));

vi.mock('@/lib/admin-auth', () => ({
    requireAdminPermission: vi.fn().mockResolvedValue({ ok: true }),
}));

const existingJob = { id: 'job-1', status: 'pending', accepted: false };

vi.mock('@/lib/supabaseAdmin', () => ({
    getSupabaseAdminFromRequest: vi.fn(() => ({
        from: vi.fn((table: string) => {
            if (table !== 'job_request') throw new Error(`Unexpected table: ${table}`);
            return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({ data: existingJob, error: null })),
                    })),
                })),
                update: vi.fn(() => ({
                    eq: vi.fn(async () => ({ error: null })),
                })),
            };
        }),
    })),
}));

describe('PATCH /api/job-requests', () => {
    beforeEach(() => {
        logAdminActivity.mockClear();
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new Error('fetch blocked in unit tests'))
        );
    });

    it('logs approve action when accepting a job request', async () => {
        const { PATCH } = await import('@/app/api/job-requests/route');
        const request = new Request('https://admin.test.local/api/job-requests', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 'job-1', action: 'accept' }),
        });

        const response = await PATCH(request);
        expect(response.status).toBe(200);
        expect(logAdminActivity).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'approve',
                resource_type: 'job_request',
                resource_id: 'job-1',
            })
        );
    });

    it('logs reject action when rejecting a job request', async () => {
        const { PATCH } = await import('@/app/api/job-requests/route');
        const request = new Request('https://admin.test.local/api/job-requests', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 'job-1', action: 'reject' }),
        });

        await PATCH(request);
        expect(logAdminActivity).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'reject',
                resource_type: 'job_request',
            })
        );
    });
});
