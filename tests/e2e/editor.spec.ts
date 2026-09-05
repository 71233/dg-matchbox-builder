import { expect, test } from '@playwright/test';
import { instantiateProject } from '../../lib/matchbox/project';
import { TEMPLATES } from '../../lib/matchbox/templates';

test.use({ viewport: { width: 1600, height: 1000 } });

test('view tabs preserve the canvas and preview state; floating preview moves and resizes', async ({
  page,
}) => {
  await page.goto('./');
  await page
    .getByRole('button', { name: 'Pause preview', exact: true })
    .click();
  await page.getByLabel('Test input').selectOption('white');
  await page
    .locator('canvas[aria-label="Matchbox WebGL preview"]')
    .evaluate((canvas) => {
      canvas.setAttribute('data-retained', 'yes');
    });
  await page.getByLabel('Move before after boundary').focus();
  await page.keyboard.press('ArrowRight');
  const wipe = await page
    .getByLabel('Move before after boundary')
    .getAttribute('style');
  for (const name of ['Graph', 'Code', 'Preview', 'Graph']) {
    await page.getByRole('tab', { name, exact: true }).click();
    await expect(page.locator('canvas[data-retained="yes"]')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Play preview', exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Test input')).toHaveValue('white');
    await expect(page.getByLabel('Move before after boundary')).toHaveAttribute(
      'style',
      wipe!,
    );
  }
  const before = await page.getByTestId('preview-window').boundingBox();
  const grip = await page
    .getByLabel('Move preview', { exact: true })
    .boundingBox();
  await page.mouse.move(grip!.x + 50, grip!.y + 10);
  await page.mouse.down();
  await page.mouse.move(grip!.x - 50, grip!.y + 100, { steps: 6 });
  await page.mouse.up();
  const moved = await page.getByTestId('preview-window').boundingBox();
  expect(moved!.x).toBeLessThan(before!.x);
  expect(moved!.y).toBeGreaterThan(before!.y);
  await page.getByLabel('Resize preview', { exact: true }).focus();
  await page.keyboard.press('Shift+ArrowRight');
  const resized = await page.getByTestId('preview-window').boundingBox();
  expect(resized!.width).toBeGreaterThan(moved!.width);
  await page.reload();
  await page.getByRole('tab', { name: 'Graph', exact: true }).click();
  expect((await page.getByTestId('preview-window').boundingBox())!.width).toBe(
    resized!.width,
  );
});

