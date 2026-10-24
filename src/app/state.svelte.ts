import {
  defaultLayout,
  defaultSettings,
  type Doc,
  type Mode,
  type Settings,
  type Layout,
  type Playground,
  type ConsoleEntry,
} from '../shared/types';
import { makePlayground } from '../features/playground/templates';
import { readSession, writeSession } from '../features/settings/persistence';
const saved = readSession();
export class Studio {
  docs = $state<Doc[]>(saved.docs ?? []);
  active = $state(saved.active ?? '');
  mode = $state<Mode>(saved.mode ?? 'playground');
  playgrounds = $state<Playground[]>(
    saved.playgrounds?.length ? saved.playgrounds : [makePlayground()],
  );
  playgroundId = $state(saved.playgroundId ?? '');
  settings = $state<Settings>(saved.settings ?? { ...defaultSettings });
  layout = $state<Layout>(saved.layout ?? { ...defaultLayout });
  root = $state(saved.root ?? '');
  recent = $state<string[]>(saved.recent ?? []);
  closed = $state<Doc[]>([]);
  console = $state<ConsoleEntry[]>([]);
  problems = $state<string[]>([]);
  serverLog = $state<string[]>([]);
  serverUrl = $state('');
  gitBranch = $state('');
  cursor = $state({ line: 1, column: 1 });
  notice = $state('');
  constructor() {
    if (!this.playgrounds.some((p) => p.id === this.playgroundId))
      this.playgroundId = this.playgrounds[0].id;
    if (this.mode === 'playground') this.loadPlayground(this.playgroundId);
  }
  get current() {
    return this.docs.find((d) => d.id === this.active);
  }
  get playground() {
    return this.playgrounds.find((p) => p.id === this.playgroundId)!;
  }
  get visibleDocs() {
    return this.docs.filter((d) =>
      this.mode === 'project'
        ? !d.id.startsWith('pg:')
        : d.id.startsWith(`pg:${this.playgroundId}:`),
    );
  }
  loadPlayground(id: string) {
    this.syncPlayground();
    this.playgroundId = id;
    const pg = this.playgrounds.find((p) => p.id === id)!;
    (['html', 'css', 'js'] as const).forEach((ext) => {
      const did = `pg:${id}:${ext}`;
      if (!this.docs.some((d) => d.id === did))
        this.docs.push({
          id: did,
          name: `index.${ext}`,
          text: pg[ext],
          saved: pg[ext],
        });
    });
    this.active = `pg:${id}:html`;
    this.mode = 'playground';
  }
  syncPlayground() {
    for (const p of this.playgrounds)
      for (const ext of ['html', 'css', 'js'] as const) {
        const d = this.docs.find((d) => d.id === `pg:${p.id}:${ext}`);
        if (d) p[ext] = d.text;
      }
  }
  update(id: string, text: string) {
    const doc = this.docs.find((d) => d.id === id);
    if (doc) {
      doc.text = text;
      this.syncPlayground();
    }
  }
  newDoc() {
    const doc: Doc = {
      id: crypto.randomUUID(),
      name: 'untitled.html',
      text: '',
      saved: '',
    };
    this.docs.push(doc);
    this.active = doc.id;
    this.mode = 'project';
    return doc;
  }
  remove(id: string) {
    const i = this.docs.findIndex((d) => d.id === id);
    if (i < 0) return;
    this.closed.unshift(this.docs[i]);
    this.closed = this.closed.slice(0, 20);
    this.docs.splice(i, 1);
    if (this.active === id) this.active = this.visibleDocs.at(-1)?.id ?? '';
  }
  log(level: string, message: string, extra: Partial<ConsoleEntry> = {}) {
    this.console.push({
      id: Date.now() + Math.random(),
      level,
      message,
      time: Date.now(),
      ...extra,
    });
    if (this.console.length > 1000) this.console.splice(0, this.console.length - 1000);
  }
  persist() {
    this.syncPlayground();
    writeSession({
      docs: this.docs,
      active: this.active,
      playgrounds: this.playgrounds,
      playgroundId: this.playgroundId,
      mode: this.mode,
      root: this.root,
      recent: this.recent,
      settings: this.settings,
      layout: this.layout,
    });
  }
}
export const studio = new Studio();
