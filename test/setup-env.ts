import { vi } from 'vitest';

// Next's data cache needs a running Next server; in tests, run the function directly.
vi.mock('next/cache', () => ({ unstable_cache: <T extends (...a: never[]) => unknown>(fn: T) => fn, revalidateTag: () => undefined, revalidatePath: () => undefined }));

// Runs inside each integration test worker, before any app code.
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:amma_dev_pw@127.0.0.1:5433/amma_test';
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: url,
  APP_URL: 'http://localhost:3000',
  APP_SECRET: 'test-secret-test-secret-test-secret-0123456789',
  SMS_PROVIDER: 'dev',
  PAYMENT_PROVIDER: 'mock',
  STORAGE_DRIVER: 'local',
  LOCAL_STORAGE_DIR: '.storage-test',
  LOG_LEVEL: 'error',
});
