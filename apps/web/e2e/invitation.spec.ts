import { t } from '@gravn/shared';
import { expect, type Page, test } from '@playwright/test';

// Seeded accounts (supabase/seed.sql) all use this password.
async function signIn(page: Page, email: string) {
  await page.goto('/sign-in');
  await page.getByLabel(t('auth.email'), { exact: true }).fill(email);
  await page.getByLabel(t('auth.password'), { exact: true }).fill('password123');
  await page.getByRole('button', { name: t('auth.sign_in') }).click();
}

test('an owner invites someone, who signs in and accepts', async ({ page }) => {
  await signIn(page, 'owner.a@example.test');
  await expect(page.getByRole('heading', { name: 'Gym A' })).toBeVisible();

  await page.getByRole('link', { name: t('tabs.members') }).click();
  await page.getByLabel(t('auth.email'), { exact: true }).fill('solo@example.test');
  await page
    .getByRole('button', { name: t('people.invite'), exact: true })
    .first()
    .click();
  const link = await page.getByRole('textbox', { name: t('common.copy_link') }).inputValue();
  await page.getByRole('button', { name: t('common.sign_out') }).click();

  await signIn(page, 'solo@example.test');
  await page.goto(link);
  await page.getByRole('button', { name: t('invitation.accept') }).click();
  await expect(page.getByRole('heading', { name: t('web.get_app_title') })).toBeVisible();
});
