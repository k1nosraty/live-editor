import {
  defaultLayout,
  defaultSettings,
  type Doc,
  type Layout,
  type Playground,
  type Settings,
} from '../../shared/types';
export interface Session {
  docs: Doc[];
  active: string;
  playgrounds: Playground[];
  playgroundId: string;
  mode: 'playground' | 'project';
  root: string;
  recent: string[];
  settings: Settings;
  layout: Layout;
}
// Preserve recovery from candidates published under the former working name.
const key = 'renderift.session.v1';
const bounded = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
export function normalizeSettings(value: Partial<Settings>): Settings {
  if (!value || typeof value !== 'object') value = {};
  return {
    ...defaultSettings,
    theme: ['slate', 'light', 'midnight'].includes(value.theme ?? '')
      ? value.theme!
      : defaultSettings.theme,
    accent:
      typeof value.accent === 'string' && /^#[a-f\d]{6}$/i.test(value.accent)
        ? value.accent
        : defaultSettings.accent,
    fontSize: bounded(value.fontSize, 14, 10, 32),
    font: typeof value.font === 'string' ? value.font.slice(0, 200) : defaultSettings.font,
    tabSize: Math.round(bounded(value.tabSize, 2, 1, 8)),
    debounce: bounded(value.debounce, 200, 50, 3000),
    spaces: typeof value.spaces === 'boolean' ? value.spaces : true,
    wrap: value.wrap === true,
    density: value.density === 'comfortable' ? 'comfortable' : 'compact',
    excludes: typeof value.excludes === 'string' ? value.excludes : defaultSettings.excludes,
    shortcuts:
      value.shortcuts && typeof value.shortcuts === 'object'
        ? Object.fromEntries(
            Object.entries(value.shortcuts).filter(([, v]) => typeof v === 'string'),
          )
        : {},
  };
}
export function readSession(storage: Pick<Storage, 'getItem'> = localStorage): Partial<Session> {
  try {
    const data = JSON.parse(storage.getItem(key) ?? '{}') as Partial<Session>;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const layout: Layout = { ...defaultLayout };
    for (const key of [
      'sidebar',
      'bottom',
      'horizontal',
      'zen',
      'previewOnly',
      'splitEditor',
    ] as const)
      if (typeof data.layout?.[key] === 'boolean') layout[key] = data.layout[key];
    layout.sidebarWidth = bounded(data.layout?.sidebarWidth, 230, 180, 500);
    layout.editorPercent = bounded(data.layout?.editorPercent, 50, 20, 80);
    layout.bottomHeight = bounded(data.layout?.bottomHeight, 180, 100, 600);
    return {
      active: typeof data.active === 'string' ? data.active : '',
      playgroundId: typeof data.playgroundId === 'string' ? data.playgroundId : '',
      mode: data.mode === 'project' ? 'project' : 'playground',
      root: typeof data.root === 'string' ? data.root : '',
      recent: Array.isArray(data.recent)
        ? data.recent.filter((p) => typeof p === 'string').slice(0, 10)
        : [],
      docs: Array.isArray(data.docs)
        ? data.docs.filter(
            (d) =>
              d &&
              typeof d.id === 'string' &&
              typeof d.text === 'string' &&
              typeof d.name === 'string' &&
              typeof d.saved === 'string' &&
              (d.path === undefined || typeof d.path === 'string'),
          )
        : [],
      playgrounds: Array.isArray(data.playgrounds)
        ? data.playgrounds.filter(
            (p) =>
              p &&
              ['id', 'name', 'html', 'css', 'js'].every(
                (k) => typeof p[k as keyof Playground] === 'string',
              ),
          )
        : [],
      settings: normalizeSettings(data.settings ?? {}),
      layout,
    };
  } catch {
    return {};
  }
}
export function writeSession(
  data: Session,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(key, JSON.stringify(data));
}
