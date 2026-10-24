import { describe, it, expect, vi } from 'vitest';
import { dirty, language, safeRelative } from '../src/shared/types';
import { normalizeSettings, readSession, writeSession } from '../src/features/settings/persistence';
import { buildPlayground, Scheduler } from '../src/features/preview/engine';
import { sourceRules, updateDeclaration } from '../src/features/inspector/css';
import { validateExtension, unpack } from '../src/features/extensions/manager';
import { strToU8, zipSync } from 'fflate';
describe('document model', () => {
  it('compares unsaved buffers, including undo back to baseline', () => {
    const d = { id: 'a', name: 'x.ts', text: 'a', saved: 'a' };
    expect(dirty(d)).toBe(false);
    d.text = 'b';
    expect(dirty(d)).toBe(true);
    d.text = 'a';
    expect(dirty(d)).toBe(false);
    expect(language('component.tsx')).toBe('TSX');
  });
});
describe('workspace paths', () => {
  it('rejects traversal, drive paths, and empty segments', () => {
    for (const path of ['../outside', '/etc/passwd', 'C:\\Windows', 'a/../b', 'a//b', ''])
      expect(safeRelative(path)).toBe(false);
    expect(safeRelative('assets/logo.svg')).toBe(true);
  });
});
describe('session persistence', () => {
  it('round trips recovery separately from originals and recovers corrupted settings', () => {
    let data = '';
    const store = {
      getItem: () => data,
      setItem: (_k: string, v: string) => {
        data = v;
      },
    };
    writeSession(
      {
        docs: [],
        active: '',
        playgrounds: [],
        playgroundId: '',
        mode: 'playground',
        root: '',
        recent: [],
        settings: normalizeSettings({ fontSize: 999, accent: 'url(evil)' }),
        layout: {
          sidebar: true,
          bottom: true,
          horizontal: false,
          zen: false,
          previewOnly: false,
          sidebarWidth: 230,
          editorPercent: 50,
          bottomHeight: 180,
          splitEditor: false,
        },
      },
      store,
    );
    expect(readSession(store).settings?.fontSize).toBe(32);
    expect(readSession(store).settings?.accent).toBe('#65e6bb');
    data = '{broken';
    expect(readSession(store)).toEqual({});
  });
});
describe('preview updates', () => {
  it('coalesces typing and cancels obsolete sessions', () => {
    vi.useFakeTimers();
    const scheduler = new Scheduler();
    const fn = vi.fn();
    scheduler.schedule(fn, 200);
    scheduler.schedule(fn, 200);
    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    scheduler.schedule(fn, 200);
    scheduler.cancel();
    vi.runAllTimers();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
  it('contains a restrictive CSP and escapes closing script tags', () => {
    const html = buildPlayground(
      {
        html: '<p>سلام</p>',
        css: 'p{color:red}',
        js: 'console.log("</script><script>escape")',
      },
      '',
    );
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain('<\\/script>');
    expect(html).toContain('سلام');
  });
});
describe('inspector transformations', () => {
  it('changes the chosen declaration without touching comments or other rules', () => {
    const css =
      '/* .x { color: red; } */\n.x, .y { color: red; padding: 1px; }\n.x { color: red; }';
    const out = updateDeclaration(css, '.x, .y', 'color', '#123456');
    expect(out).toContain('/* .x { color: red; } */');
    expect(out).toContain('.x { color: red; }');
    expect(out).toContain('.x, .y { color: #123456; padding: 1px; }');
    expect(sourceRules(out, 'style.css')[0].line).toBe(2);
  });
  it('tracks repeated selectors and refuses unsafe edits', () => {
    expect(
      updateDeclaration(
        '.x{color:red}@media(min-width:1px){.x{color:blue}}',
        '.x',
        'color',
        'green',
        1,
      ),
    ).toContain('.x{color:green}');
    expect(() => updateDeclaration('.x{}', '.missing', 'color', 'red')).toThrow('Exact source');
    expect(() => updateDeclaration('.x{}', '.x', 'color', 'red;display:none')).toThrow();
  });
});
describe('extensions', () => {
  const manifest = {
    id: 'sample.theme',
    name: 'Theme',
    version: '1.0.0',
    apiVersion: '1',
    permissions: [],
    themes: [{ name: 'Forest', accent: '#65e6bb', background: '#172033' }],
  };
  it('validates compatibility and denies native privileges', () => {
    expect(validateExtension(manifest).enabled).toBe(true);
    expect(() => validateExtension({ ...manifest, apiVersion: '2' })).toThrow();
    expect(() => validateExtension({ ...manifest, permissions: ['shell'] })).toThrow();
    expect(() =>
      validateExtension({
        ...manifest,
        themes: [{ name: 'bad', accent: 'url(x)', background: 'red' }],
      }),
    ).toThrow();
  });
  it('installs a package and rejects archive traversal and executable payloads', () => {
    expect(
      unpack(zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)) }), 'theme.zip').id,
    ).toBe('sample.theme');
    expect(() => unpack(zipSync({ '../manifest.json': strToU8('{}') }), 'evil.zip')).toThrow();
    expect(() => unpack(zipSync({ 'main.js': strToU8('invoke()') }), 'evil.zip')).toThrow();
  });
});

import { selectionMessage } from '../src/features/inspector/validation';
describe('untrusted inspector messages', () => {
  it('rejects malformed rules and computed-style payloads', () => {
    expect(
      selectionMessage({
        tag: 'p',
        id: '',
        classes: '',
        selector: 'p',
        width: 1,
        height: 1,
        styles: null,
        rules: [],
      }),
    ).toBeNull();
    expect(
      selectionMessage({
        tag: 'p',
        id: '',
        classes: '',
        selector: 'p',
        width: 1,
        height: 1,
        styles: { color: 'red' },
        rules: [null],
      }),
    ).toBeNull();
    expect(
      selectionMessage({
        tag: 'p',
        id: '',
        classes: '',
        selector: 'p',
        width: 1,
        height: 1,
        styles: { color: 'red' },
        rules: [],
      }),
    ).not.toBeNull();
  });
});
