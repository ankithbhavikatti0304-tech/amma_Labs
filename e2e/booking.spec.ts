import { expect, test } from '@playwright/test';
import { login, newPhone, watchConsole } from './helpers';

test('a patient finds a test, books it, and tracks the order', async ({ page }) => {
  const console_ = watchConsole(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Lab tests at home');

  // Search as you type: opens with "/", results appear without leaving the page.
  await page.keyboard.press('/');
  await page.getByRole('searchbox', { name: 'Search tests' }).fill('thyroid');
  const first = page.locator('.pal-row').first();
  await expect(first).toContainText(/thyroid/i);
  await first.getByRole('button', { name: /^Add/ }).click();
  await page.keyboard.press('Escape');

  // The cart updates at once and the dock appears.
  await expect(page.locator('.count')).toHaveText('1');
  await expect(page.locator('.dock.show')).toBeVisible();

  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: /1 test added/ })).toBeVisible();
  // Under ₹499 so a collection fee applies
  await page.getByRole('button', { name: 'Apply' }).first().click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Logged out → login sheet → OTP → straight on to checkout.
  await login(page, newPhone());
  await expect(page).toHaveURL(/\/checkout$/);

  await page.getByLabel('Age').fill('34');
  await page.getByLabel('Gender').selectOption('FEMALE');
  await page.getByLabel('House, street, area').fill('12, 4th Cross, Indiranagar');
  await page.getByLabel('Pincode').fill('560038');
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByText('Pick a time slot.')).toBeVisible();

  await page.getByRole('group', { name: 'Time' }).getByRole('button', { name: '10 am–12 pm' }).click();
  await page.getByRole('button', { name: /Place order/ }).click();

  await expect(page).toHaveURL(/\/orders\/AL-[A-Z0-9]{6}\/confirmed$/);
  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible();
  const code = page.url().match(/AL-[A-Z0-9]{6}/)![0];

  await page.goto('/orders');
  await expect(page.getByText(code)).toBeVisible();
  await expect(page.getByRole('list', { name: 'Order progress' })).toBeVisible();
  console_.assertClean();
});

test('fasting tests only offer morning slots', async ({ page }) => {
  await page.goto('/test/glucose-fasting');
  await page.getByRole('button', { name: 'Add Glucose – Fasting' }).click();
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Continue' }).click();
  await login(page, newPhone());
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByText(/Only morning slots are open/)).toBeVisible();
  const time = page.getByRole('group', { name: 'Time' });
  await expect(time.getByRole('button', { name: '6–8 am' })).toBeEnabled();
  await expect(time.getByRole('button', { name: '4–6 pm' })).toBeDisabled();
});

test('someone logged out is sent to log in, and back, for checkout', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page).toHaveURL(/\/login\?next=%2Fcheckout/);
});

test('a wrong OTP is rejected without logging in', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Your name').fill('Test User');
  await page.getByLabel('Mobile number').fill(newPhone());
  await page.getByRole('checkbox', { name: /privacy notice/i }).check();
  await page.getByRole('button', { name: 'Send OTP' }).click();
  const code = (await page.locator('.demo b').textContent())!.trim();
  const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 6; i++) await page.getByLabel(`Digit ${i + 1}`).fill(wrong[i]!);
  await expect(page.getByText(/doesn't match/)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('nothing scrolls sideways at any common width, and the nav fits inside its bar', async ({ page, isMobile }) => {
  test.skip(isMobile, 'resizes the window, which is meaningless on the phone profile');
  for (const width of [360, 390, 768, 1024, 1221, 1280, 1366, 1440, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ['/', '/tests']) {
      await page.goto(path);
      const m = await page.evaluate(() => {
        const nav = document.querySelector('.nav-in')!;
        return { page: document.documentElement.scrollWidth - window.innerWidth, nav: nav.scrollWidth - nav.clientWidth };
      });
      expect(m.page, `${path} at ${width}px overflows the page by ${m.page}px`).toBeLessThanOrEqual(0);
      expect(m.nav, `the nav bar at ${width}px is ${m.nav}px too narrow for its contents`).toBeLessThanOrEqual(0);
    }
  }
});

test('@mobile nothing scrolls sideways at phone width', async ({ page }) => {
  for (const path of ['/', '/tests', '/category/thyroid', '/cart', '/privacy']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});
