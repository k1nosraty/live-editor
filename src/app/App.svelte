<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    Files,
    Search as SearchIcon,
    GitBranch,
    Puzzle,
    Settings as SettingsIcon,
    Code2,
    X,
    Plus,
    PanelLeft,
    PanelBottom,
    Columns2,
    Rows2,
    Play,
    Square,
    Command,
    ArrowRight,
    ChevronRight,
    FolderOpen,
    Check,
    AlertCircle,
    FileCode2,
    Braces,
    Hash,
    Copy,
    MoreHorizontal,
    LayoutTemplate,
  } from '@lucide/svelte';
  import CodeEditor from '../components/CodeEditor.svelte';
  import type { EditorApi } from '../components/CodeEditor.svelte';
  import Explorer from '../components/Explorer.svelte';
  import SearchPanel from '../components/Search.svelte';
  import GitPanel from '../components/GitPanel.svelte';
  import Inspector from '../components/Inspector.svelte';
  import SettingsPanel from '../components/Settings.svelte';
  import Extensions from '../components/Extensions.svelte';
  import Preview from '../components/Preview.svelte';
  import BottomPanel from '../components/BottomPanel.svelte';
  import MenuBar from '../components/MenuBar.svelte';
  import { studio } from './state.svelte';
  import { diagnostics } from '../features/editor/diagnostics';
  import * as actions from './actions';
  import { attempt } from './actions';
  import { dialog, finish } from './dialog.svelte';
  import { native, desktop, ask } from '../services/native';
  import {
    dirty,
    language,
    defaultLayout,
    type Selection,
    type Workspace,
    type ReadResult,
  } from '../shared/types';
  import { templates } from '../features/playground/templates';
  import { loadExtensions, saveExtensions, type Extension } from '../features/extensions/manager';

  let sidebar = $state('playgrounds');
  let selection = $state<Selection | null>(null);
  let api: EditorApi | null = null;
  let explorer = $state<Explorer>();
  let git = $state<GitPanel>();
  let preview = $state<Preview>();
  let project = $derived(studio.workspace);
  let tabMenu = $state('');
  let dragged = '';
  let palette = $state<'commands' | 'files' | null>(null);
  let paletteQuery = $state('');
  let paletteIndex = $state(0);
  let extensions = $state<Extension[]>(loadExtensions());
  let extensionPanel = $state<{ title: string; text: string } | null>(null);
  let importInput: HTMLInputElement;
  let extensionBackground = $state('');
  let recovering = false;

  function focusInput(node: HTMLInputElement) {
    requestAnimationFrame(() => node.focus());
  }
  const icons = [
    { id: 'explorer', label: 'Explorer', icon: Files },
    { id: 'search', label: 'Search', icon: SearchIcon },
    { id: 'git', label: 'Source Control', icon: GitBranch },
    { id: 'extensions', label: 'Extensions', icon: Puzzle },
  ];
  function navigate(line: number) {
    void tick().then(() => api?.go(line));
  }
  function toggleSidebar(id: string) {
    if (sidebar === id && studio.layout.sidebar) studio.layout.sidebar = false;
    else {
      sidebar = id;
      studio.layout.sidebar = true;
    }
  }
  function setExtensions(items: Extension[]) {
    extensions = items;
    saveExtensions(items);
    if (
      !items.some((e) => e.enabled && e.themes?.some((t) => t.background === extensionBackground))
    )
      extensionBackground = '';
  }
  async function extensionCommand(extension: Extension, id: string) {
    const command = extension.commands?.find((c) => c.id === id);
    if (!command || !extension.enabled) return;
    if (command.action === 'insertSnippet') {
      const snippet = extension.snippets?.find((s) => s.name === command.value);
      if (snippet) api?.insert(snippet.body);
    }
    if (command.action === 'newPlayground') {
      const template = extension.templates?.find((t) => t.name === command.value);
      if (template) await actions.newPlayground(template);
    }
    if (command.action === 'setTheme') {
      const theme = extension.themes?.find((t) => t.name === command.value);
      if (theme) {
        studio.settings.accent = theme.accent;
        extensionBackground = theme.background;
      }
    }
    if (command.action === 'showPanel') {
      const panel = extension.panels?.find((p) => p.id === command.value);
      if (panel) extensionPanel = { title: panel.title, text: panel.text };
    }
  }
  const commands = $derived([
    { id: 'new', title: 'New file', key: 'Ctrl+N' },
    { id: 'open', title: 'Open file…', key: 'Ctrl+O' },
    { id: 'folder', title: 'Open folder…', key: 'Ctrl+Shift+O' },
    { id: 'save', title: 'Save', key: 'Ctrl+S' },
    { id: 'saveAs', title: 'Save as…', key: 'Ctrl+Shift+S' },
    { id: 'saveAll', title: 'Save all' },
    { id: 'playground', title: 'New playground' },
    { id: 'import', title: 'Import playground…' },
    { id: 'exportHtml', title: 'Export playground as HTML' },
    { id: 'exportZip', title: 'Export playground as ZIP' },
    { id: 'exportFiles', title: 'Export separate HTML/CSS/JS files' },
    { id: 'copyOutput', title: 'Copy generated HTML' },
    { id: 'format', title: 'Format document', key: 'Shift+Alt+F' },
    { id: 'sidebar', title: 'Toggle sidebar', key: 'Ctrl+B' },
    { id: 'console', title: 'Toggle output panel', key: 'Ctrl+`' },
    { id: 'split', title: 'Toggle editor split' },
    { id: 'orientation', title: 'Toggle editor / preview layout' },
    { id: 'zen', title: 'Toggle focus mode' },
    { id: 'reset', title: 'Reset layout' },
    { id: 'refresh', title: 'Refresh preview', key: 'F5' },
    { id: 'start', title: 'Start Vite development server' },
    { id: 'stop', title: 'Stop development server' },
    { id: 'restart', title: 'Restart development server' },
    { id: 'settings', title: 'Open settings' },
    { id: 'extensions', title: 'Manage extensions' },
    ...extensions
      .filter((e) => e.enabled)
      .flatMap((e) =>
        (e.commands ?? []).map((c) => ({
          id: `extension:${e.id}:${c.id}`,
          title: `${e.name}: ${c.title}`,
          key: undefined,
        })),
      ),
  ]);
  const matches = $derived(
    commands.filter((c) => c.title.toLowerCase().includes(paletteQuery.toLowerCase())),
  );
  let fileMatches = $state<{ id: string; name: string; path?: string }[]>([]);
  $effect(() => {
    if (palette === 'files') {
      const q = paletteQuery.toLowerCase();
      fileMatches = studio.docs
        .filter((d) => d.name.toLowerCase().includes(q))
        .map((d) => ({ id: d.id, name: d.name, path: d.path }));
      if (studio.root && q && desktop) {
        let cancelled = false;
        const timer = setTimeout(() => {
          native<{ path: string; line: number; text: string }[]>('search', {
            root: studio.root,
            query: q,
            filename: true,
            excludes: studio.settings.excludes,
          })
            .then((hits) => {
              if (!cancelled) {
                const existing = new Set(fileMatches.map((d) => d.path));
                fileMatches = [
                  ...fileMatches,
                  ...hits
                    .filter((h) => !existing.has(h.path))
                    .map((h) => ({ id: h.path, path: h.path, name: h.text })),
                ].slice(0, 80);
              }
            })
            .catch((e) => (studio.notice = String(e)));
        }, 200);
        return () => {
          cancelled = true;
          clearTimeout(timer);
        };
      }
    }
  });
  async function start() {
    if (studio.runtimeStarting) return;
    if (!studio.root) throw new Error('Open a Vite project first');
    const workspace = await native<Workspace>('detect', { root: studio.root });
    studio.workspace = workspace;
    if (!workspace.dev)
      throw new Error('Configure scripts.dev as vite and install project dependencies first.');
    if (!workspace.dependenciesInstalled)
      throw new Error(
        `Install this project's dependencies first: run ${workspace.installCommand} in ${studio.root}, then start Vite again.`,
      );
    if (
      !(await ask(
        `Run ${workspace.manager} run dev in ${workspace.name}? This executes code from the project and its dependencies.`,
      ))
    )
      return;
    studio.serverLog = [];
    studio.layout.bottom = true;
    studio.runtimeStarting = true;
    try {
      studio.serverUrl = await native<string>('server_start', { root: studio.root });
    } finally {
      studio.runtimeStarting = false;
    }
  }
  async function stop() {
    await native('server_stop');
    studio.serverUrl = '';
  }
  async function execute(id: string) {
    palette = null;
    tabMenu = '';
    switch (id) {
      case 'new':
        studio.newDoc();
        break;
      case 'open':
        await actions.openFile();
        break;
      case 'folder':
        await actions.openFolder();
        sidebar = 'explorer';
        studio.layout.sidebar = true;
        break;
      case 'save':
        await actions.saveDoc();
        break;
      case 'saveAs':
        await actions.saveDoc(undefined, true);
        break;
      case 'saveAll':
        await actions.saveAll();
        break;
      case 'close':
        await actions.closeDoc(studio.active);
        break;
      case 'closeOthers':
        await actions.closeTabs('others');
        break;
      case 'closeAll':
        await actions.closeTabs('all');
        break;
      case 'reopen':
        actions.reopen();
        break;
      case 'playground':
        await actions.newPlayground();
        break;
      case 'import':
        importInput.click();
        break;
      case 'exportHtml':
        await actions.exportPlayground('html');
        break;
      case 'exportZip':
        await actions.exportPlayground('zip');
        break;
      case 'exportFiles':
        await actions.exportPlayground('files');
        break;
      case 'copyOutput':
        await actions.exportPlayground('copy');
        break;
      case 'format':
        await actions.formatDoc();
        break;
      case 'undo':
      case 'redo':
      case 'search':
      case 'replace':
      case 'selectAll':
        api?.action(id);
        break;
      case 'palette':
        palette = 'commands';
        paletteQuery = '';
        paletteIndex = 0;
        break;
      case 'quickOpen':
        palette = 'files';
        paletteQuery = '';
        paletteIndex = 0;
        break;
      case 'workspaceSearch':
        sidebar = 'search';
        studio.layout.sidebar = true;
        break;
      case 'sidebar':
        studio.layout.sidebar = !studio.layout.sidebar;
        break;
      case 'console':
        studio.layout.bottom = !studio.layout.bottom;
        break;
      case 'split':
        studio.layout.splitEditor = !studio.layout.splitEditor;
        break;
      case 'orientation':
        studio.layout.horizontal = !studio.layout.horizontal;
        break;
      case 'zen':
        studio.layout.zen = !studio.layout.zen;
        break;
      case 'previewOnly':
        studio.layout.previewOnly = !studio.layout.previewOnly;
        break;
      case 'reset':
        studio.layout = { ...defaultLayout };
        break;
      case 'refresh':
        preview?.refreshPreview();
        break;
      case 'settings':
        sidebar = 'settings';
        studio.layout.sidebar = true;
        break;
      case 'extensions':
        sidebar = 'extensions';
        studio.layout.sidebar = true;
        break;
      case 'start':
        await start();
        break;
      case 'stop':
        await stop();
        break;
      case 'restart':
        await stop();
        await start();
        break;
      case 'fullscreen':
        if (desktop) {
          await native('fullscreen');
        } else {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await document.documentElement.requestFullscreen();
        }
        break;
      case 'docs':
        extensionPanel = {
          title: 'Live Editor · Quick reference',
          text: 'Playground: write HTML, CSS, and JavaScript. Preview refreshes after 200 ms. CSS updates preserve page state.\n\nProjects: Open Folder grants access to that workspace. Static HTML previews include unsaved open buffers. React/Vue/Vite: install dependencies yourself, then Run → Start. Save changes for Vite HMR.\n\nInspector: activate the pointer in Preview, select an element, then choose an exact standalone CSS rule to edit. Generated styles are inspect-only.\n\nExtensions: install a local JSON manifest or ZIP containing manifest.json. Example packages are in extensions/examples.\n\nSearch: Ctrl+F · Replace: Ctrl+H · Command palette: Ctrl+Shift+P. Full documentation is in the repository docs folder.',
        };
        break;
      case 'about':
        extensionPanel = {
          title: 'Live Editor',
          text: 'Write. See. Ship.\n\nVersion 1.0.0 · Development build\nA focused, local-first live coding studio.\nMIT License · k1nosraty/live-editor\n\nDesktop release certification is tracked separately in docs/QA-REPORT.md.',
        };
        break;
      case 'exit':
        if (desktop) {
          await native('close');
        }
        break;
      default:
        if (id.startsWith('theme:')) {
          studio.settings.theme = id.slice(6) as typeof studio.settings.theme;
          extensionBackground = '';
        } else if (id.startsWith('git:')) {
          sidebar = 'git';
          studio.layout.sidebar = true;
          await tick();
          await git?.run(id.slice(4));
        } else if (id.startsWith('extension:')) {
          const e = extensions.find((e) => id.startsWith(`extension:${e.id}:`));
          if (e) await extensionCommand(e, id.slice(`extension:${e.id}:`.length));
        }
    }
  }
  const action = (id: string) => attempt(() => execute(id));
  const menus = $derived([
    {
      label: 'File',
      items: [
        { id: 'new', label: 'New File', key: 'Ctrl+N' },
        { id: 'open', label: 'Open File…', key: 'Ctrl+O', disabled: !desktop },
        { id: 'folder', label: 'Open Folder…', key: 'Ctrl+Shift+O', disabled: !desktop },
        {
          label: 'Recent Workspaces',
          items: studio.recent.map((p, i) => ({
            id: `recent:${i}`,
            label: p.split(/[\\/]/).at(-1) ?? p,
          })),
        },
        { label: '-' },
        { id: 'save', label: 'Save', key: 'Ctrl+S' },
        { id: 'saveAs', label: 'Save As…', key: 'Ctrl+Shift+S', disabled: !desktop },
        { id: 'saveAll', label: 'Save All', disabled: !desktop },
        {
          label: 'Playground',
          items: [
            { id: 'playground', label: 'New Playground' },
            { id: 'import', label: 'Import…' },
            { id: 'exportHtml', label: 'Export HTML…' },
            { id: 'exportFiles', label: 'Export separate files…' },
            { id: 'exportZip', label: 'Export ZIP…' },
            { id: 'copyOutput', label: 'Copy generated HTML' },
          ],
        },
        { label: '-' },
        { id: 'close', label: 'Close Tab', key: 'Ctrl+W' },
        { id: 'closeOthers', label: 'Close Other Tabs' },
        { id: 'closeAll', label: 'Close All Tabs' },
        { id: 'reopen', label: 'Reopen Closed Tab', key: 'Ctrl+Shift+T' },
        { id: 'exit', label: 'Exit', disabled: !desktop },
      ],
    },
    {
      label: 'Edit',
      items: [
        { id: 'undo', label: 'Undo', key: 'Ctrl+Z' },
        { id: 'redo', label: 'Redo', key: 'Ctrl+Y' },
        { label: '-' },
        { id: 'search', label: 'Find', key: 'Ctrl+F' },
        { id: 'replace', label: 'Replace', key: 'Ctrl+H' },
        { id: 'workspaceSearch', label: 'Search Workspace', key: 'Ctrl+Shift+F' },
        { id: 'selectAll', label: 'Select All', key: 'Ctrl+A' },
        { id: 'format', label: 'Format Document', key: 'Shift+Alt+F' },
      ],
    },
    {
      label: 'View',
      items: [
        { id: 'palette', label: 'Command Palette', key: 'Ctrl+Shift+P' },
        { id: 'quickOpen', label: 'Quick Open', key: 'Ctrl+P' },
        {
          label: 'Color Theme',
          items: [
            { id: 'theme:slate', label: 'Studio' },
            { id: 'theme:light', label: 'Daylight' },
            { id: 'theme:midnight', label: 'Midnight' },
          ],
        },
        { id: 'settings', label: 'Settings' },
        { label: '-' },
        { id: 'sidebar', label: 'Toggle Sidebar', key: 'Ctrl+B' },
        { id: 'console', label: 'Toggle Output', key: 'Ctrl+`' },
        { id: 'split', label: 'Split Editor' },
        { id: 'orientation', label: 'Horizontal / Vertical Split' },
        { id: 'previewOnly', label: 'Preview Only' },
        { id: 'zen', label: 'Focus Mode' },
        { id: 'fullscreen', label: 'Fullscreen', key: 'F11' },
        { id: 'reset', label: 'Reset Layout' },
      ],
    },
    {
      label: 'Run',
      items: [
        { id: 'refresh', label: 'Refresh Preview', key: 'F5' },
        { id: 'start', label: 'Start Vite Server', disabled: !desktop || !!studio.serverUrl },
        { id: 'stop', label: 'Stop Server', disabled: !studio.serverUrl },
        { id: 'restart', label: 'Restart Server', disabled: !studio.serverUrl },
      ],
    },
    {
      label: 'Git',
      items: ['init', 'history', 'create_branch', 'switch_branch', 'fetch', 'pull', 'push'].map(
        (id) => ({
          id: `git:${id}`,
          label: id.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase()),
          disabled: !desktop || !studio.root,
        }),
      ),
    },
    { label: 'Extensions', items: [{ id: 'extensions', label: 'Manage Local Extensions' }] },
    {
      label: 'Help',
      items: [
        { id: 'docs', label: 'Quick Reference' },
        { id: 'about', label: 'About Live Editor' },
      ],
    },
  ]);
  function menuAction(id: string) {
    if (id.startsWith('recent:')) {
      attempt(async () => {
        await actions.openFolder(studio.recent[Number(id.slice(7))]);
        sidebar = 'explorer';
      });
    } else action(id);
  }
  function resize(event: PointerEvent, part: 'sidebar' | 'editor' | 'bottom') {
    const startX = event.clientX,
      startY = event.clientY;
    const initial =
      part === 'sidebar'
        ? studio.layout.sidebarWidth
        : part === 'editor'
          ? studio.layout.editorPercent
          : studio.layout.bottomHeight;
    const target = event.currentTarget as HTMLElement;
    const rect = target.parentElement!.getBoundingClientRect();
    const move = (e: PointerEvent) => {
      if (part === 'sidebar')
        studio.layout.sidebarWidth = Math.min(500, Math.max(180, initial + e.clientX - startX));
      else if (part === 'bottom')
        studio.layout.bottomHeight = Math.min(
          innerHeight * 0.6,
          Math.max(100, initial + startY - e.clientY),
        );
      else
        studio.layout.editorPercent = Math.min(
          80,
          Math.max(
            20,
            initial +
              (studio.layout.horizontal
                ? (e.clientY - startY) / rect.height
                : (e.clientX - startX) / rect.width) *
                100,
          ),
        );
    };
    const stop = () => {
      document.body.classList.remove('resizing');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    document.body.classList.add('resizing');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
  }
  function reorder(id: string) {
    if (!dragged || dragged === id) return;
    const from = studio.docs.findIndex((d) => d.id === dragged);
    const to = studio.docs.findIndex((d) => d.id === id);
    if (from >= 0 && to >= 0) {
      const [d] = studio.docs.splice(from, 1);
      studio.docs.splice(to, 0, d);
    }
    dragged = '';
  }
  function extensionEvents(event: 'documentChanged' | 'documentOpened') {
    for (const extension of extensions.filter(
      (e) => e.enabled && e.permissions.includes('document:read'),
    )) {
      for (const integration of extension.events ?? []) {
        if (
          extensionPanel &&
          integration.on === event &&
          extensionPanel.title === extension.panels?.find((p) => p.id === integration.panel)?.title
        ) {
          const doc = studio.current;
          extensionPanel.text = integration.format
            .replaceAll('{name}', doc?.name ?? '')
            .replaceAll('{characters}', String(doc?.text.length ?? 0))
            .replaceAll('{lines}', String(doc?.text.split('\n').length ?? 0));
        }
      }
    }
  }
  let syntaxMessages: string[] = [];
  $effect(() => {
    const doc = studio.current;
    const text = doc?.text;
    void text;
    const timer = setTimeout(() => {
      const errors = doc ? diagnostics(doc) : [];
      studio.problems = [...studio.problems.filter((p) => !syntaxMessages.includes(p)), ...errors];
      syntaxMessages = errors;
    }, 500);
    return () => clearTimeout(timer);
  });
  let lastDoc = '';
  $effect(() => {
    const id = studio.active;
    if (id !== lastDoc) {
      lastDoc = id;
      extensionEvents('documentOpened');
    }
  });
  $effect(() => {
    const data = JSON.stringify({
      docs: studio.docs,
      active: studio.active,
      playgrounds: studio.playgrounds,
      playgroundId: studio.playgroundId,
      mode: studio.mode,
      root: studio.root,
      recent: studio.recent,
      settings: studio.settings,
      layout: studio.layout,
    });
    const timer = setTimeout(() => {
      try {
        studio.persist();
        if (desktop)
          native('recovery_save', { data }).catch((e) => (studio.notice = `Recovery error: ${e}`));
      } catch (e) {
        studio.notice = `Recovery error: ${e}`;
      }
    }, 350);
    return () => clearTimeout(timer);
  });
  function update(id: string, text: string) {
    studio.update(id, text);
    extensionEvents('documentChanged');
  }
  onMount(() => {
    const handler = (event: KeyboardEvent) => {
      if (dialog.resolve) {
        if (event.key === 'Escape') finish(null);
        return;
      }
      const editing = (event.target as HTMLElement).closest('input,textarea,select');
      const key =
        (event.ctrlKey || event.metaKey ? 'Ctrl+' : '') +
        (event.shiftKey ? 'Shift+' : '') +
        (event.altKey ? 'Alt+' : '') +
        (event.key.length === 1 ? event.key.toUpperCase() : event.key);
      const custom = Object.entries(studio.settings.shortcuts).find(
        ([, v]) => v.toLowerCase() === key.toLowerCase(),
      );
      const shortcuts: Record<string, string> = {
        'Ctrl+N': 'new',
        'Ctrl+O': 'open',
        'Ctrl+Shift+O': 'folder',
        'Ctrl+S': 'save',
        'Ctrl+Shift+S': 'saveAs',
        'Ctrl+Shift+F': 'workspaceSearch',
        'Ctrl+P': 'quickOpen',
        'Ctrl+Shift+P': 'palette',
        'Ctrl+B': 'sidebar',
        'Ctrl+`': 'console',
        'Ctrl+W': 'close',
        'Ctrl+Shift+T': 'reopen',
        F5: 'refresh',
        F11: 'fullscreen',
        'Shift+Alt+F': 'format',
      };
      const id = custom?.[0] ?? shortcuts[key];
      if (event.key === 'Escape') {
        palette = null;
        studio.layout.zen = false;
        document.querySelectorAll('details.menu[open]').forEach((n) => n.removeAttribute('open'));
      }
      if (palette) {
        if (event.key === 'ArrowDown') {
          paletteIndex++;
          event.preventDefault();
        }
        if (event.key === 'ArrowUp') {
          paletteIndex = Math.max(0, paletteIndex - 1);
          event.preventDefault();
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          if (palette === 'commands') {
            const command = matches[paletteIndex % Math.max(1, matches.length)];
            if (command) action(command.id);
          } else {
            const file = fileMatches[paletteIndex % Math.max(1, fileMatches.length)];
            if (file) {
              palette = null;
              attempt(async () => {
                if (studio.docs.some((d) => d.id === file.id)) studio.active = file.id;
                else if (file.path) await actions.openPath(file.path);
              });
            }
          }
        }
        if (!id) return;
      }
      if (key === 'Ctrl+Tab') {
        event.preventDefault();
        const docs = studio.visibleDocs;
        const index = docs.findIndex((d) => d.id === studio.active);
        studio.active = docs[(index + 1) % docs.length]?.id ?? '';
        return;
      }
      if (id) {
        event.preventDefault();
        action(id);
      } else if (!editing && key === 'Ctrl+Shift+I') {
        event.preventDefault();
        action('format');
      }
    };
    window.addEventListener('keydown', handler);
    const leave = (event: BeforeUnloadEvent) => {
      studio.persist();
      if (studio.docs.some((d) => !d.id.startsWith('pg:') && dirty(d))) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', leave);
    let alive = true;
    let polling = false;
    const interval = setInterval(async () => {
      if (!desktop || polling) return;
      polling = true;
      try {
        const events = await native<{ changes: string[]; logs: string[]; running: boolean }>(
          'poll',
        );
        if (!alive) return;
        if (events.logs.length)
          studio.serverLog = [...studio.serverLog, ...events.logs].slice(-1000);
        if (studio.serverUrl && !events.running) {
          studio.serverUrl = '';
          studio.notice = 'Development server exited. Check Server output.';
        }
        if (events.changes.length) {
          for (const doc of studio.docs.filter((d) => d.path && events.changes.includes(d.path))) {
            try {
              const data = await native<ReadResult>('read', { path: doc.path });
              if (data.revision !== doc.revision) {
                if (dirty(doc)) doc.conflict = true;
                else {
                  doc.text = data.text;
                  doc.saved = data.text;
                  doc.revision = data.revision;
                }
              }
            } catch {
              doc.conflict = true;
            }
          }
          await explorer?.refresh();
          await git?.refresh();
          if (!studio.serverUrl) preview?.refreshPreview();
        }
      } catch (e) {
        studio.notice = String(e);
      } finally {
        polling = false;
      }
    }, 1000);
    let unlisten: (() => void) | undefined;
    if (desktop) {
      attempt(async () => {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
          event.preventDefault();
          if (recovering) return;
          recovering = true;
          try {
            studio.persist();
            await native('recovery_save', { data: localStorage.getItem('renderift.session.v1') });
            if (
              studio.docs.some((d) => !d.id.startsWith('pg:') && dirty(d)) &&
              !(await ask(
                'Close Live Editor? Unsaved edits are preserved in recovery, but have not been saved to source files.',
              ))
            )
              return;
            await native('server_stop');
            await native('destroy');
          } finally {
            recovering = false;
          }
        });
        for (const doc of studio.docs.filter((d) => d.path)) {
          try {
            const data = await native<ReadResult>('read', { path: doc.path });
            if (data.revision !== doc.revision) {
              if (dirty(doc)) doc.conflict = true;
              else {
                doc.text = data.text;
                doc.saved = data.text;
                doc.revision = data.revision;
              }
            }
          } catch {
            doc.conflict = true;
          }
        }
        if (studio.root) {
          studio.workspace = await native<Workspace>('detect', { root: studio.root });
          await native('watch', { root: studio.root });
        }
      });
    }
    return () => {
      alive = false;
      clearInterval(interval);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('beforeunload', leave);
      unlisten?.();
    };
  });
