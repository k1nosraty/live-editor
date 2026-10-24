import { test, expect } from '@playwright/test';
async function edit(page: import('@playwright/test').Page, tab: string, text: string) {
  await page.getByRole('tab', { name: tab, exact: false }).click();
  const editor = page.locator('.cm-content').first();
  await editor.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText(text);
}
test('playground executes JavaScript, injects CSS without losing state, and captures console', async ({
  page,
}) => {
  await page.goto('/');
  const preview = page.frameLocator('iframe');
  await expect(preview.locator('h1')).toContainText('Make something');
  await preview.locator('#create').click();
  await expect(preview.locator('h1')).toContainText('already');
  await expect(page.locator('.console-message')).toContainText('taking shape');
  await edit(page, 'index.css', 'body { background: rgb(12, 34, 56); }');
  await expect(preview.locator('body')).toHaveCSS('background-color', 'rgb(12, 34, 56)');
  await expect(preview.locator('h1')).toContainText('already');
});
test('persists playground buffers, changes themes, and opens a functional command palette', async ({
  page,
}) => {
  await page.goto('/');
  await edit(page, 'index.html', '<h1 dir="rtl">سلام دنیا</h1>');
  await expect(page.frameLocator('iframe').locator('h1')).toHaveText('سلام دنیا');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('renderift.session.v1')))
    .toContain('سلام دنیا');
  await page.reload();
  await expect(page.frameLocator('iframe').locator('h1')).toHaveText('سلام دنیا');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Color theme').selectOption('light');
  await expect(page.locator('.studio')).toHaveAttribute('data-theme', 'light');
  await page.keyboard.press('Control+Shift+p');
  await page.getByRole('textbox', { name: 'Command search' }).fill('Toggle output');
  await page.getByRole('button', { name: 'Toggle output panel' }).last().click();
  await expect(page.getByRole('region', { name: 'Output panel' })).toHaveCount(0);
});
test('inspector changes a parsed source rule and undo restores it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Inspect element', exact: true }).click();
  await page.frameLocator('iframe').locator('h1').click();
  await expect(page.getByRole('complementary', { name: 'CSS inspector' })).toBeVisible();
  const rules = page.getByLabel('Inspector source rule');
  await expect(rules.locator('option')).not.toHaveCount(1);
  const value = await rules
    .locator('option')
    .filter({ hasText: 'h1' })
    .first()
    .getAttribute('value');
  await rules.selectOption(value!);
  await page.getByLabel('CSS property', { exact: true }).selectOption('color');
  await page.getByLabel('CSS property value', { exact: true }).fill('#ff0000');
  await page.getByRole('button', { name: 'Apply to source' }).click();
  await expect(page.frameLocator('iframe').locator('h1')).toHaveCSS('color', 'rgb(255, 0, 0)');
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+z');
  await expect(page.frameLocator('iframe').locator('h1')).not.toHaveCSS('color', 'rgb(255, 0, 0)');
});
test('untrusted preview has no parent or Tauri access', async ({ page }) => {
  await page.goto('/');
  await edit(
    page,
    'index.js',
    `try { parent.document.body; console.error('boundary broken'); } catch { console.log('parent denied'); } console.log('native: '+typeof window.__TAURI_INTERNALS__);`,
  );
  await expect(page.locator('.console-message').filter({ hasText: 'parent denied' })).toBeVisible();
  await expect(
    page.locator('.console-message').filter({ hasText: 'native: undefined' }),
  ).toBeVisible();
  await expect(page.locator('.console-message').filter({ hasText: 'boundary broken' })).toHaveCount(
    0,
  );
});
test('extension package installs, activates, disables, and uninstalls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Extensions', exact: true }).click();
  await page
    .locator('input[type=file][accept=".json,.zip"]')
    .setInputFiles('extensions/examples/forest-theme.json');
  await page.getByRole('button', { name: 'Apply Forest' }).click();
  await expect(page.locator('.studio')).toHaveCSS('--accent', '#a9d99a');
  await page.getByRole('button', { name: 'Toggle Forest Studio' }).click();
  await expect(page.getByRole('button', { name: 'Apply Forest' })).toHaveCount(0);
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Uninstall Forest Studio' }).click();
  await expect(page.getByText('forest.studio · 1.0.0')).toHaveCount(0);
});
test('exports a real ZIP and captures an actual screenshot', async ({ page }) => {
  await page.goto('/');
  await expect(page.frameLocator('iframe').locator('h1')).toBeVisible();
  await page.screenshot({
    path: 'docs/screenshots/studio.png',
    fullPage: true,
  });
  await page.keyboard.press('Control+Shift+p');
  await page.getByRole('textbox', { name: 'Command search' }).fill('Export playground as ZIP');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export playground as ZIP' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.zip$/);
});
