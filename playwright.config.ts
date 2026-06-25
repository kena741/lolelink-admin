import { defineConfig, devices } from '@playwright/test';

const stagingReady =
    Boolean(process.env.E2E_ADMIN_EMAIL)
    && Boolean(process.env.E2E_ADMIN_PASSWORD)
    && Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: 'list',
    use: {
        baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3000',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: process.env.E2E_BASE_URL
        ? undefined
        : {
            command: 'pnpm dev',
            url: 'http://127.0.0.1:3000',
            reuseExistingServer: !process.env.CI,
        },
    grepInvert: stagingReady ? undefined : /@staging/,
});
