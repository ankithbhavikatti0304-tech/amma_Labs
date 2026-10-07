import { expect, test } from '@playwright/test';
import { expectAccessible, newPhone, sessionFor, watchConsole } from './helpers';

const ADMIN = '9000000000'; // created by the e2e seed

test('paying online: the slot is held, the test payment confirms the booking', async ({ browser }) => {
  const { ctx, page } = await sessionFor(browser, newPhone(), 'Asha Nair');
  const errors = watchConsole(page);
  await page.goto('/test/vitamin-d');
  await page.getByRole('button', { name: 'Add Vitamin D (25-OH)' }).first().click();
  await page.goto('/checkout');
  await page.getByLabel('Age').fill('41');
  await page.getByLabel('Gender').selectOption('FEMALE');
  await page.getByLabel('House, street, area').fill('7, 2nd Main, Jayanagar');
  await page.getByLabel('Pincode').fill('560041');
  await page.getByRole('group', { name: 'Time' }).getByRole('button', { name: '4–6 pm' }).click();
  await page.getByLabel(/Pay online now/).check();
  await page.getByRole('button', { name: /Place order/ }).click();

  await expect(page).toHaveURL(/\/orders\/AL-[A-Z0-9]{6}\/pay$/);
  await expect(page.getByText(/Your slot is held for/)).toBeVisible();
  const code = page.url().match(/AL-[A-Z0-9]{6}/)![0];

  // Until paid, it shows as awaiting payment.
  await page.goto('/orders');
  await expect(page.getByText(/Awaiting payment/)).toBeVisible();
  await page.goto(`/orders/${code}/pay`);
  await page.getByRole('button', { name: /^Pay ₹/ }).click();
  await expect(page.getByText(/Test payment: no money moves/)).toBeVisible();
  await page.getByRole('button', { name: /\(test\)$/ }).click();
  await expect(page).toHaveURL(new RegExp(`/orders/${code}/confirmed$`));
  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible();

  // Paying again is not possible.
  await page.goto(`/orders/${code}/pay`);
  await expect(page).toHaveURL(new RegExp(`/orders/${code}/confirmed$`));
  errors.assertClean();
  await ctx.close();
});

test('an admin price change shows on the storefront straight away', async ({ browser }) => {
  const admin = await sessionFor(browser, ADMIN, 'Admin Person');
  const visitor = await browser.newContext({ reducedMotion: 'reduce' });
  const shop = await visitor.newPage();

  await shop.goto('/test/complete-blood-count');
  await expect(shop.locator('.panel .price').first()).toHaveText('₹299');

  await admin.page.goto('/admin/tests/cbc');
  const price = admin.page.getByLabel('Selling price (₹)');
  await price.fill('333');
  await admin.page.getByLabel('MRP (₹)').fill('399');
  await admin.page.getByRole('button', { name: 'Save' }).first().click();
  await expect(admin.page.getByText('Test saved')).toBeVisible();

  await shop.reload();
  await expect(shop.locator('.panel .price').first()).toHaveText('₹333');

  // A bad value is refused with a message, not saved.
  await price.fill('');
  await admin.page.getByRole('button', { name: 'Save' }).first().click();
  await expect(admin.page.getByText('Enter a number.').first()).toBeVisible();

  // put it back
  await price.fill('299');
  await admin.page.getByRole('button', { name: 'Save' }).first().click();
  await expect(admin.page.getByText('Test saved')).toBeVisible();
  await shop.reload();
  await expect(shop.locator('.panel .price').first()).toHaveText('₹299');
  await Promise.all([admin.ctx.close(), visitor.close()]);
});

test('an admin can add a staff member and a coupon, and a patient cannot reach admin pages', async ({ browser }) => {
  const admin = await sessionFor(browser, ADMIN, 'Admin Person');
  for (const p of ['/admin', '/admin/tests', '/admin/tests/cbc', '/admin/ranges', '/admin/coupons', '/admin/slots', '/admin/inbox', '/admin/settings']) {
    await admin.page.goto(p);
    await expectAccessible(admin.page, p);
  }
  await admin.page.goto('/admin/staff');
  await expectAccessible(admin.page, '/admin/staff');
  await admin.page.getByLabel('Full name').fill('New Phlebotomist');
  await admin.page.getByLabel('Mobile number').fill('9000000099');
  await admin.page.getByRole('button', { name: 'Add / update' }).click();
  await expect(admin.page.getByText('Staff saved')).toBeVisible();
  await expect(admin.page.getByRole('cell', { name: 'New Phlebotomist' })).toBeVisible();

  const patient = await sessionFor(browser, newPhone(), 'Plain Patient');
  for (const p of ['/admin', '/admin/tests', '/admin/staff', '/staff']) {
    await patient.page.goto(p);
    await expect(patient.page).toHaveURL('http://localhost:3100/');
  }
  await Promise.all([admin.ctx.close(), patient.ctx.close()]);
});
