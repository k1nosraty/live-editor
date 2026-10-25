import { bridgeScript } from '../../src/features/preview/engine';
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
for (const [framework, source, initial, replacement] of [
  ['react-vite', 'src/main.jsx', 'A new perspective.', 'A live React update.'],
  ['vue-vite', 'src/App.vue', 'Ideas, in motion.', 'A live Vue update.'],
]) {
  test(`${framework} renders, handles interaction, and updates through Vite HMR`, async ({
    page,
  }) => {
    const root = path.resolve('examples', framework);
    const filename = path.join(root, source);
    const original = await readFile(filename, 'utf8');
    let server: ChildProcess | undefined;
    try {
      server = spawn(
        process.execPath,
        [
          path.resolve('node_modules/vite/bin/vite.js'),
          '--host',
          '127.0.0.1',
          '--port',
          '5183',
          '--strictPort',
        ],
        { cwd: root, stdio: 'ignore' },
      );
      await expect
        .poll(
          async () => {
            try {
              return (await fetch('http://127.0.0.1:5183')).status;
            } catch {
              return 0;
            }
          },
          { timeout: 15000 },
        )
        .toBe(200);
      await page.goto('http://127.0.0.1:5183');
      await expect(page.locator('h1')).toHaveText(initial);
      await page.getByRole('button', { name: 'Count: 0' }).click();
      await expect(page.getByRole('button', { name: 'Count: 1' })).toBeVisible();
      await writeFile(filename, original.replace(initial, replacement));
      await expect(page.locator('h1')).toHaveText(replacement);
    } finally {
      await writeFile(filename, original);
      server?.kill();
      await expect
        .poll(
          async () => {
            try {
              await fetch('http://127.0.0.1:5183');
              return true;
            } catch {
              return false;
            }
          },
          { timeout: 10000 },
        )
        .toBe(false);
    }
  });
}
test('Rust static preview serves CSS imports and ES modules inside an opaque iframe', async ({
  page,
}) => {
  let server: ChildProcess | undefined;
  try {
    server = spawn(
      process.env.CARGO ?? 'cargo',
      [
        'run',
        '--manifest-path',
        'src-tauri/Cargo.toml',
        '--no-default-features',
        '--example',
        'preview_host',
      ],
      {
        stdio: ['pipe', 'pipe', 'inherit'],
        env: { ...process.env, RENDERIFT_TEST_BRIDGE: bridgeScript('native-test') },
      },
    );
    const url = await new Promise<string>((resolve, reject) => {
      let out = '';
      const timer = setTimeout(() => reject(new Error('Preview host did not start')), 20000);
      server!.stdout!.on('data', (chunk) => {
        out += String(chunk);
        const match = out.match(/http:\/\/127\.0\.0\.1:\d+\/[a-f0-9]+/);
        if (match) {
          clearTimeout(timer);
          resolve(match[0]);
        }
      });
      server!.on('exit', (code) => {
        if (code) reject(new Error(`Preview host exited ${code}`));
      });
    });
    await page.goto('/');
    await page.locator('iframe').evaluate((frame, url) => {
      const element = frame as HTMLIFrameElement;
      element.removeAttribute('srcdoc');
      element.src = url + '/index.html';
    }, url);
    const frame = page.frameLocator('iframe');
    await expect(frame.locator('h1')).toHaveText('Built one line at a time.');
    await expect(frame.locator('body')).toHaveCSS('background-color', 'rgb(238, 243, 233)');
    await frame.getByRole('button', { name: 'Count: 0' }).click();
    await expect(frame.getByRole('button', { name: 'Count: 1' })).toBeVisible();
    await expect
      .poll(() =>
        page
          .frames()
          .find((f) => f.url().startsWith(url))!
          .evaluate(() => {
            try {
              return document.styleSheets[0].cssRules.length;
            } catch {
              return 0;
            }
          }),
      )
      .toBeGreaterThan(0);
  } finally {
    server?.stdin?.end('\n');
  }
});
