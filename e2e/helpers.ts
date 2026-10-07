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
