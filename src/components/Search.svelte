<script lang="ts">
  import { Search, FileSearch } from '@lucide/svelte';
  import { studio } from '../app/state.svelte';
  import { native, desktop } from '../services/native';
  import { attempt, openPath } from '../app/actions';
  import type { SearchHit } from '../shared/types';
  let { onnavigate }: { onnavigate: (line: number) => void } = $props();
  let query = $state('');
  let filename = $state(false);
  let lastQuery = $state('');
  let results = $state<SearchHit[]>([]);
  let busy = $state(false);
  let request = 0;
  async function search() {
    const id = ++request;
    if (!studio.root || !query.trim()) {
      results = [];
      return;
    }
    busy = true;
    const searched = query;
    try {
      const data = await native<SearchHit[]>('search', {
        root: studio.root,
        query: searched,
        filename,
        excludes: studio.settings.excludes,
      });
      if (id === request) {
        results = data;
        lastQuery = searched;
      }
    } finally {
      if (id === request) busy = false;
    }
  }
</script>

<div class="sidebar-heading"><strong>SEARCH WORKSPACE</strong><FileSearch size={15} /></div>
<form
  class="sidebar-form"
  onsubmit={(e) => {
    e.preventDefault();
    attempt(search);
  }}
>
  <label class="input-icon"
    ><Search size={14} /><input
      aria-label="Workspace search"
      placeholder="Find in files…"
      bind:value={query}
    /></label
  ><label class="checkbox"><input type="checkbox" bind:checked={filename} />Filenames only</label
  ><button class="primary" disabled={busy || !studio.root || !desktop}
    >{busy ? 'Searching…' : 'Search'}</button
  >
  <p class="small muted">Up to 1,000 matches · text files under 2 MiB</p>
</form>
<div class="search-results">
  {#each results as hit}<button
      onclick={() =>
        attempt(async () => {
          await openPath(hit.path);
          onnavigate(hit.line);
        })}
      ><span class="accent small">{hit.path.slice(studio.root.length + 1)}:{hit.line}</span><span
        >{@render highlight(hit.text)}</span
      ></button
    >{/each}
</div>

{#snippet highlight(text: string)}
  {@const at = text.toLowerCase().indexOf(lastQuery.toLowerCase())}
  {#if at >= 0 && lastQuery}{text.slice(0, at)}<mark>{text.slice(at, at + lastQuery.length)}</mark
    >{text.slice(at + lastQuery.length)}{:else}{text}{/if}
{/snippet}
