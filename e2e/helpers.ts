import { expect, type Page } from '@playwright/test';

/** Fail the test on any console error or CSP violation. */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return { assertClean: () => expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]) };
}

let counter = 0;
/** A unique valid Indian mobile number per call. */
export const newPhone = () => `9${String(Date.now()).slice(-6)}${String(100 + (counter++ % 900))}`.slice(0, 10);

/** Walk the login sheet or page: name, phone, consent, then the OTP shown in demo mode. */
export async function login(page: Page, phone: string, name = 'Lakshmi Rao') {
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Mobile number').fill(phone);
  await page.getByRole('checkbox', { name: /privacy notice/i }).check();
  await page.getByRole('button', { name: 'Send OTP' }).click();
  const code = (await page.locator('.demo b').textContent())!.trim();
  expect(code).toMatch(/^\d{6}$/);
  for (let i = 0; i < 6; i++) await page.getByLabel(`Digit ${i + 1}`).fill(code[i]!);
}

import pg from 'pg';
import type { Browser } from '@playwright/test';

export const db = () => new pg.Client({ connectionString: process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:amma_dev_pw@127.0.0.1:5433/amma_e2e' });

/** Create or update a staff account directly (staff are added by an admin, never by self sign-up). */
export async function upsertStaff(phone: string, name: string, role: string) {
  const c = db();
  await c.connect();
  await c.query(`INSERT INTO "User"(id, phone, name, role, "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, $3::"Role", now()) ON CONFLICT (phone) DO UPDATE SET role = $3::"Role", name = $2, active = true`, [phone, name, role]);
  await c.end();
}

/** A fresh browser session logged in as someone (a new person is created if the number is new). */
export async function sessionFor(browser: Browser, phone: string, name = 'Test Person') {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/login');
  await login(page, phone, name);
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  return { ctx, page };
}

export const tomorrowIst = () => new Date(Date.now() + 330 * 60_000 + 86_400_000).toISOString().slice(0, 10);