</script>

<svelte:head
  ><title
    >Live Editor — {studio.mode === 'playground'
      ? studio.playground.name
      : (project?.name ?? 'Live Editor')}</title
  ></svelte:head
>
<div
  class="studio"
  data-theme={studio.settings.theme}
  data-density={studio.settings.density}
  class:zen={studio.layout.zen}
  style:--accent={studio.settings.accent}
  style:--extension-bg={extensionBackground || undefined}
>
  <header class="app-header">
    <div class="brand">
      <span class="brand-symbol"><Braces size={20} /></span><strong
        >live editor<span class="brand-period">.</span></strong
      >
    </div>
    <MenuBar {menus} onaction={menuAction} />
    <div class="project-title">
      {studio.mode === 'playground'
        ? studio.playground.name
        : (project?.name ?? 'No workspace')}<span>·</span><span class="muted"
        >{studio.mode === 'playground' ? 'Playground' : 'Project'}</span
      >
    </div>
    <button
      class="command-trigger"
      title="Command palette · Ctrl+Shift+P"
      onclick={() => action('palette')}
      ><SearchIcon size={14} /><span>Commands</span><kbd>Ctrl ⇧ P</kbd></button
    >
  </header>
  <div class="workbench">
    <nav class="activity-bar" aria-label="Workspace tools">
      {#each icons as item}<button
          class:active={sidebar === item.id && studio.layout.sidebar}
          title={item.label}
          aria-label={item.label}
          onclick={() => toggleSidebar(item.id)}><item.icon size={21} /></button
        >{/each}<span class="spacer"></span><button
        class:active={sidebar === 'settings' && studio.layout.sidebar}
        title="Settings"
        aria-label="Settings"
        onclick={() => toggleSidebar('settings')}><SettingsIcon size={21} /></button
      ><span class="local-badge" title="Local · offline capable">L</span>
    </nav>
    {#if studio.layout.sidebar && !studio.layout.zen}<aside
        class="sidebar"
        style:width={`${studio.layout.sidebarWidth}px`}
      >
        {#if sidebar === 'explorer'}<Explorer
            bind:this={explorer}
          />{:else if sidebar === 'search'}<SearchPanel
            onnavigate={navigate}
          />{:else if sidebar === 'git'}<GitPanel
            bind:this={git}
          />{:else if sidebar === 'extensions'}<Extensions
            {extensions}
            onchange={setExtensions}
            oncommand={(e, c) => attempt(() => extensionCommand(e, c))}
          />{:else if sidebar === 'settings'}<SettingsPanel />{:else}<div class="sidebar-heading">
            <strong>PLAYGROUNDS</strong><button
              title="New playground"
              aria-label="New playground"
              onclick={() => action('playground')}><Plus size={15} /></button
            >
          </div>
          <div class="playground-list">
            {#each studio.playgrounds as pg}<button
                class:active={studio.mode === 'playground' && studio.playgroundId === pg.id}
                onclick={() => studio.loadPlayground(pg.id)}
                ><Code2 size={15} /><span>{pg.name}</span>{#if studio.playgroundId === pg.id}<span
                    class="live-dot"
                  ></span>{/if}</button
              >{/each}
          </div>
          <div class="sidebar-form">
            <div class="tools">
              <button
                title="Rename playground"
                onclick={() => attempt(() => actions.playgroundAction('rename'))}>Rename</button
              ><button
                title="Duplicate playground"
                onclick={() => attempt(() => actions.playgroundAction('duplicate'))}
                ><Copy size={13} /></button
              ><button
                title="Delete playground"
                onclick={() => attempt(() => actions.playgroundAction('delete'))}
                ><X size={13} /></button
              >
            </div>
          </div>
          <div class="section-label">START WITH AN IDEA</div>
          <div class="template-list">
            {#each templates as template, i}<button
                onclick={() => attempt(() => actions.newPlayground(template))}
                ><span class="template-number">0{i + 1}</span><span>{template.name}</span
                ><ArrowRight size={12} /></button
              >{/each}
          </div>
          <div class="sidebar-callout">
            <LayoutTemplate size={18} /><strong>A place for your next idea.</strong>
            <p>Write a little. See it come alive.</p>
            <button onclick={() => action('folder')} disabled={!desktop}
              ><FolderOpen size={13} />Open a real project<ArrowRight size={12} /></button
            >
          </div>{/if}
      </aside>
      <button
        class="divider sidebar-divider"
        title="Resize sidebar"
        aria-label="Resize sidebar"
        onpointerdown={(e) => resize(e, 'sidebar')}
      ></button>{/if}
    <main class="main-area">
      <div class="workspace-toolbar">
        <div class="mode-tabs">
          <button
            class:active={studio.mode === 'playground'}
            onclick={() => {
              studio.loadPlayground(studio.playgroundId);
              sidebar = 'playgrounds';
            }}><Braces size={14} />Playground</button
          ><button
            class:active={studio.mode === 'project'}
            onclick={() => {
              studio.mode = 'project';
              studio.active = studio.visibleDocs[0]?.id ?? '';
              sidebar = 'explorer';
            }}><FolderOpen size={14} />Project</button
          >
        </div>
        <span class="breadcrumb"
          >{studio.mode === 'playground'
            ? 'Your workspace'
            : (project?.name ?? 'Workspace')}<ChevronRight size={12} />{studio.current?.name ??
            'Get started'}</span
        ><span class="spacer"></span>{#if studio.mode === 'project'}<button
            class="run-button"
            disabled={!desktop || studio.runtimeStarting}
            title={studio.serverUrl ? 'Stop Vite server' : 'Run Vite development server'}
            onclick={() => action(studio.serverUrl ? 'stop' : 'start')}
            >{#if studio.serverUrl}<Square size={12} />{:else}<Play
                size={12}
              />{/if}{studio.runtimeStarting
              ? 'Starting…'
              : studio.serverUrl
                ? 'Stop'
                : 'Run'}</button
          >{/if}
        <div class="tools layout-tools">
          <button
            title="Toggle sidebar"
            aria-label="Toggle sidebar"
            onclick={() => action('sidebar')}><PanelLeft size={15} /></button
          ><button
            title="Change split direction"
            aria-label="Change split direction"
            onclick={() => action('orientation')}
            >{#if studio.layout.horizontal}<Rows2 size={15} />{:else}<Columns2
                size={15}
              />{/if}</button
          ><button
            title="Toggle output panel"
            aria-label="Toggle output panel"
            onclick={() => action('console')}><PanelBottom size={15} /></button
          >
        </div>
      </div>
      <div class="editing-region" class:horizontal={studio.layout.horizontal}>
        {#if !studio.layout.previewOnly}<section
            class="editor-panel"
            aria-label="Source editor"
            style:flex-basis={`${studio.layout.editorPercent}%`}
          >
            <div class="document-tabs" role="tablist" aria-label="Open files">
              {#each studio.visibleDocs as doc (doc.id)}<div
                  class="document-tab"
                  class:active={studio.active === doc.id}
                  draggable="true"
                  ondragstart={() => (dragged = doc.id)}
                  ondragover={(e) => e.preventDefault()}
                  ondrop={() => reorder(doc.id)}
                  role="presentation"
                >
                  <button
                    role="tab"
                    aria-selected={studio.active === doc.id}
                    class="tab-name"
                    onclick={() => (studio.active = doc.id)}
                    oncontextmenu={(e) => {
                      e.preventDefault();
                      studio.active = doc.id;
                      tabMenu = doc.id;
                    }}
                    >{#if doc.name.endsWith('.css')}<Hash
                        size={14}
                        color="#8db6ff"
                      />{:else if doc.name.endsWith('.js')}<Braces
                        size={14}
                        color="#e0c37a"
                      />{:else}<Code2
                        size={14}
                        color="#eaa580"
                      />{/if}{doc.name}{#if dirty(doc)}<span class="dirty-dot"></span>{/if}</button
                  ><button
                    class="tab-close"
                    title={`Close ${doc.name}`}
                    aria-label={`Close ${doc.name}`}
                    onclick={() => attempt(() => actions.closeDoc(doc.id))}><X size={12} /></button
                  >
                </div>{/each}<button
                title="New file"
                aria-label="New file"
                onclick={() => action('new')}><Plus size={15} /></button
              ><span class="spacer"></span><button
                title="Tab actions"
                aria-label="Tab actions"
                onclick={() => (tabMenu = tabMenu ? '' : studio.active)}
                ><MoreHorizontal size={15} /></button
              >
            </div>
            {#if tabMenu}<div class="tab-context context-menu">
                <button onclick={() => action('close')}>Close tab</button><button
                  onclick={() => action('closeOthers')}>Close other tabs</button
                ><button onclick={() => action('closeAll')}>Close all tabs</button><button
                  onclick={() => action('reopen')}>Reopen closed tab</button
                >
              </div>{/if}
            {#if studio.current?.conflict}<div class="conflict-bar">
                <AlertCircle size={14} />File changed on disk.<button
                  onclick={() => attempt(() => actions.reloadDoc(studio.current!))}
                  >Reload disk version</button
                ><button onclick={() => action('saveAs')}>Save As</button>
              </div>{/if}
            <div class="editor-instances">
              {#if studio.current}<div class="editor-instance">
                  <CodeEditor
                    doc={studio.current}
                    settings={studio.settings}
                    onchange={update}
                    oncursor={(line, column) => (studio.cursor = { line, column })}
                    onready={(value) => (api = value)}
                  />
                </div>
                {#if studio.layout.splitEditor}<div class="editor-instance secondary-editor">
                    <CodeEditor
                      doc={studio.current}
                      settings={studio.settings}
                      onchange={update}
                      oncursor={(line, column) => (studio.cursor = { line, column })}
                    />
                  </div>{/if}{:else}<div class="editor-empty">
                  <span class="brand-symbol large"><Braces size={35} /></span>
                  <h1>A little code.<br />A new possibility.</h1>
                  <p>Open a file, or start something fresh.</p>
                  <button class="primary" onclick={() => action('new')}
                    ><Plus size={14} />New file</button
                  ><button class="outlined" disabled={!desktop} onclick={() => action('folder')}
                    ><FolderOpen size={14} />Open folder</button
                  >
                </div>{/if}
            </div>
            <div class="editor-hint">
              <span
                ><span class="live-dot"></span>{studio.serverUrl
                  ? 'Save to update Vite preview'
                  : 'Changes appear as you type'}</span
              ><button title="Format document" onclick={() => action('format')}
                >Format<kbd>⇧ Alt F</kbd></button
              >
            </div>
          </section>
          <button
            class="divider editor-divider"
            title="Resize editor and preview"
            aria-label="Resize editor and preview"
            onpointerdown={(e) => resize(e, 'editor')}
          ></button>{/if}
        <Preview
          bind:this={preview}
          onselect={(s) => (selection = s)}
          onstart={() => action('start')}
        />{#if selection}<Inspector
            {selection}
            onclose={() => (selection = null)}
            onnavigate={navigate}
          />{/if}
      </div>
      {#if studio.layout.bottom && !studio.layout.zen}<button
          class="divider bottom-divider"
          title="Resize output panel"
          aria-label="Resize output panel"
          onpointerdown={(e) => resize(e, 'bottom')}
        ></button>
        <div class="bottom-wrapper" style:height={`${studio.layout.bottomHeight}px`}>
          <BottomPanel
            onnavigate={(source, line) => {
              const doc = studio.docs.find(
                (d) =>
                  source.endsWith(d.name) || (source === 'playground.js' && d.id.endsWith(':js')),
              );
              if (doc) {
                studio.active = doc.id;
                navigate(line);
              }
            }}
          />
        </div>{/if}
    </main>
  </div>
  <footer class="status-bar">
    <button
      onclick={() => {
        sidebar = 'git';
        studio.layout.sidebar = true;
      }}
      ><GitBranch size={12} />{studio.root
        ? studio.gitBranch || 'No Git branch'
        : 'Playground'}</button
    ><span class="status-local"><Check size={12} />Local workspace</span><span class="spacer"
    ></span><span>Ln {studio.cursor.line}, Col {studio.cursor.column}</span><span
      >{studio.settings.spaces ? 'Spaces' : 'Tab'}: {studio.settings.tabSize}</span
    ><span>UTF-8</span><span>{studio.current ? language(studio.current.name) : '—'}</span><button
      onclick={() => action('refresh')}><span class="live-dot"></span>Live Preview</button
    ><button title="Open problems" onclick={() => (studio.layout.bottom = true)}
      ><AlertCircle size={12} />{studio.problems.length}</button
    >
  </footer>
  {#if studio.notice}<div class="toast" role="status">
      <span>{studio.notice}</span><button
        aria-label="Dismiss notification"
        onclick={() => (studio.notice = '')}><X size={14} /></button
      >
    </div>{/if}
</div>
<input
  hidden
  type="file"
  accept=".html,.htm,.json"
  bind:this={importInput}
  onchange={(e) => {
    const file = e.currentTarget.files?.[0];
    if (file) attempt(() => actions.importPlayground(file));
    e.currentTarget.value = '';
  }}
/>
{#if dialog.resolve}<div class="modal-backdrop">
    <form
      class="dialog"
      aria-label={dialog.title}
      onsubmit={(e) => {
        e.preventDefault();
        finish(dialog.value);
      }}
    >
      <h2>{dialog.title}</h2>
      <label>{dialog.label}<input use:focusInput bind:value={dialog.value} /></label>
      <div class="dialog-actions">
        <button type="button" onclick={() => finish(null)}>Cancel</button><button
          class="primary"
          type="submit">Continue</button
        >
      </div>
    </form>
  </div>{/if}
{#if palette}<div
    class="palette-backdrop"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) palette = null;
    }}
  >
    <div
      class="command-palette"
      role="dialog"
      aria-label={palette === 'commands' ? 'Command palette' : 'Quick open'}
    >
      <div class="palette-input">
        <Command size={17} /><input
          use:focusInput
          aria-label="Command search"
          placeholder={palette === 'commands' ? 'What would you like to do?' : 'Go to file…'}
          bind:value={paletteQuery}
          oninput={() => (paletteIndex = 0)}
        /><kbd>Esc</kbd>
      </div>
      <div class="palette-results">
        {#if palette === 'commands'}{#each matches as command, i}<button
              class:highlighted={i === paletteIndex % Math.max(1, matches.length)}
              onclick={() => action(command.id)}
              ><span>{command.title}</span>{#if command.key}<kbd>{command.key}</kbd>{/if}</button
            >{/each}{:else}{#each fileMatches as file, i}<button
              class:highlighted={i === paletteIndex % Math.max(1, fileMatches.length)}
              onclick={() => {
                palette = null;
                attempt(async () => {
                  if (studio.docs.some((d) => d.id === file.id)) studio.active = file.id;
                  else if (file.path) await actions.openPath(file.path);
                });
              }}><FileCode2 size={14} />{file.name}</button
            >{/each}{/if}
      </div>
      <footer>↑ ↓ to navigate<span>↵ to select</span></footer>
    </div>
  </div>{/if}
{#if extensionPanel}<div class="modal-backdrop" role="presentation">
    <div class="dialog info-dialog" role="dialog" aria-label={extensionPanel.title}>
      <div class="dialog-title">
        <h2>{extensionPanel.title}</h2>
        <button aria-label="Close information" onclick={() => (extensionPanel = null)}
          ><X size={17} /></button
        >
      </div>
      <pre>{extensionPanel.text}</pre>
      <button class="primary" onclick={() => (extensionPanel = null)}>Done</button>
    </div>
  </div>{/if}
