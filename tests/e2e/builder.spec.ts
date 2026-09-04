import { expect, test } from '@playwright/test';

test('starts from a recipe and exposes export', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Matchbox Builder')).toBeVisible();
  for (const recipe of [
    /カラー調整|Color Grade/,
    /マット処理|Matte Tools/,
    /ブラー \/ シャープ|Blur \/ Sharpen/,
    /合成|Composite/,
    /ディストーション|Distortion/,
    /ジェネレーター|Generator/,
  ]) {
    await page.getByRole('button', { name: recipe }).click();
    await expect(
      page.getByText(/構造チェック済み|Structure passed/),
    ).toBeVisible();
    await expect(page.getByText(/Preview compile error/)).toHaveCount(0);
  }
  await expect(page.getByRole('textbox').first()).toHaveValue(
    /Signal Gradient/,
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /書き出す|Export/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^DG_.*\.zip$/);
});

test('opens the public gallery and switches language', async ({ page }) => {
  await page.goto('./#/gallery');
  await expect(
    page.getByText(/作って、学んで、リミックス|Build, learn and remix/),
  ).toBeVisible();
  await page.getByRole('button', { name: /JA|EN/ }).click();
  await expect(
    page.getByRole('button', { name: /Builder|ビルダー/ }).first(),
  ).toBeVisible();
});
