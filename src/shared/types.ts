export type Mode = 'playground' | 'project';
export interface Doc {
  id: string;
  name: string;
  path?: string;
  text: string;
  saved: string;
  revision?: string;
  conflict?: boolean;
}
export interface Playground {
  id: string;
  name: string;
  html: string;
  css: string;
  js: string;
}
export interface Settings {
  theme: 'slate' | 'light' | 'midnight';
  accent: string;
  font: string;
  fontSize: number;
  tabSize: number;
  spaces: boolean;
  wrap: boolean;
  debounce: number;
  density: 'compact' | 'comfortable';
  excludes: string;
  shortcuts: Record<string, string>;
}
export interface Layout {
  sidebar: boolean;
  bottom: boolean;
  horizontal: boolean;
  zen: boolean;
  previewOnly: boolean;
  sidebarWidth: number;
  editorPercent: number;
  bottomHeight: number;
  splitEditor: boolean;
}
export interface FileEntry {
  path: string;
  name: string;
  directory: boolean;
}
export interface ReadResult {
  text: string;
  revision: string;
}
export interface ConsoleEntry {
  id: number;
  level: string;
  message: string;
  time: number;
  source?: string;
  line?: number;
  column?: number;
  stack?: string;
}
export interface Workspace {
  root: string;
  name: string;
  framework: string;
  manager: string;
  dev: boolean;
  dependenciesInstalled: boolean;
  installCommand: string;
}
export interface SearchHit {
  path: string;
  line: number;
  text: string;
}
export interface GitFile {
  path: string;
  index: string;
  worktree: string;
}
export interface GitStatus {
  branch: string;
  files: GitFile[];
}
export interface RuleInfo {
  selector: string;
  css: string;
  sheet: string;
  index: number;
}
export interface Selection {
  tag: string;
  id: string;
  classes: string;
  selector: string;
  width: number;
  height: number;
  styles: Record<string, string>;
  rules: RuleInfo[];
}
export const defaultSettings: Settings = {
  theme: 'slate',
  accent: '#65e6bb',
  font: 'Cascadia Code, Consolas, monospace',
  fontSize: 14,
  tabSize: 2,
  spaces: true,
  wrap: false,
  debounce: 200,
  density: 'compact',
  excludes: 'node_modules,.git,dist,build,target',
  shortcuts: {},
};
export const defaultLayout: Layout = {
  sidebar: true,
  bottom: true,
  horizontal: false,
  zen: false,
  previewOnly: false,
  sidebarWidth: 230,
  editorPercent: 50,
  bottomHeight: 180,
  splitEditor: false,
};
export function language(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return (
    (
      {
        html: 'HTML',
        htm: 'HTML',
        css: 'CSS',
        js: 'JavaScript',
        mjs: 'JavaScript',
        ts: 'TypeScript',
        jsx: 'JSX',
        tsx: 'TSX',
        json: 'JSON',
        md: 'Markdown',
        vue: 'Vue',
      } as Record<string, string>
    )[ext] ?? 'Plain text'
  );
}
export function dirty(doc: Doc): boolean {
  return doc.text !== doc.saved;
}
export function safeRelative(path: string): boolean {
  return (
    !!path &&
    !/^[\\/]|^[A-Za-z]:|\0/.test(path) &&
    !path.split(/[\\/]/).some((x) => x === '..' || x === '.' || x === '')
  );
}
