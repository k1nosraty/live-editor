<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Monitor,
    Tablet,
    Smartphone,
    RotateCw,
    RefreshCw,
    MousePointer2,
    ExternalLink,
    Maximize,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Pause,
    Play,
  } from '@lucide/svelte';
  import { studio } from '../app/state.svelte';
  import { attempt, runtimeBuffers } from '../app/actions';
  import { desktop, native } from '../services/native';
  import {
    buildPlayground,
    buildHtmlDocument,
    bridgeScript,
    Scheduler,
  } from '../features/preview/engine';
  import { selectionMessage } from '../features/inspector/validation';
  import type { Selection } from '../shared/types';
  let {
    onselect,
    onstart,
  }: {
    onselect: (selection: Selection | null) => void;
    onstart: () => void;
  } = $props();
  let frame = $state<HTMLIFrameElement>();
  let url = $state('');
  let srcdoc = $state('');
  let auto = $state(true);
  let inspecting = $state(false);
  let width = $state(0);
  let height = $state(0);
  let zoom = $state(1);
  let fullscreen = $state(false);
  let pgPrevious = { html: '', css: '', js: '' };
  let previousMode = '';
  let channel = crypto.randomUUID();
  let ready = $state(false);
  let scroll = 0;
  let previewRoot = '';
  let staticBase = '';
  let staticSignature = '';
  let sequence = 0;
  let requested = 0;
  let standalone = $derived(
    studio.mode === 'project' &&
      /\.html?$/i.test(studio.current?.name ?? '') &&
      (!studio.current?.path || !studio.root),
  );
  const scheduler = new Scheduler();
  let needsVite = $derived(studio.mode === 'project' && !!studio.workspace?.dev && !standalone);
  let viteFrame = $derived(needsVite && !!studio.serverUrl);
  let rendering = Promise.resolve();
  const bridge = () => bridgeScript(channel);
  function post(type: string, payload: unknown) {
    frame?.contentWindow?.postMessage({ renderift: channel, type, payload }, '*');
  }
  async function render(force = false) {
    const ticket = ++requested;
    rendering = rendering
      .catch(() => {})
      .then(async () => {
        if (ticket !== requested) return;
        const mode = studio.mode;
        const pg = studio.playground;
        const current = { html: pg.html, css: pg.css, js: pg.js };
        if (mode === 'playground' || standalone) {
          if (
            mode === 'playground' &&
            !force &&
            ready &&
            previousMode === mode &&
            current.html === pgPrevious.html &&
            current.js === pgPrevious.js &&
            current.css !== pgPrevious.css
          ) {
            post('css', current.css);
            pgPrevious = current;
            return;
          }
          channel = crypto.randomUUID();
          const html = standalone
            ? buildHtmlDocument(studio.current!.text, bridge())
            : buildPlayground(current, bridge());
          ready = false;
          if (desktop) {
            const base = await native<string>('playground_preview', { html });
            url = `${base}?v=${++sequence}`;
            srcdoc = '';
          } else {
            srcdoc = html;
            url = '';
          }
          pgPrevious = current;
        } else if (studio.serverUrl) {
          if (desktop)
            await native('server_update', { root: studio.root, buffers: runtimeBuffers() });
          if (ticket !== requested) return;
          if (force || previousMode !== mode || !url.startsWith(`${studio.serverUrl}/`)) {
            url = `${studio.serverUrl}/?preview=${++sequence}`;
            srcdoc = '';
            ready = false;
            onselect(null);
          }
        } else if (needsVite) {
          // Framework entry points need Vite transforms, not the static file server.
          url = '';
          srcdoc = '';
          ready = false;
          onselect(null);
        } else if (studio.root && desktop) {
          if (previewRoot !== studio.root) {
            staticBase = await native<string>('preview_start', { root: studio.root });
            previewRoot = studio.root;
          }
          const buffers = studio.docs
            .filter((d) => d.path)
            .map((d) => ({ path: d.path!, text: d.text }));
          const signature = JSON.stringify([
            studio.root,
            studio.current?.name.endsWith('.html') ? studio.current.path : 'index.html',
            buffers.filter((d) => !d.path.endsWith('.css')),
          ]);
          if (!force && ready && previousMode === mode && staticSignature === signature) {
            await native('preview_update', { buffers, bridge: bridge() });
            post(
              'stylesheets',
              buffers
                .filter((d) => d.path.endsWith('.css'))
                .map((d) => ({
                  path: d.path.slice(studio.root.length + 1).replaceAll('\\', '/'),
                  text: d.text,
                })),
            );
            return;
          }
          staticSignature = signature;
          channel = crypto.randomUUID();
          await native('preview_update', { buffers, bridge: bridge() });
          let entry =
            studio.current?.name.endsWith('.html') && studio.current.path?.startsWith(studio.root)
              ? studio.current.path.slice(studio.root.length + 1).replaceAll('\\', '/')
              : 'index.html';
          entry = entry.split('/').map(encodeURIComponent).join('/');
          url = `${staticBase}/${entry}?v=${++sequence}`;
          srcdoc = '';
          ready = false;
        } else {
          url = '';
          srcdoc = '';
        }
        previousMode = mode;
      });
    await rendering;
  }
  function refresh() {
    attempt(() => render(true));
  }
  export function refreshPreview() {
    refresh();
  }
  $effect(() => {
    const signature = JSON.stringify([
      studio.mode,
      studio.active,
      studio.playground,
      studio.serverUrl,
      studio.workspace,
      studio.root,
      studio.mode === 'project' ? studio.docs.map((d) => [d.name, d.path, d.text, d.saved]) : null,
    ]);
    void signature;
    if (auto) scheduler.schedule(() => attempt(() => render()), studio.settings.debounce);
  });
  function device(w: number, h: number) {
    width = w;
    height = h;
    zoom = w > 900 ? 0.5 : 1;
  }
  onMount(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== frame?.contentWindow || event.data?.renderift !== channel) return;
      const { type, payload } = event.data;
      if (type === 'console' && payload && typeof payload.message === 'string') {
        const level = ['log', 'info', 'warn', 'error'].includes(payload.level)
          ? payload.level
          : 'log';
        studio.log(level, payload.message.slice(0, 16000), {
          source: typeof payload.source === 'string' ? payload.source : undefined,
          line: Number(payload.line) || undefined,
          column: Number(payload.column) || undefined,
          stack: typeof payload.stack === 'string' ? payload.stack.slice(0, 16000) : undefined,
        });
      }
      if (type === 'selection') {
        const valid = selectionMessage(payload);
        if (valid) onselect(valid);
      }
      if (type === 'ready') {
        ready = true;
        post('inspector', inspecting);
        post('scroll', scroll);
      }
      if (type === 'scroll') scroll = Number(payload) || 0;
      if (type === 'reload-needed') refresh();
    };
    window.addEventListener('message', listener);
    return () => {
      scheduler.cancel();
      window.removeEventListener('message', listener);
      requested++;
    };
  });
  function resize(event: PointerEvent) {
    const start = event.clientX;
    const original = width || (frame?.clientWidth ?? 375);
    const move = (e: PointerEvent) => {
      width = Math.max(240, Math.min(2400, Math.round(original + (e.clientX - start) / zoom)));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
  }
</script>

<section class:fullscreen class="preview-panel" aria-label="Live preview">
  <header class="panel-title">
    <div>
      <span class="live-dot"></span><strong>Live Preview</strong><span class="muted small"
        >{standalone
          ? 'HTML document'
          : studio.serverUrl
            ? 'Live project'
            : studio.mode === 'playground'
              ? 'Playground'
              : 'Static workspace'}</span
      >
    </div>
    <div class="tools">
      <button
        class:chosen={inspecting}
        title={studio.serverUrl && !standalone
          ? 'Inspector is available for static projects and playgrounds'
          : 'Inspect element'}
        aria-label="Inspect element"
        disabled={!!studio.serverUrl && !standalone}
        onclick={() => {
          inspecting = !inspecting;
          post('inspector', inspecting);
          if (!inspecting) onselect(null);
        }}><MousePointer2 size={15} /></button
      ><button aria-label="Refresh preview" title="Refresh · F5" onclick={refresh}
        ><RefreshCw size={15} /></button
      ><button
        title="Open in browser"
        aria-label="Open preview in browser"
        disabled={!desktop || !url}
        onclick={() => attempt(() => native('external', { url }))}
        ><ExternalLink size={15} /></button
      ><button
        title="Fullscreen preview"
        aria-label="Fullscreen preview"
        onclick={() => (fullscreen = !fullscreen)}><Maximize size={15} /></button
      >
    </div>
  </header>
  <div class="viewport-tools">
    <div class="segmented">
      <button
        class:chosen={width === 0}
        title="Fit to panel"
        aria-label="Fit to panel"
        onclick={() => {
          width = 0;
          height = 0;
          zoom = 1;
        }}><Monitor size={15} /></button
      ><button
        class:chosen={width === 768}
        title="Tablet · 768px"
        aria-label="Tablet viewport"
        onclick={() => device(768, 1024)}><Tablet size={15} /></button
      ><button
        class:chosen={width === 375}
        title="Mobile · 375px"
        aria-label="Mobile viewport"
        onclick={() => device(375, 667)}><Smartphone size={15} /></button
      >
    </div>
    <label class="dimension"
      ><input
        aria-label="Viewport width"
        type="number"
        min="240"
        max="2400"
        value={width || undefined}
        placeholder="Auto"
        oninput={(e) =>
          (width = Math.max(240, Math.min(2400, Number(e.currentTarget.value) || 375)))}
      /><span>×</span><input
        aria-label="Viewport height"
        type="number"
        min="200"
        max="2400"
        value={height || undefined}
        placeholder="Auto"
        oninput={(e) =>
          (height = Math.max(200, Math.min(2400, Number(e.currentTarget.value) || 667)))}
      /></label
    ><button
      title="Rotate viewport"
      aria-label="Rotate viewport"
      onclick={() => {
        [width, height] = [height || 667, width || 375];
      }}><RotateCw size={14} /></button
    ><button title="Desktop · 1440px" onclick={() => device(1440, 900)}>1440</button><span
      class="spacer"
    ></span><button
      class:chosen={auto}
      aria-label="Toggle automatic preview"
      title="Auto refresh"
      onclick={() => {
        auto = !auto;
        if (auto) refresh();
      }}
      >{#if auto}<Pause size={13} />{:else}<Play size={13} />{/if}<span class="small">Auto</span
      ></button
    >
  </div>
  <div class="preview-stage">
    <div class="device-scroll">
      <div
        class="device-space"
        style:width={width ? `${width * zoom}px` : '100%'}
        style:height={height ? `${height * zoom}px` : '100%'}
      >
        <div
          class="device"
          style:width={width ? `${width}px` : '100%'}
          style:height={height ? `${height}px` : '100%'}
          style:transform={`scale(${zoom})`}
        >
          {#if url || srcdoc}<iframe
              bind:this={frame}
              title="Isolated live preview"
              data-ready={ready}
              sandbox={viteFrame
                ? 'allow-scripts allow-forms allow-same-origin'
                : 'allow-scripts allow-forms'}
              src={url || undefined}
              srcdoc={srcdoc || undefined}
              onload={() => {
                post('inspector', inspecting);
                post('scroll', scroll);
              }}
            ></iframe>{:else if needsVite}<div class="empty runtime-empty">
              <Play size={30} />
              <h2>{studio.workspace?.framework} project</h2>
              <p>Live preview starts automatically when this project opens.</p>
              {#if !studio.workspace?.dependenciesInstalled}
                <p>Install project dependencies once:</p>
                <code>{studio.workspace?.installCommand}</code>
              {/if}
              <button
                class="primary"
                disabled={!desktop || studio.runtimeStarting}
                onclick={onstart}
              >
                {studio.runtimeStarting ? 'Preparing preview…' : 'Enable live preview'}
              </button>
              <p>
                Type to see changes without saving. API features still need the project's backend.
              </p>
            </div>{:else}<div class="empty">
              <Monitor size={32} />
              <h2>Your canvas is ready</h2>
              <p>Write HTML in a new file, open a static project, or start a Vite server.</p>
            </div>{/if}
        </div>
        {#if width}<button
            class="resize-device"
            aria-label="Resize preview viewport"
            title="Drag to resize viewport"
            onpointerdown={resize}
          ></button>{/if}
      </div>
    </div>
  </div>
  <footer class="preview-footer">
    <span class="address"
      >{(standalone ? studio.current?.name : studio.serverUrl) ||
        (studio.mode === 'playground'
          ? 'playground / index.html'
          : (studio.current?.name ?? 'index.html'))}</span
    ><button aria-label="Zoom out" onclick={() => (zoom = Math.max(0.25, zoom - 0.1))}
      ><ZoomOut size={13} /></button
    ><span class="small">{Math.round(zoom * 100)}%</span><button
      aria-label="Zoom in"
      onclick={() => (zoom = Math.min(2, zoom + 0.1))}><ZoomIn size={13} /></button
    ><button
      title="Reset viewport"
      aria-label="Reset viewport"
      onclick={() => {
        width = 0;
        height = 0;
        zoom = 1;
      }}><RotateCcw size={13} /></button
    >
  </footer>
</section>
