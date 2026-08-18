import { expect, test } from '@playwright/test';

test('visitor can open the public application', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Choose how you want to continue/i })).toBeVisible();
  await page.getByRole('button', { name: /Continue as Visitor/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /Helping teacher trainees move from academic study to sustainable employment/i })).toBeVisible();
});

test('graduate can complete local-isolated registration flow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Create Graduate Account/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^OK$/i }).click();
  const suffix = Date.now();
  await page.getByLabel('Username').fill(`graduate.${suffix}`);
  await page.getByLabel('Password').fill('StrongGraduate123!');
  await page.getByLabel('Full name').fill('E2E Graduate');
  await page.getByLabel('Email').fill(`graduate.${suffix}@example.test`);
  await page.getByLabel('Phone').fill('+258 840000001');
  await page.getByLabel('Province').fill('Sofala');
  await page.getByLabel('Institution').fill('E2E Institute');
  await page.getByLabel('Qualification').fill('Education');
  await page.getByLabel('Teaching area').fill('Mathematics');
  await page.getByLabel('Motivation').fill('Validate the complete graduate registration journey.');
  await page.getByRole('button', { name: /Submit Application/i }).click();
  await expect(page).toHaveURL(/\/opportunities$/);
});

test('partner can complete local-isolated registration flow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Create Partner Account/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^OK$/i }).click();
  const suffix = Date.now();
  await page.getByLabel('Username').fill(`partner.${suffix}`);
  await page.getByLabel('Password').fill('StrongPartner123!');
  await page.getByLabel('Organization name').fill('E2E School');
  await page.getByLabel('Contact person').fill('E2E Contact');
  await page.getByLabel('Email').fill(`partner.${suffix}@example.test`);
  await page.getByLabel('Phone').fill('+258 840000002');
  await page.getByLabel('What support or collaboration is needed?').fill('Teacher recruitment and mentorship support.');
  await page.getByRole('button', { name: /Submit Partner Request/i }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('isolated demo administrator can authenticate', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Username').fill('e2e.admin');
  await page.getByLabel('Password').fill('StrongDemoPass123!');
  await page.locator('.welcome-login-card').getByRole('button', { name: /^Login$/i }).click();
  await expect(page.getByText(/Default EduCareer Admin · Default Admin/i)).toBeVisible();
});
