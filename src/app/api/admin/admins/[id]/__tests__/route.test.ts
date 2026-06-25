import { beforeEach, describe, expect, it, vi } from 'vitest';

const logAdminActivity = vi.fn().mockResolvedValue(undefined);
const updateUserById = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/admin-activity-log', () => ({
    logAdminActivity: (...args: unknown[]) => logAdminActivity(...args),
}));

vi.mock('@/lib/admin-auth', () => ({
    requireAdminPermission: vi.fn().mockResolvedValue({
        ok: true,
        context: { adminId: 'admin-1', role: 'super_admin', permissions: ['*'] },
    }),
}));

const existingAdmin = {
    user_id: 'user-1',
    full_name: 'Jane Admin',
    role: 'editor',
    is_active: true,
};

const updatedAdmin = {
    id: 'admin-1',
    user_id: 'user-1',
    full_name: 'Jane Admin',
    role: 'editor',
    is_active: true,
    created_at: '2024-01-01',
    updated_at: '2024-06-01',
};

vi.mock('@/lib/supabaseAdmin', () => ({
    getSupabaseAdminFromRequest: vi.fn(() => ({
        from: vi.fn((table: string) => {
            if (table === 'admin_role') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle: vi.fn(async () => ({ data: { slug: 'editor' }, error: null })),
                        })),
                    })),
                };
            }
            if (table === 'admin') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle: vi.fn(async () => ({ data: existingAdmin, error: null })),
                            single: vi.fn(async () => ({ data: updatedAdmin, error: null })),
                        })),
                    })),
                    update: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            select: vi.fn(() => ({
                                single: vi.fn(async () => ({ data: updatedAdmin, error: null })),
                            })),
                        })),
                    })),
                };
            }
            throw new Error(`Unexpected table: ${table}`);
        }),
        auth: {
            admin: {
                updateUserById,
            },
        },
    })),
}));

describe('PATCH /api/admin/admins/[id]', () => {
    beforeEach(() => {
        logAdminActivity.mockClear();
        updateUserById.mockClear();
    });

    it('logs password change with hidden before/after values', async () => {
        const { PATCH } = await import('@/app/api/admin/admins/[id]/route');
        const request = new Request('https://admin.test.local/api/admin/admins/admin-1', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'newpass123' }),
        });

        const response = await PATCH(request, {
            params: Promise.resolve({ id: 'admin-1' }),
        });
        expect(response.status).toBe(200);
        expect(updateUserById).toHaveBeenCalled();
        expect(logAdminActivity).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'update',
                resource_type: 'admin',
                resource_id: 'admin-1',
                metadata: {
                    changes: [
                        {
                            field: 'password',
                            label: 'Password',
                            before: '[hidden]',
                            after: '[changed]',
                        },
                    ],
                },
            })
        );
    });
});

describe('DELETE /api/admin/admins/[id]', () => {
    beforeEach(() => {
        logAdminActivity.mockClear();
    });

    it('rejects deleting the currently signed-in admin', async () => {
        const { DELETE } = await import('@/app/api/admin/admins/[id]/route');
        const request = new Request('https://admin.test.local/api/admin/admins/admin-1', {
            method: 'DELETE',
        });

        const response = await DELETE(request, {
            params: Promise.resolve({ id: 'admin-1' }),
        });
        const payload = (await response.json()) as { error?: string };

        expect(response.status).toBe(403);
        expect(payload.error).toMatch(/cannot delete your own/i);
        expect(logAdminActivity).not.toHaveBeenCalled();
    });
});
