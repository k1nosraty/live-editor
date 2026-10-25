import { studio } from './state.svelte';
import { native, desktop, pickFile, pickFolder, savePath, ask, download } from '../services/native';
import { prompt } from './dialog.svelte';
import { dirty, type Doc, type ReadResult, type Workspace } from '../shared/types';
import { templates, makePlayground, type Template } from '../features/playground/templates';
import { zipSync, strToU8 } from 'fflate';
import { buildPlayground } from '../features/preview/engine';
export async function attempt(action: () => void | Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    studio.notice = String(error);
    studio.problems = [String(error), ...studio.problems].slice(0, 100);
  }
}
export async function openPath(path: string): Promise<Doc> {
  const existing = studio.docs.find((d) => d.path === path);
  if (existing) {
    studio.active = existing.id;
    studio.mode = 'project';
    return existing;
  }
  const data = await native<ReadResult>('read', { path });
  const doc: Doc = {
    id: crypto.randomUUID(),
    name: path.split(/[\\/]/).at(-1) ?? path,
    path,
    text: data.text,
    saved: data.text,
    revision: data.revision,
  };
  studio.docs.push(doc);
  studio.active = doc.id;
  studio.mode = 'project';
  return doc;
}
export async function openFile() {
  const path = await pickFile();
  if (path) await openPath(path);
}
export async function openFolder(path?: string): Promise<Workspace | undefined> {
  if (studio.runtimeStarting) throw new Error('Wait for the current preview to finish starting.');
  path = path ?? (await pickFolder()) ?? undefined;
  if (!path) return;
  const workspace = await native<Workspace>('detect', { root: path });
  if (studio.serverUrl) {
    await native('server_stop');
    studio.serverUrl = '';
  }
  try {
    studio.gitBranch = (
      await native<import('../shared/types').GitStatus>('git_status', { root: path })
    ).branch;
  } catch {
    studio.gitBranch = '';
  }
  studio.root = workspace.root;
  studio.workspace = workspace;
  studio.mode = 'project';
  studio.recent = [path, ...studio.recent.filter((p) => p !== path)].slice(0, 10);
  await native('watch', { root: path });
  studio.active = studio.visibleDocs.at(-1)?.id ?? '';
  if (workspace.dev) {
    try {
      await openPath(`${workspace.root}/index.html`);
    } catch {
      /* Some projects use a custom entry. */
    }
    if (workspace.dependenciesInstalled) await startPreview();
  }
  return workspace;
}
export function runtimeBuffers() {
  return studio.docs
    .filter((doc) => doc.path && dirty(doc))
    .map((doc) => ({ path: doc.path!, text: doc.text }));
}
export async function startPreview() {
  if (studio.runtimeStarting || studio.serverUrl) return;
  if (!studio.root) throw new Error('Open a project first');
  studio.runtimeStarting = true;
  try {
    const workspace = await native<Workspace>('detect', { root: studio.root });
    studio.workspace = workspace;
    if (!workspace.dev) throw new Error('This project needs a Vite dev script.');
    if (!workspace.dependenciesInstalled)
      throw new Error(
        `Install dependencies once: run ${workspace.installCommand} in ${studio.root}.`,
      );
    const trusted = await native<boolean>('server_trusted', { root: studio.root });
    if (
      !trusted &&
      !(await ask(
        `Enable automatic live preview for ${workspace.name}? This runs the project's code and dependencies. Your choice is remembered for this folder.`,
      ))
    )
      return;
    studio.serverLog = [];
    studio.serverUrl = await native<string>('server_start', {
      root: studio.root,
      trust: !trusted,
      buffers: runtimeBuffers(),
    });
  } finally {
    studio.runtimeStarting = false;
  }
}
export async function saveDoc(doc = studio.current, as = false): Promise<boolean> {
  if (!doc) return false;
  if (doc.id.startsWith('pg:')) {
    await exportPlayground('html');
    return true;
  }
  let path = doc.path;
  let revision = doc.revision;
  if (as || !path) {
    path = (await savePath(doc.name)) ?? undefined;
    if (!path) return false;
    const open = studio.docs.find((d) => d.path === path && d.id !== doc.id);
    if (open) throw new Error('That file is already open. Save to another filename.');
    if (path !== doc.path) {
      try {
        const data = await native<ReadResult>('read', { path });
        if (!(await ask('Replace the existing file at this destination?'))) return false;
        revision = data.revision;
      } catch (error) {
        if (String(error).includes('already open')) throw error;
        revision = undefined;
      }
    }
  }
  if (!path) return false;
  try {
    const data = await native<ReadResult>('save', {
      path,
      text: doc.text,
      revision: revision ?? null,
    });
    doc.path = path;
    doc.name = path.split(/[\\/]/).at(-1) ?? doc.name;
    doc.saved = doc.text;
    doc.revision = data.revision;
    doc.conflict = false;
    studio.notice = `Saved ${doc.name}`;
    return true;
  } catch (error) {
    if (String(error).includes('CONFLICT')) doc.conflict = true;
    throw error;
  }
}
export async function saveAll() {
  for (const doc of studio.docs.filter((d) => !d.id.startsWith('pg:') && dirty(d)))
    if (!(await saveDoc(doc))) return false;
  return true;
}
export async function closeDoc(id: string) {
  const doc = studio.docs.find((d) => d.id === id);
  if (!doc) return;
  if (dirty(doc) && !id.startsWith('pg:')) {
    const answer = await prompt(
      'Unsaved changes',
      `Type save to save ${doc.name}, or discard to close without saving.`,
      'save',
    );
    if (answer === 'save') {
      if (!(await saveDoc(doc))) return;
    } else if (answer !== 'discard') return;
  }
  studio.remove(id);
}
export async function closeTabs(kind: 'all' | 'others') {
  for (const d of [...studio.visibleDocs])
    if (kind === 'all' || d.id !== studio.active) await closeDoc(d.id);
}
export function reopen() {
  const d = studio.closed.shift();
  if (d) {
    studio.docs.push(d);
    studio.active = d.id;
    studio.mode = d.id.startsWith('pg:') ? 'playground' : 'project';
  }
}
export async function reloadDoc(doc: Doc) {
  if (
    dirty(doc) &&
    !(await ask(`Reload ${doc.name}? Unsaved edits will be replaced by the disk version.`))
  )
    return;
  if (!doc.path) return;
  const data = await native<ReadResult>('read', { path: doc.path });
  doc.text = data.text;
  doc.saved = data.text;
  doc.revision = data.revision;
  doc.conflict = false;
}
export async function newPlayground(template: Template = templates[0]) {
  const name = await prompt('New playground', 'Playground name', template.name);
  if (!name?.trim()) return;
  const pg = makePlayground({ ...template, name: name.trim() });
  studio.playgrounds.push(pg);
  studio.loadPlayground(pg.id);
}
export async function playgroundAction(action: string) {
  const p = studio.playground;
  if (action === 'new') {
    await newPlayground();
    return;
  }
  if (action === 'rename') {
    const name = await prompt('Rename playground', 'Name', p.name);
    if (name?.trim()) p.name = name.trim();
  }
  if (action === 'duplicate') {
    const copy = makePlayground({ ...p, name: `${p.name} copy` });
    studio.playgrounds.push(copy);
    studio.loadPlayground(copy.id);
  }
  if (action === 'delete') {
    if (!(await ask(`Delete playground “${p.name}”?`))) return;
    studio.docs = studio.docs.filter((d) => !d.id.startsWith(`pg:${p.id}:`));
    studio.playgrounds = studio.playgrounds.filter((pg) => pg.id !== p.id);
    if (!studio.playgrounds.length) studio.playgrounds.push(makePlayground());
    studio.loadPlayground(studio.playgrounds[0].id);
  }
}
export async function exportPlayground(kind: 'html' | 'zip' | 'files' | 'copy') {
  studio.syncPlayground();
  const pg = studio.playground;
  const html = buildPlayground(pg, '');
  if (kind === 'copy') {
    await navigator.clipboard.writeText(html);
    studio.notice = 'Generated HTML copied';
    return;
  }
  if (kind === 'zip') {
    const index =
      '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head><body>' +
      pg.html +
      '<script src="script.js"></script></body></html>';
    download(
      `${pg.name.replace(/[^\w-]/g, '-')}.zip`,
      zipSync({
        'index.html': strToU8(index),
        'styles.css': strToU8(pg.css),
        'script.js': strToU8(pg.js),
      }).slice().buffer,
      'application/zip',
    );
    return;
  }
  if (kind === 'files') {
    if (!desktop) {
      await exportPlayground('zip');
      return;
    }
    const root = await pickFolder();
    if (!root) return;
    const files = {
      'index.html':
        '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head><body>' +
        pg.html +
        '<script src="script.js"></script></body></html>',
      'styles.css': pg.css,
      'script.js': pg.js,
    };
    for (const [name, text] of Object.entries(files)) {
      const path = `${root}/${name}`;
      let revision: string | undefined;
      try {
        revision = (await native<ReadResult>('read', { path })).revision;
        if (!(await ask(`Replace ${name}?`))) continue;
      } catch {
        /* New file. The backend rejects a conflicting existing file. */
      }
      await native('save', { path, text, revision: revision ?? null });
    }
    studio.notice = 'Playground exported';
    return;
  }
  if (desktop) {
    const path = await savePath('index.html');
    if (!path) return;
    let revision: string | undefined;
    try {
      revision = (await native<ReadResult>('read', { path })).revision;
      if (!(await ask('Replace this existing file?'))) return;
    } catch {
      /* New file. */
    }
    await native('save', { path, text: html, revision: revision ?? null });
  } else download('index.html', html, 'text/html');
}
export async function importPlayground(file: File) {
  if (file.size > 8 * 1024 * 1024) throw new Error('Playground import exceeds 8 MiB');
  const text = await file.text();
  if (file.name.endsWith('.json')) {
    const pg = JSON.parse(text) as Template;
    if (!['html', 'css', 'js'].every((k) => typeof pg[k as keyof Template] === 'string'))
      throw new Error('Expected a playground JSON with html, css, and js');
    await newPlayground({ ...pg, name: pg.name ?? file.name });
  } else if (/\.html?$/i.test(file.name)) {
    const parsed = new DOMParser().parseFromString(text, 'text/html');
    const css = Array.from(parsed.querySelectorAll('style'))
      .map((s) => s.textContent)
      .join('\n');
    const js = Array.from(parsed.querySelectorAll('script:not([src])'))
      .map((s) => s.textContent)
      .join('\n');
    parsed.querySelectorAll('script,style,meta[http-equiv]').forEach((s) => s.remove());
    await newPlayground({
      name: file.name,
      html: parsed.body.innerHTML,
      css,
      js,
    });
  } else throw new Error('Import an HTML or playground JSON file');
}
export async function formatDoc() {
  const doc = studio.current;
  if (!doc) return;
  const prettier = await import('prettier/standalone');
  const [html, css, babel, estree, typescript, markdown] = await Promise.all([
    import('prettier/plugins/html'),
    import('prettier/plugins/postcss'),
    import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
    import('prettier/plugins/typescript'),
    import('prettier/plugins/markdown'),
  ]);
  const ext = doc.name.split('.').pop();
  const parser = (
    {
      html: 'html',
      css: 'css',
      js: 'babel',
      jsx: 'babel',
      ts: 'typescript',
      tsx: 'typescript',
      json: 'json',
      vue: 'vue',
      md: 'markdown',
    } as Record<string, string>
  )[ext ?? ''];
  if (!parser) throw new Error('Formatting is supported for web source files and Markdown');
  studio.update(
    doc.id,
    await prettier.format(doc.text, {
      parser,
      plugins: [html, css, babel, estree, typescript, markdown],
      tabWidth: studio.settings.tabSize,
      useTabs: !studio.settings.spaces,
    }),
  );
}
