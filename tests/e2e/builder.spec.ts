import { expect, test } from '@playwright/test';

test('starts from a recipe and exposes export', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Matchbox Builder')).toBeVisible();
  for (const recipe of [
    /Color Grade/,
    /Matte Tools/,
    /Blur \/ Sharpen/,
    /Composite/,
    /Distortion/,
    /Generator/,
  ]) {
    await page.getByRole('button', { name: recipe }).click();
    await expect(page.getByText('Structure passed')).toBeVisible();
    await expect(page.getByText(/Preview compile error/)).toHaveCount(0);
  }
  await expect(page.getByRole('textbox').first()).toHaveValue(
    /Signal Gradient/,
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^DG_.*\.zip$/);
});

test('opens the public gallery', async ({ page }) => {
  await page.goto('./#/gallery');
  await expect(page.getByText('Build, learn and remix')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Builder/ }).first(),
  ).toBeVisible();
});
