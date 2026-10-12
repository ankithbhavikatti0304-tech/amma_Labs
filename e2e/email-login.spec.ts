import { expect, test } from '@playwright/test';
import { expectAccessible, newPhone } from './helpers';

/** Only runs when the site is started in email sign-in mode: E2E_LOGIN_METHOD=email npx playwright test e2e/email-login.spec.ts */
test.skip(process.env.E2E_LOGIN_METHOD !== 'email', 'needs the site in email sign-in mode');

const uniqueEmail = () => `person${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;

async function fillAndSend(page: import('@playwright/test').Page, email: string, phone: string, name = 'Lakshmi Rao') {
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Mobile number (for the pickup call)').fill(phone);
  await page.getByRole('checkbox', { name: /privacy notice/i }).check();
  await page.getByRole('button', { name: 'Email me a code' }).click();
}

test('the login page asks for an email address and a contact mobile number, and is accessible', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Mobile number (for the pickup call)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Email me a code' })).toBeVisible();
  await expectAccessible(page, '/login in email mode');
});

test('a patient signs in with an emailed code and the site shows their email', async ({ page }) => {
  const email = uniqueEmail();
  await page.goto('/login');
  await fillAndSend(page, email, newPhone());
  await expect(page.getByText(`Emailed to ${email}`)).toBeVisible();
  const code = (await page.locator('.demo b').textContent())!.trim();
  expect(code).toMatch(/^\d{6}$/);
  for (let i = 0; i < 6; i++) await page.getByLabel(`Digit ${i + 1}`).fill(code[i]!);
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  await page.goto('/orders');
  await expect(page.getByText(email)).toBeVisible();
});

test('a wrong code is refused and the person stays signed out', async ({ page }) => {
  await page.goto('/login');
  await fillAndSend(page, uniqueEmail(), newPhone());
  const code = (await page.locator('.demo b').textContent())!.trim();
  const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 6; i++) await page.getByLabel(`Digit ${i + 1}`).fill(wrong[i]!);
  await expect(page.getByText(/doesn.t match/i)).toBeVisible();
  await page.goto('/checkout');
  await expect(page).toHaveURL(/\/login/);
});

test('the mobile-number sign-in endpoints are closed on an email site', async ({ page }) => {
  await page.goto('/login');
  const status = await page.evaluate(async () => (await fetch('/api/auth/otp/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '9876543210', name: 'Lakshmi Rao', consent: true }) })).status);
  expect(status).toBe(404);
});

test('an email-signed-in patient can book a test and see it in their orders', async ({ page }) => {
  const email = uniqueEmail();
  await page.goto('/');
  await page.keyboard.press('/');
  await page.getByRole('searchbox', { name: 'Search tests' }).fill('thyroid');
  await page.locator('.pal-row').first().getByRole('button', { name: /^Add/ }).click();
  await page.keyboard.press('Escape');
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Continue' }).click();

  // The login sheet opens; sign in by email, then straight on to checkout.
  await fillAndSend(page, email, newPhone());
  const code = (await page.locator('.demo b').textContent())!.trim();
  for (let i = 0; i < 6; i++) await page.getByLabel(`Digit ${i + 1}`).fill(code[i]!);
  await expect(page).toHaveURL(/\/checkout$/);

  await page.getByLabel('Age').fill('34');
  await page.getByLabel('Gender').selectOption('FEMALE');
  await page.getByLabel('House, street, area').fill('12, 4th Cross, Indiranagar');
  await page.getByLabel('Pincode').fill('560038');
  await page.getByRole('group', { name: 'Time' }).getByRole('button', { name: '10 am–12 pm' }).click();
  await page.getByRole('button', { name: /Place order/ }).click();
  await expect(page).toHaveURL(/\/orders\/AL-[A-Z0-9]{6}\/confirmed$/);
  const orderCode = page.url().match(/AL-[A-Z0-9]{6}/)![0];

  await page.goto('/orders');
  await expect(page.getByText(orderCode)).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
});