test('all-node controls support direct editing, reset, undo and searching without graph navigation', async ({
  page,
}) => {
  await page.goto('./');
  await page
    .locator('summary')
    .filter({ hasText: /^Exposure/ })
    .click();
  await page
    .getByRole('spinbutton', { name: 'Exposure value', exact: true })
    .fill('2');
  await page.getByRole('heading', { name: 'Node controls' }).click();
  await page
    .locator('summary')
    .filter({ hasText: /^Saturation/ })
    .click();
  await expect(
    page.getByRole('spinbutton', { name: 'Exposure value', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('spinbutton', { name: 'Saturation value', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Exposure value', exact: true }),
  ).toHaveValue('0.65');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Exposure value', exact: true }),
  ).toHaveValue('2');
  await page
    .locator('details')
    .filter({ has: page.locator('summary').filter({ hasText: /^Exposure/ }) })
    .getByRole('button', { name: 'Reset', exact: true })
    .click();
  await expect(
    page.getByRole('spinbutton', { name: 'Exposure value', exact: true }),
  ).toHaveValue('0');
  const numericInput = page.getByRole('spinbutton', {
    name: 'Exposure value',
    exact: true,
  });
  await numericInput.fill('');
  await numericInput.pressSequentially('-1.25');
  await page.getByRole('heading', { name: 'Node controls' }).click();
  await expect(numericInput).toHaveValue('-1.25');
  await page.getByLabel('Search node controls').fill('Pivot');
  await expect(
    page.getByRole('spinbutton', { name: 'Pivot value', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('spinbutton', { name: 'Exposure value', exact: true }),
  ).toHaveCount(0);
});

test('graph edges can be selected, disconnected and restored; navigation mode persists', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('tab', { name: 'Graph', exact: true }).click();
  await page.getByLabel('Move preview', { exact: true }).focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press('Shift+ArrowDown');
  await page.getByRole('button', { name: 'Fit all', exact: true }).click();
  const edges = page.locator('.react-flow__edge');
  const count = await edges.count();
  const point = await edges
    .first()
    .locator('.react-flow__edge-path')
    .evaluate((path) => {
      const p = path as SVGPathElement;
      const point = p.getPointAtLength(p.getTotalLength() / 2);
      const screen = new DOMPoint(point.x, point.y).matrixTransform(
        p.getScreenCTM()!,
      );
      return { x: screen.x, y: screen.y };
    });
  await page.mouse.click(point.x, point.y);
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(edges).toHaveCount(count - 1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(edges).toHaveCount(count);
  await page.getByLabel('Graph navigation').selectOption('trackpad');
  const viewport = page.locator('.react-flow__viewport');
  const original = await viewport.getAttribute('style');
  await page
    .locator('.react-flow__pane')
    .hover({ position: { x: 60, y: 250 } });
  await page.mouse.wheel(70, 80);
  await expect(viewport).not.toHaveAttribute('style', original!);
  const changed = await viewport.getAttribute('style');
  await page.getByRole('tab', { name: 'Code', exact: true }).click();
  await page.getByRole('tab', { name: 'Graph', exact: true }).click();
  await expect(viewport).toHaveAttribute('style', changed!);
  await page.reload();
  await page.getByRole('tab', { name: 'Graph', exact: true }).click();
  await expect(page.getByLabel('Graph navigation')).toHaveValue('trackpad');
});

test('save failures offer backup and retry', async ({ page }) => {
  await page.addInitScript(() => {
    // Preserve the prototype method, then explicitly bind its original receiver with apply.
    // oxlint-disable-next-line typescript/unbound-method
    const put = IDBObjectStore.prototype.put;
    (window as unknown as { failSave: boolean }).failSave = true;
    IDBObjectStore.prototype.put = function (...args) {
      if ((window as unknown as { failSave: boolean }).failSave)
        throw new DOMException(
          'Simulated storage failure',
          'QuotaExceededError',
        );
      return put.apply(this, args);
    };
  });
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Retry save' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Backup project' }).click();
  expect((await download).suggestedFilename()).toBe('project.dgmb.json');
  await page.evaluate(() => {
    (window as unknown as { failSave: boolean }).failSave = false;
  });
  await page.getByRole('button', { name: 'Retry save' }).click();
  await expect(page.getByRole('button', { name: 'Retry save' })).toHaveCount(0);
  await expect(
    page.getByText('Saved locally', { exact: true }).first(),
  ).toBeVisible();
});

test('dragging onto an occupied socket replaces it and node deletion restores everything in one undo', async ({
  page,
}, info) => {
  await page.goto('./');
  await page.getByRole('tab', { name: 'Graph', exact: true }).click();
  await page.getByLabel('Move preview', { exact: true }).focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press('Shift+ArrowDown');
  await page.getByRole('button', { name: 'Fit all', exact: true }).click();
  const nodes = page.locator('.react-flow__node');
  const front = nodes.filter({ hasText: 'Front Input' });
  const output = nodes.filter({ hasText: /^Output/ });
  const source = front.locator('.source');
  const target = output.locator('.target');
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  await page.mouse.move(
    sourceBox!.x + sourceBox!.width / 2,
    sourceBox!.y + sourceBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox!.x + targetBox!.width / 2,
    targetBox!.y + targetBox!.height / 2,
    { steps: 15 },
  );
  await page.mouse.up();
  const frontId = await front.getAttribute('data-id');
  const outputId = await output.getAttribute('data-id');
  await expect(page.locator('.react-flow__edge')).toHaveCount(4);
  await expect(
    page.getByLabel(`Edge from ${frontId} to ${outputId}`, { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(
    page.getByLabel(`Edge from ${frontId} to ${outputId}`, { exact: true }),
  ).toHaveCount(0);
  await nodes.filter({ hasText: /^Exposure/ }).click();
  await page.keyboard.press('Delete');
  await expect(nodes).toHaveCount(4);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(nodes).toHaveCount(5);
  await expect(page.locator('.react-flow__edge')).toHaveCount(4);
  await page.screenshot({
    path: info.outputPath('graph-workspace.png'),
    fullPage: true,
  });
});

test('text undo stays local and hidden graph does not handle Delete', async ({
  page,
}) => {
  await page.goto('./');
  const title = page.getByLabel('Project title');
  await title.fill('Typing in title');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(
    page.getByTestId('node-controls').locator(':scope > details'),
  ).toHaveCount(5);
  await page.getByRole('tab', { name: 'Graph', exact: true }).click();
  await page
    .locator('summary')
    .filter({ hasText: /^Exposure/ })
    .click();
  await page.getByRole('tab', { name: 'Code', exact: true }).click();
  await page.keyboard.press('Delete');
  await expect(
    page.getByTestId('node-controls').locator(':scope > details'),
  ).toHaveCount(5);
});

test('reconnecting an edge endpoint preserves its identity and cancelled reconnection preserves the edge', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('tab', { name: 'Graph', exact: true }).click();
  await page.getByLabel('Move preview', { exact: true }).focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press('Shift+ArrowDown');
  await page.getByRole('button', { name: 'Fit all', exact: true }).click();
  const edge = page.locator('.react-flow__edge').last();
  const id = await edge.getAttribute('data-id');
  const contrast = page
    .locator('.react-flow__node')
    .filter({ hasText: /^Contrast/ });
  const targetBox = await contrast.locator('.source').boundingBox();
  const updater = await edge
    .locator('.react-flow__edgeupdater-source')
    .boundingBox();
  await page.mouse.move(
    updater!.x + updater!.width / 2,
    updater!.y + updater!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox!.x + targetBox!.width / 2,
    targetBox!.y + targetBox!.height / 2,
    { steps: 15 },
  );
  await page.mouse.up();
  const sameEdge = page
    .locator('.react-flow__edge')
    .filter({ has: page.locator(':scope') });
  await expect(sameEdge).toHaveCount(4);
  const reconnected = page.locator(`.react-flow__edge[data-id="${id}"]`);
  await expect(reconnected).toHaveAttribute(
    'aria-label',
    new RegExp(`Edge from ${await contrast.getAttribute('data-id')} to`),
  );
  const label = await reconnected.getAttribute('aria-label');
  const endpoint = await reconnected
    .locator('.react-flow__edgeupdater-target')
    .boundingBox();
  await page.mouse.move(
    endpoint!.x + endpoint!.width / 2,
    endpoint!.y + endpoint!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(endpoint!.x, endpoint!.y - 100, { steps: 8 });
  await page.mouse.up();
  await expect(reconnected).toHaveAttribute('aria-label', label!);
  await expect(
    page.getByText('Connection unchanged. Drop onto a compatible socket.', {
      exact: true,
    }),
  ).toBeVisible();
});

test('legacy imports migrate defaults and survive reload without overwriting custom content', async ({
  page,
}) => {
  const project = instantiateProject(TEMPLATES[0].project, 'ja');
  project.title = 'Custom saved project';
  project.exposedParameters[0].displayName = 'My exposure';
  await page.goto('./');
  await page.locator('input[accept=".json,.dgmb.json"]').setInputFiles({
    name: 'legacy.dgmb.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.getByLabel('Project title')).toHaveValue(
    'Custom saved project',
  );
  await expect(
    page.getByText('Saved locally', { exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Project title')).toHaveValue(
    'Custom saved project',
  );
  await page.getByRole('tab', { name: 'Code', exact: true }).click();
  await page.getByRole('button', { name: 'Matchbox XML', exact: true }).click();
  await expect(page.locator('pre').first()).toContainText('My exposure');
  expect(await page.locator('pre').first().innerText()).not.toMatch(
    /[ぁ-んァ-ン一-龥]/,
  );
});
