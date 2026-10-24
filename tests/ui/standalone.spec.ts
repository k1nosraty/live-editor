import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';

async function paste(page: Page, text: string) {
  const editor = page.locator('.cm-content').first();
  await editor.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText(text);
}

for (const root of ['', 'C:\\existing-project']) {
  test(`new unsaved HTML previews without saving (workspace: ${root || 'none'})`, async ({
    page,
  }) => {
    await page.addInitScript((root) => {
      localStorage.setItem('renderift.session.v1', JSON.stringify({ mode: 'project', root }));
    }, root);
    await page.goto('/');
    await page.getByRole('button', { name: 'New file', exact: true }).first().click();
    const html = await readFile('tests/fixtures/profile-card.html', 'utf8');
    await paste(page, html);
    const preview = page.frameLocator('iframe');
    await expect(preview.locator('h2')).toHaveText('محمد جمشیدی', { timeout: 5000 });
    await expect(preview.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(preview.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(preview.locator('body')).toHaveCSS('background-color', 'rgb(11, 17, 32)');
    await expect(preview.locator('.card')).toHaveCSS('width', '320px');
    await expect(preview.getByRole('button', { name: 'مشاهده پروفایل' })).toBeVisible();

    await paste(page, html.replace('Frontend Developer', 'Live HTML preview'));
    await expect(preview.locator('p')).toHaveText('Live HTML preview');
    await page.keyboard.press('Control+n');
    await paste(page, '<h1>Second document</h1>');
    await expect(preview.locator('h1')).toHaveText('Second document');
    // Switching tabs changes the preview even when no document text changes.
    await page
      .getByRole('tab', { name: /untitled\.html/ })
      .first()
      .click();
    await expect(preview.locator('h2')).toHaveText('محمد جمشیدی');
    await expect(preview.locator('p')).toHaveText('Live HTML preview');

    await paste(
      page,
      html.replace(
        '<head>',
        `<head><script>
      console.log('standalone script runs');
      try { parent.document.body; console.error('boundary broken'); }
      catch { console.log('standalone parent denied'); }
      console.log('native: ' + typeof window.__TAURI_INTERNALS__);
    </script>`,
      ),
    );
    await expect(
      page.locator('.console-message').filter({ hasText: 'standalone script runs' }),
    ).toBeVisible();
    await expect(
      page.locator('.console-message').filter({ hasText: 'standalone parent denied' }),
    ).toBeVisible();
    await expect(
      page.locator('.console-message').filter({ hasText: 'native: undefined' }),
    ).toBeVisible();
    await expect(
      page.locator('.console-message').filter({ hasText: 'boundary broken' }),
    ).toHaveCount(0);
  });
}

test('a standalone HTML file restores its preview without opening a folder', async ({ page }) => {
  const html = await readFile('tests/fixtures/profile-card.html', 'utf8');
  await page.addInitScript((text) => {
    localStorage.setItem(
      'renderift.session.v1',
      JSON.stringify({
        mode: 'project',
        root: '',
        active: 'profile',
        docs: [
          { id: 'profile', name: 'profile.HTM', path: 'C:\\cards\\profile.HTM', text, saved: text },
        ],
      }),
    );
  }, html);
  await page.goto('/');
  await expect(page.frameLocator('iframe').locator('h2')).toHaveText('محمد جمشیدی');
  await expect(page.frameLocator('iframe').locator('html')).toHaveAttribute('dir', 'rtl');
});
