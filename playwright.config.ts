import { defineConfig, devices } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';

// The sandbox ships Chromium under PLAYWRIGHT_BROWSERS_PATH; CI installs Playwright's own.
function chromiumPath(): string | undefined {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !existsSync(base)) return undefined;
  const dir = readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().pop();
  return dir ? [`${base}/${dir}/chrome-linux/chrome`, `${base}/${dir}/chrome-linux64/chrome`].find(existsSync) : undefined;
}

const PORT = 3100;
const DB = process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:amma_dev_pw@127.0.0.1:5433/amma_e2e';
const launchOptions = { executablePath: chromiumPath() };

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', launchOptions, reducedMotion: 'reduce' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions }, grep: /@mobile/ },
  ],
  webServer: {
    // Serves the production build, which is what ships. Run `npm run build` first.
    command: `node --import tsx e2e/prepare-db.ts && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 90_000,
    env: {
      DATABASE_URL: DB,
      E2E_DATABASE_URL: DB,
      APP_URL: `http://localhost:${PORT}`,
      APP_SECRET: 'e2e-secret-e2e-secret-e2e-secret-0123456789',
      ALLOW_DEV_PROVIDERS: 'true',
      SMS_PROVIDER: 'dev',
      PAYMENT_PROVIDER: 'mock',
      STORAGE_DRIVER: 'local',
      LOCAL_STORAGE_DIR: '.storage-e2e',
    },
  },
});
