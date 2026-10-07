import { execFileSync } from 'node:child_process';

/** Migrate and seed the throwaway test database once per run. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:amma_dev_pw@127.0.0.1:5433/amma_test';
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
  execFileSync('node_modules/.bin/prisma', ['migrate', 'deploy'], { env, stdio: 'pipe' });
  execFileSync('node', ['--import', 'tsx', '--conditions=react-server', 'prisma/seed.ts'], { env, stdio: 'pipe' });
}
