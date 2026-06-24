import { expect, test } from '@playwright/test';

const hasStagingCredentials =
    Boolean(process.env.E2E_ADMIN_EMAIL) && Boolean(process.env.E2E_ADMIN_PASSWORD);

test.describe('activity logs @staging', () => {
    test.skip(!hasStagingCredentials, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run staging E2E');

    test('banner create appears on activity logs page', async ({ page }) => {
        const email = process.env.E2E_ADMIN_EMAIL as string;
        const password = process.env.E2E_ADMIN_PASSWORD as string;
        const bannerName = `e2e-test-${Date.now()}`;

        await page.goto('/login');
        await page.getByLabel(/email/i).fill(email);
        await page.getByLabel(/password/i).fill(password);
        await page.getByRole('button', { name: /sign in|login/i }).click();
        await page.waitForURL(/\/admin/);

        const createResponse = await page.request.post('/api/banners', {
            data: {
                bannerName,
                image: 'https://example.com/e2e-banner.png',
                link: 'https://example.com',
            },
        });
        expect(createResponse.ok()).toBeTruthy();
        const created = (await createResponse.json()) as { data?: { id?: number } };
        const bannerId = created.data?.id;

        await page.goto('/admin/activity-logs');
        await expect(page.getByText(`Created banner ${bannerName}`)).toBeVisible({ timeout: 15000 });

        if (bannerId) {
            await page.request.delete('/api/banners', {
                data: { id: bannerId },
            });
        }
    });
});
