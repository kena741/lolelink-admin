import { beforeEach, describe, expect, it, vi } from 'vitest';

const logAdminActivity = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/admin-activity-log', () => ({
    logAdminActivity: (...args: unknown[]) => logAdminActivity(...args),
}));

vi.mock('@/lib/admin-auth', () => ({
    requireAdminPermission: vi.fn().mockResolvedValue({ ok: true }),
}));

const existingBanner = {
    id: 1,
    bannerName: 'Old Banner',
    image: 'https://img/old.png',
    link: 'https://old.example',
};

const updatedBanner = {
    id: 1,
    bannerName: 'New Banner',
    image: 'https://img/old.png',
    link: 'https://old.example',
};

vi.mock('@/lib/supabaseAdmin', () => ({
    getSupabaseAdminFromRequest: vi.fn(() => ({
        from: vi.fn((table: string) => {
            if (table !== 'banner') throw new Error(`Unexpected table: ${table}`);
            let call = 0;
            return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => {
                            call += 1;
                            if (call === 1) return { data: existingBanner, error: null };
                            return { data: null, error: null };
                        }),
                        single: vi.fn(async () => ({ data: updatedBanner, error: null })),
                    })),
                })),
                update: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        select: vi.fn(() => ({
                            single: vi.fn(async () => ({ data: updatedBanner, error: null })),
                        })),
                    })),
                })),
            };
        }),
    })),
}));

describe('PATCH /api/banners', () => {
    beforeEach(() => {
        logAdminActivity.mockClear();
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new Error('fetch blocked in unit tests'))
        );
    });

    it('logs update with before/after metadata', async () => {
        const { PATCH } = await import('@/app/api/banners/route');
        const request = new Request('https://admin.test.local/api/banners', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 1, bannerName: 'New Banner' }),
        });

        const response = await PATCH(request);
        expect(response.status).toBe(200);
        expect(logAdminActivity).toHaveBeenCalledTimes(1);
        expect(logAdminActivity).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'update',
                resource_type: 'banner',
                resource_id: '1',
                metadata: {
                    changes: [
                        {
                            field: 'bannerName',
                            before: 'Old Banner',
                            after: 'New Banner',
                        },
                    ],
                },
            })
        );
    });
});
