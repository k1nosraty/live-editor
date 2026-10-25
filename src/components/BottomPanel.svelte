<script lang="ts">
  import { Terminal, AlertCircle, Server, Trash2, Copy, X, Search } from '@lucide/svelte';
  import { studio } from '../app/state.svelte';
  import { attempt } from '../app/actions';
  let { onnavigate }: { onnavigate: (source: string, line: number) => void } = $props();
  let tab = $state('console');
  let severity = $state('all');
  let query = $state('');
  let entries = $derived(
    studio.console.filter(
      (e) =>
        (severity === 'all' || e.level === severity) &&
        e.message.toLowerCase().includes(query.toLowerCase()),
    ),
  );
</script>

<section class="bottom-panel" aria-label="Output panel">
  <header>
    <div class="panel-tabs">
      <button class:active={tab === 'console'} onclick={() => (tab = 'console')}
        ><Terminal size={14} />Console<span class="count">{studio.console.length}</span></button
      ><button class:active={tab === 'problems'} onclick={() => (tab = 'problems')}
        ><AlertCircle size={14} />Problems<span class="count">{studio.problems.length}</span
        ></button
      ><button class:active={tab === 'server'} onclick={() => (tab = 'server')}
        ><Server size={14} />Server output</button
      >
    </div>
    <span class="spacer"></span>{#if tab === 'console'}<select
        aria-label="Filter console severity"
        bind:value={severity}
        ><option value="all">All levels</option><option value="log">Log</option><option value="info"
          >Info</option
        ><option value="warn">Warnings</option><option value="error">Errors</option></select
      ><label class="console-filter"
        ><Search size={12} /><input
          aria-label="Search console"
          placeholder="Filter…"
          bind:value={query}
        /></label
      >{/if}<button
      title="Copy output"
      aria-label="Copy output"
      onclick={() =>
        attempt(() =>
          navigator.clipboard.writeText(
            tab === 'console'
              ? entries.map((e) => `[${e.level}] ${e.message}`).join('\n')
              : tab === 'server'
                ? studio.serverLog.join('\n')
                : studio.problems.join('\n'),
          ),
        )}><Copy size={13} /></button
    ><button
      title="Clear output"
      aria-label="Clear output"
      onclick={() => {
        if (tab === 'console') studio.console = [];
        else if (tab === 'server') studio.serverLog = [];
        else studio.problems = [];
      }}><Trash2 size={13} /></button
    ><button
      title="Close panel"
      aria-label="Close output panel"
      onclick={() => (studio.layout.bottom = false)}><X size={14} /></button
    >
  </header>
  <div class="panel-output">
    {#if tab === 'console'}{#if !entries.length}<div class="console-empty">
          <span class="live-dot"></span>Waiting for your next idea. Console output will appear here.
        </div>{/if}{#each entries as entry (entry.id)}<div
          class="console-entry"
          class:error={entry.level === 'error'}
          class:warning={entry.level === 'warn'}
        >
          <time>{new Date(entry.time).toLocaleTimeString('en-GB')}</time><span class="console-level"
            >{entry.level}</span
          ><span class="console-message"
            >{entry.message}{#if entry.stack}<details>
                <summary>Stack trace</summary>
                <pre>{entry.stack}</pre>
              </details>{/if}</span
          >{#if entry.source}<button
              class="small"
              onclick={() => onnavigate(entry.source!, entry.line ?? 1)}
              >{entry.source.split('/').at(-1)}:{entry.line ?? 1}</button
            >{/if}
        </div>{/each}{:else if tab === 'problems'}{#each studio.problems as problem}<div
          class="problem"
        >
          <AlertCircle size={13} />{problem}
        </div>{/each}{:else}<pre>{studio.serverLog.length
          ? studio.serverLog.join('\n')
          : 'Start a supported Vite project from the Run menu. Framework previews update after saving.'}</pre>{/if}
  </div>
</section>
