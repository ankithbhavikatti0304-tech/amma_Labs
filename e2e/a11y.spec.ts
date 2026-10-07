import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { newPhone, sessionFor } from './helpers';

/** Automated accessibility checks (WCAG 2.1 A and AA). They catch about a third of real problems; they do not replace trying it with a screen reader. */
async function scan(page: import('@playwright/test').Page, label: string) {
  await page.waitForLoadState('networkidle');
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n   ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n   ')}`);
  expect(bad, `${label}\n${bad.join('\n')}`).toEqual([]);
}

const pages = ['/', '/tests', '/category/thyroid', '/test/complete-blood-count', '/cart', '/privacy', '/login'];
for (const path of pages) {
  test(`a11y: ${path}`, async ({ page }) => {
    await page.goto(path);
    await scan(page, path);
  });
}

test('a11y: dark theme on the home page', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await scan(page, 'dark /');
  await ctx.close();
});

test('a11y: the login sheet, the search palette and a signed-in checkout', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('dialog', { name: 'Log in' })).toBeVisible();
  await scan(page, 'login sheet');
  await page.keyboard.press('Escape');
  await page.keyboard.press('/');
  await page.getByRole('searchbox', { name: 'Search tests' }).fill('vit');
  await expect(page.locator('.pal-row').first()).toBeVisible();
  await scan(page, 'search palette');

  const { ctx, page: p } = await sessionFor(browser, newPhone(), 'Meera Iyer');
  await p.goto('/test/complete-blood-count');
  await p.getByRole('button', { name: 'Add Complete Blood Count (CBC)' }).first().click();
  await p.goto('/checkout');
  await scan(p, 'checkout');
  await ctx.close();
});
