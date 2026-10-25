import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Workspace } from '../../src/shared/types';

const cases = [
  {
    name: 'React',
    root: path.resolve('examples/react-vite'),
    source: 'src/main.jsx',
    heading: 'A new perspective.',
  },
  {
    name: 'Vue',
    root: path.resolve('examples/vue-vite'),
    source: 'src/App.vue',
    heading: 'Ideas, in motion.',
  },
];
if (process.env.LIVE_EDITOR_VALIDATION_PROJECT)
  cases.push({
    name: 'user repository frontend',
    root: path.resolve(process.env.LIVE_EDITOR_VALIDATION_PROJECT),
    source: 'src/pages/HomePage.tsx',
    heading: 'بازی معنایی واژگان',
  });

for (const fixture of cases) {
  test(`${fixture.name} renders inside the editor preview with storage and parent isolation`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const filename = path.join(fixture.root, fixture.source);
    const original = await readFile(filename, 'utf8');
    const html = await readFile(path.join(fixture.root, 'index.html'), 'utf8');
    let host: ChildProcess | undefined;
    try {
      host = spawn(
        process.env.CARGO ?? 'cargo',
        [
          'run',
          '--manifest-path',
          'src-tauri/Cargo.toml',
          '--no-default-features',
          '--example',
          'runtime_host',
          '--',
          fixture.root,
        ],
        { stdio: ['pipe', 'pipe', 'inherit'] },
      );
      const runtime = await new Promise<{ url: string; workspace: Workspace }>(
        (resolve, reject) => {
          let output = '';
          const timer = setTimeout(
            () => reject(new Error('Native runtime did not become ready')),
            90000,
          );
          host!.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
          });
          host!.on('exit', (code) => {
            clearTimeout(timer);
            if (code) reject(new Error(`Native runtime exited: ${code}`));
          });
          host!.stdout!.on('data', (data) => {
            output += data;
            const line = output.split('\n').find((line) => line.startsWith('{'));
            if (line) {
              clearTimeout(timer);
              resolve(JSON.parse(line));
            }
          });
        },
      );
      await page.goto('/');
      await expect(page.locator('.studio')).toBeVisible();
      await expect(page).toHaveTitle(/Live Editor/);
      await page.evaluate(
        async ({ workspace, html }) => {
          const stateModule = '/src/app/state.svelte.ts';
          const { studio } = await import(stateModule);
          studio.workspace = workspace;
          studio.root = workspace.root;
          studio.mode = 'project';
          studio.docs = [
            {
              id: 'entry',
              name: 'index.html',
              path: `${workspace.root}/index.html`,
              text: html,
              saved: html,
            },
          ];
          studio.active = 'entry';
        },
        { workspace: runtime.workspace, html },
      );
      await expect(page.locator('.runtime-empty')).toContainText('Enable live preview');
      await expect(page.locator('iframe')).toHaveCount(0);
      await page.evaluate(async (url) => {
        const stateModule = '/src/app/state.svelte.ts';
        const { studio } = await import(stateModule);
        studio.serverUrl = url;
      }, runtime.url);
      const preview = page.frameLocator('iframe');
      await expect(preview.locator('h1').first()).toHaveText(fixture.heading);
      const boundary = await preview.locator('body').evaluate(() => {
        localStorage.setItem('live-editor-preview-test', 'works');
        let denied = false;
        try {
          void parent.document.body;
        } catch {
          denied = true;
        }
        return {
          denied,
          storage: localStorage.getItem('live-editor-preview-test'),
          native: '__TAURI_INTERNALS__' in window,
          secret: '__RENDERIFT_NATIVE_TOKEN__' in window,
        };
      });
      expect(boundary).toEqual({ denied: true, storage: 'works', native: false, secret: false });
      if (fixture.name === 'user repository frontend') {
        // No backend is started: the frontend must render its API-unavailable state.
        await expect(preview.getByText('چالش امروز در دسترس نیست.', { exact: true })).toBeVisible();
        host.stdin!.write(
          JSON.stringify([
            {
              path: filename,
              text: original.replace(
                'بازی <span className="gradient-text">معنایی</span> واژگان',
                'پیش‌نمایش زنده',
              ),
            },
          ]) + '\n',
        );
        await expect(preview.locator('h1').first()).toHaveText('پیش‌نمایش زنده');
        expect(await readFile(filename, 'utf8')).toBe(original);
      } else {
        await preview.getByRole('button', { name: 'Count: 0' }).click();
        await expect(preview.getByRole('button', { name: 'Count: 1' })).toBeVisible();
        host.stdin!.write(
          JSON.stringify([
            { path: filename, text: original.replace(fixture.heading, 'An unsaved live update.') },
          ]) + '\n',
        );
        await expect(preview.locator('h1')).toHaveText('An unsaved live update.');
        expect(await readFile(filename, 'utf8')).toBe(original);
        host.stdin!.write('[]\n');
        await expect(preview.locator('h1')).toHaveText(fixture.heading);
      }
    } finally {
      await writeFile(filename, original);
      host?.stdin?.end('\n');
      await expect
        .poll(
          async () => {
            try {
              await fetch('http://127.0.0.1:5173');
              return false;
            } catch {
              return true;
            }
          },
          { timeout: 10000 },
        )
        .toBe(true);
      host?.kill();
    }
  });
}
