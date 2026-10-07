import { execFileSync } from 'node:child_process';
import pg from 'pg';

/** A throwaway database for the browser tests: create it if needed, migrate, seed. Run before the server starts. */
async function main() {
  const url = process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:amma_dev_pw@127.0.0.1:5433/amma_e2e';
  const u = new URL(url);
  const dbName = u.pathname.slice(1);
  const admin = new pg.Client({ connectionString: new URL('/postgres', url).toString() });
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${dbName}"`);
  } catch (e) {
    if ((e as { code?: string }).code !== '42P04') {
      // 42P04 = already exists. Anything else (e.g. CI where the database was pre-created and /postgres is off limits) is fine to ignore if the target is reachable.
    }
  } finally {
    await admin.end().catch(() => undefined);
  }
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
  execFileSync('node_modules/.bin/prisma', ['migrate', 'deploy'], { env, stdio: 'pipe' });
  execFileSync('node', ['--import', 'tsx', '--conditions=react-server', 'prisma/seed.ts'], { env: { ...env, SEED_ADMIN_PHONE: '9000000000', SEED_ADMIN_NAME: 'E2E Admin' }, stdio: 'pipe' });
  // Fresh people and orders every run.
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query(`TRUNCATE "Notification","AuditLog","WebhookEvent","Payment","Report","Result","Sample","OrderItem","Order","Prescription","CallbackRequest","Patient","Address","Session","OtpRequest","RateLimit" RESTART IDENTITY CASCADE`);
  await c.query(`DELETE FROM "User" WHERE phone <> '9000000000'`);
  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
