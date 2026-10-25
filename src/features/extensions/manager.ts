import { unzipSync, strFromU8 } from 'fflate';
import type { Template } from '../playground/templates';
export interface Extension {
  id: string;
  name: string;
  version: string;
  apiVersion: '1';
  permissions: string[];
  enabled: boolean;
  themes?: { name: string; accent: string; background: string }[];
  snippets?: { name: string; language: string; body: string }[];
  templates?: Template[];
  commands?: {
    id: string;
    title: string;
    action: 'insertSnippet' | 'newPlayground' | 'showPanel' | 'setTheme';
    value: string;
  }[];
  panels?: { id: string; title: string; text: string }[];
  events?: {
    on: 'documentChanged' | 'documentOpened';
    panel: string;
    format: string;
  }[];
}
const key = 'renderift.extensions.v1';
export function validateExtension(data: unknown): Extension {
  if (!data || typeof data !== 'object') throw new Error('Manifest must be an object');
  const p = data as Extension;
  if (
    !/^[a-z0-9][a-z0-9.-]{2,80}$/.test(p.id ?? '') ||
    typeof p.name !== 'string' ||
    p.name.length > 100 ||
    !/^\d+\.\d+\.\d+$/.test(p.version ?? '') ||
    p.apiVersion !== '1'
  )
    throw new Error('Invalid manifest or incompatible API version');
  if (!Array.isArray(p.permissions) || p.permissions.some((x) => x !== 'document:read'))
    throw new Error(
      'Unsupported permission. Extensions cannot access filesystem, network, or shell.',
    );
  const text = (v: unknown) => typeof v === 'string' && v.length <= 200000;
  if (
    p.themes &&
    (!Array.isArray(p.themes) ||
      p.themes.some(
        (t) =>
          !text(t.name) || !/^#[a-f\d]{6}$/i.test(t.accent) || !/^#[a-f\d]{6}$/i.test(t.background),
      ))
  )
    throw new Error('Invalid theme');
  if (
    p.snippets &&
    (!Array.isArray(p.snippets) ||
      p.snippets.some((s) => !text(s.name) || !text(s.language) || !text(s.body)))
  )
    throw new Error('Invalid snippet');
  if (
    p.templates &&
    (!Array.isArray(p.templates) ||
      p.templates.some(
        (t) => !['name', 'html', 'css', 'js'].every((k) => text(t[k as keyof Template])),
      ))
  )
    throw new Error('Invalid template');
  if (
    p.commands &&
    (!Array.isArray(p.commands) ||
      p.commands.some(
        (c) =>
          !text(c.id) ||
          !text(c.title) ||
          !text(c.value) ||
          !['insertSnippet', 'newPlayground', 'showPanel', 'setTheme'].includes(c.action),
      ))
  )
    throw new Error('Invalid command contribution');
  if (
    p.panels &&
    (!Array.isArray(p.panels) ||
      p.panels.some((v) => !text(v.id) || !text(v.title) || !text(v.text)))
  )
    throw new Error('Invalid panel');
  if (
    p.events &&
    (!Array.isArray(p.events) ||
      p.events.some(
        (e) =>
          !p.permissions.includes('document:read') ||
          !['documentChanged', 'documentOpened'].includes(e.on) ||
          !text(e.panel) ||
          !text(e.format),
      ))
  )
    throw new Error('Event integrations require document:read permission');
  for (const c of p.commands ?? []) {
    const exists =
      c.action === 'insertSnippet'
        ? p.snippets?.some((s) => s.name === c.value)
        : c.action === 'newPlayground'
          ? p.templates?.some((t) => t.name === c.value)
          : c.action === 'setTheme'
            ? p.themes?.some((t) => t.name === c.value)
            : p.panels?.some((v) => v.id === c.value);
    if (!exists) throw new Error('Command refers to a missing contribution');
  }
  if (p.events?.some((e) => !p.panels?.some((panel) => panel.id === e.panel)))
    throw new Error('Event refers to a missing panel');
  return { ...p, enabled: true };
}
export function unpack(bytes: Uint8Array, name: string): Extension {
  if (bytes.length > 1024 * 1024) throw new Error('Extension package exceeds 1 MiB');
  if (name.endsWith('.json')) return validateExtension(JSON.parse(strFromU8(bytes)));
  let total = 0;
  const files = unzipSync(bytes, {
    filter: (file) => {
      total += file.originalSize;
      if (file.originalSize > 1024 * 1024 || total > 2 * 1024 * 1024)
        throw new Error('Expanded extension exceeds 2 MiB');
      if (!/^[\w.-]+$/.test(file.name) || file.name !== 'manifest.json')
        throw new Error('Only a root manifest.json is allowed in v1 extension packages');
      return true;
    },
  });
  if (!files['manifest.json']) throw new Error('Missing manifest.json');
  return validateExtension(JSON.parse(strFromU8(files['manifest.json'])));
}
export function loadExtensions(): Extension[] {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? '[]') as Extension[]).map((p) => ({
      ...validateExtension(p),
      enabled: p.enabled,
    }));
  } catch {
    return [];
  }
}
export function saveExtensions(extensions: Extension[]) {
  localStorage.setItem(key, JSON.stringify(extensions));
}
