import { expect, test } from '@playwright/test';
import { expectAccessible, newPhone, sessionFor, tomorrowIst, upsertStaff } from './helpers';

const PHLEB = '9000000011', TECH = '9000000012', PATH = '9000000013';

test('an order goes from booking to a flagged report, each person seeing only their part', async ({ browser }) => {
  await upsertStaff(PHLEB, 'Ravi Phlebotomist', 'PHLEBOTOMIST');
  await upsertStaff(TECH, 'Tara Technician', 'TECHNICIAN');
  await upsertStaff(PATH, 'Dr Priya Pathologist', 'PATHOLOGIST');

  // 1. Patient books Thyroid Profile (free collection above ₹499)
  const patientPhone = newPhone();
  const { ctx: pCtx, page: patient } = await sessionFor(browser, patientPhone, 'Lakshmi Rao');
  await patient.goto('/test/thyroid-profile-total');
  await patient.getByRole('button', { name: /^Add Thyroid Profile Total/ }).first().click();
  await patient.goto('/checkout');
  await patient.getByLabel('Age').fill('34');
  await patient.getByLabel('Gender').selectOption('FEMALE');
  await patient.getByLabel('House, street, area').fill('12, 4th Cross, Indiranagar');
  await patient.getByLabel('Pincode').fill('560038');
  await patient.getByRole('group', { name: 'Time' }).getByRole('button', { name: '10 am–12 pm' }).click();
  await patient.getByRole('button', { name: /Place order/ }).click();
  await patient.waitForURL(/\/orders\/AL-[A-Z0-9]{6}\/confirmed$/);
  const code = patient.url().match(/AL-[A-Z0-9]{6}/)![0];

  // The report is not there yet.
  await patient.goto(`/orders/${code}/report`);
  await expect(patient.getByText("Your report isn't ready yet.")).toBeVisible();

  // 2. Phlebotomist collects the sample
  const { ctx: fCtx, page: phleb } = await sessionFor(browser, PHLEB);
  await phleb.goto(`/staff?date=${tomorrowIst()}`);
  const card = phleb.locator('.panel', { hasText: code });
  await expect(card).toContainText('Lakshmi Rao');
  await card.getByRole('button', { name: 'Mark collected' }).click();
  await expect(card.getByText('Sample collected.')).toBeVisible();
  // …and cannot reach results entry or admin
  await phleb.goto('/admin');
  await expect(phleb).toHaveURL('http://localhost:3100/');

  // 3. Technician enters results; TSH is high
  const { ctx: tCtx, page: tech } = await sessionFor(browser, TECH);
  await tech.goto(`/staff/orders/${code}`);
  await tech.getByLabel('T3, total').fill('112');
  await tech.getByLabel('T4, total').fill('8.6');
  await tech.getByLabel('TSH').fill('5.5');
  await tech.getByRole('button', { name: 'Save results' }).click();
  await expect(tech.getByRole('row', { name: /^TSH/ }).getByText('High')).toBeVisible();
  await expectAccessible(tech, 'results entry');
  // Technicians cannot release
  await expect(tech.getByRole('button', { name: 'Verify and release report' })).toHaveCount(0);

  // 4. Pathologist verifies and releases
  const { ctx: dCtx, page: pathologist } = await sessionFor(browser, PATH);
  await pathologist.goto(`/staff/orders/${code}`);
  pathologist.once('dialog', (d) => d.accept());
  await pathologist.getByRole('button', { name: 'Verify and release report' }).click();
  await expect(pathologist.getByText('Report released').first()).toBeVisible();

  // 5. Patient reads the report and downloads the PDF
  await patient.goto(`/orders/${code}/report`);
  await expect(patient.getByRole('heading', { name: 'Lab report' })).toBeVisible();
  const tshRow = patient.getByRole('row', { name: /^TSH 5\.50/ });
  await expect(tshRow).toBeVisible();
  await expect(tshRow.locator('.flag')).toHaveText('High');
  await expect(patient.getByText('Dr Priya Pathologist')).toBeVisible();
  await expectAccessible(patient, 'report');
  const pdf = await patient.request.get(`/api/orders/${code}/report`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');

  // 6. Another patient cannot see it, and cannot tell it exists
  const { ctx: oCtx, page: other } = await sessionFor(browser, newPhone(), 'Someone Else');
  await other.goto(`/orders/${code}/report`);
  await expect(other.getByRole('heading', { name: "We couldn't find that page" })).toBeVisible();
  // Nothing of the report is in the page, not even hidden. (Streaming means the HTTP status is already 200 by then; the API below is a true 404.)
  const html = await other.content();
  expect(html).not.toContain('Lakshmi Rao');
  expect(html).not.toContain('5.50');
  expect((await other.request.get(`/api/orders/${code}/report`)).status()).toBe(404);
  // Patients are kept out of staff pages
  await other.goto('/staff');
  await expect(other).toHaveURL('http://localhost:3100/');

  await Promise.all([pCtx, fCtx, tCtx, dCtx, oCtx].map((c) => c.close()));
});
