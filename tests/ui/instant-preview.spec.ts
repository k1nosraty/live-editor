import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

for (const fixture of [
  { name: 'React', folder: 'react-vite', source: 'src/main.jsx', heading: 'A new perspective.' },
  { name: 'Vue', folder: 'vue-vite', source: 'src/App.vue', heading: 'Ideas, in motion.' },
]) {
  test(`${fixture.name} opens automatically and previews typing/undo without saving`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const root = path.resolve('examples', fixture.folder);
    const filename = path.join(root, fixture.source);
    const original = await readFile(filename, 'utf8');
    let host: ChildProcess | undefined;
    let trusted = false;
    let approvals = 0;
    let starts = 0;
    let saves = 0;
    let playground = '';
    const pending: Array<(value: unknown) => void> = [];
    const reply = () => new Promise((resolve) => pending.push(resolve));
    async function stop() {
      if (!host || host.exitCode !== null) return;
      const exited = new Promise((resolve) => host!.once('exit', resolve));
      host.stdin!.end('\n');
      await exited;
      host = undefined;
    }
    await page.exposeFunction(
      '__liveEditorDispatch',
      async (operation: string, args: Record<string, unknown>) => {
        switch (operation) {
          case 'select_folder':
            return root;
          case 'detect':
            return {
              root,
              name: fixture.folder,
              dev: true,
              framework: `${fixture.name} + Vite`,
              manager: 'npm',
              dependenciesInstalled: true,
              installCommand: 'npm ci',
            };
          case 'read': {
            const text = await readFile(String(args.path), 'utf8');
            return { text, revision: 'fixture' };
          }
          case 'list':
            return (await readdir(String(args.path), { withFileTypes: true })).map((entry) => ({
              name: entry.name,
              path: path.join(String(args.path), entry.name),
              directory: entry.isDirectory(),
            }));
          case 'git_status':
            return { branch: 'test', files: [] };
          case 'poll':
            return { changes: [], logs: [], running: !!host && host.exitCode === null };
          case 'server_trusted':
            return trusted;
          case 'confirm':
            approvals++;
            return true;
          case 'server_start': {
            starts++;
            trusted = trusted || args.trust === true;
            const ready = reply();
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
                root,
              ],
              {
                stdio: ['pipe', 'pipe', 'inherit'],
                env: {
                  ...process.env,
                  LIVE_EDITOR_INITIAL_BUFFERS: JSON.stringify(args.buffers ?? []),
                },
              },
            );
            createInterface({ input: host.stdout! }).on('line', (line) =>
              pending.shift()?.(JSON.parse(line)),
            );
            await ready;
            return 'http://127.0.0.1:5173';
          }
          case 'server_update': {
            const done = reply();
            host!.stdin!.write(JSON.stringify(args.buffers) + '\n');
            await done;
            return null;
          }
          case 'server_stop':
            await stop();
            return null;
          case 'save':
            saves++;
            throw new Error('Typing must never save source files');
          case 'playground_preview':
            playground = String(args.html);
            return 'http://127.0.0.1:1420/__test-playground';
          case 'watch':
          case 'recovery_load':
          case 'recovery_save':
            return null;
          default:
            throw new Error(`Unexpected native test operation: ${operation}`);
        }
      },
    );
    await page.addInitScript(() => {
      if (window !== window.top) return;
      const bridge = window as unknown as {
        __liveEditorDispatch: (
          operation: string,
          args: Record<string, unknown>,
        ) => Promise<unknown>;
      };
      let callback = 0;
      Object.assign(window, {
        isTauri: true,
        __RENDERIFT_NATIVE_TOKEN__: 'test-adapter',
        __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener() {} },
        __TAURI_INTERNALS__: {
          metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
          transformCallback: () => ++callback,
          unregisterCallback() {},
          invoke: (command: string, args: Record<string, unknown>) =>
            command === 'dispatch'
              ? bridge.__liveEditorDispatch(String(args.op), args.args as Record<string, unknown>)
              : Promise.resolve(1),
        },
      });
    });
    await page.route('**/__test-playground*', (route) =>
      route.fulfill({ contentType: 'text/html', body: playground }),
    );
    try {
      await page.goto('/');
      await expect(page.frameLocator('iframe').locator('h1')).toContainText('Make something');
      await page.keyboard.press('Control+Shift+o');
      const preview = page.frameLocator('iframe');
      await expect(preview.locator('h1')).toHaveText(fixture.heading);
      expect(starts).toBe(1);
      expect(approvals).toBe(1);
      await page.evaluate(async (filename) => {
        const module = '/src/app/actions.ts';
        await (await import(module)).openPath(filename);
      }, filename);
      const editor = page.locator('.cm-content').first();
      async function type(text: string) {
        await editor.click();
        await page.keyboard.press('Control+a');
        await page.keyboard.insertText(text);
      }
      const changed = original.replace(fixture.heading, 'No Run. No Save.');
      await type(changed);
      await expect(preview.locator('h1')).toHaveText('No Run. No Save.');
      expect(await readFile(filename, 'utf8')).toBe(original);
      await page.keyboard.press('Control+z');
      await expect(preview.locator('h1')).toHaveText(fixture.heading);
      await type(fixture.name === 'React' ? 'export default function ( {' : '<template><div>');
      await page.waitForTimeout(450);
      await expect(preview.locator('h1')).toHaveText(fixture.heading);
      await type(changed);
      await expect(preview.locator('h1')).toHaveText('No Run. No Save.');
      if (fixture.name === 'React') {
        await preview.getByRole('button', { name: 'Count: 0' }).click();
        const cssPath = path.join(root, 'src/style.css');
        const css = await readFile(cssPath, 'utf8');
        await page.evaluate(async (filename) => {
          const module = '/src/app/actions.ts';
          await (await import(module)).openPath(filename);
        }, cssPath);
        await type(css + '\nbody { background-color: rgb(12, 34, 56); }');
        await expect(preview.locator('body')).toHaveCSS('background-color', 'rgb(12, 34, 56)');
        await expect(preview.getByRole('button', { name: 'Count: 1' })).toBeVisible();
        expect(await readFile(cssPath, 'utf8')).toBe(css);
        const htmlPath = path.join(root, 'index.html');
        const html = await readFile(htmlPath, 'utf8');
        await page.evaluate(async (filename) => {
          const module = '/src/app/actions.ts';
          await (await import(module)).openPath(filename);
        }, htmlPath);
        await type(html.replace('<body>', '<body data-live-draft="yes">'));
        await expect(preview.locator('body')).toHaveAttribute('data-live-draft', 'yes');
        expect(await readFile(htmlPath, 'utf8')).toBe(html);
      }
      await page.locator('.run-button').click();
      await expect(page.locator('.runtime-empty')).toBeVisible();
      await page.keyboard.press('Control+Shift+o');
      await expect(preview.locator('h1')).toHaveText('No Run. No Save.');
      expect(starts).toBe(2);
      expect(approvals).toBe(1);
      expect(saves).toBe(0);
      expect(await readFile(filename, 'utf8')).toBe(original);
    } finally {
      await stop();
    }
  });
}
