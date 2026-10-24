<script lang="ts">
  import { studio } from '../app/state.svelte';
</script>

<div class="sidebar-heading"><strong>SETTINGS</strong></div>
<div class="settings-form">
  <div class="section-label">APPEARANCE</div>
  <label
    >Color theme<select bind:value={studio.settings.theme}
      ><option value="slate">Studio · slate</option><option value="light"
        >Daylight · warm neutral</option
      ><option value="midnight">Midnight · ink</option></select
    ></label
  ><label
    >Accent color
    <div class="accent-input">
      <input aria-label="Accent color" type="color" bind:value={studio.settings.accent} /><code
        >{studio.settings.accent}</code
      >
    </div></label
  ><label
    >Interface density<select bind:value={studio.settings.density}
      ><option value="compact">Compact</option><option value="comfortable">Comfortable</option
      ></select
    ></label
  >
  <div class="section-label">EDITOR</div>
  <label
    >Font<select bind:value={studio.settings.font}
      ><option value="Cascadia Code, Consolas, monospace">Cascadia Code / Consolas</option><option
        value="'Courier New', monospace">Courier New</option
      ><option value="monospace">System monospace</option></select
    ></label
  ><label
    >Font size<input type="number" min="10" max="32" bind:value={studio.settings.fontSize} /></label
  ><label
    >Tab width<input type="number" min="1" max="8" bind:value={studio.settings.tabSize} /></label
  ><label class="checkbox"
    ><input type="checkbox" bind:checked={studio.settings.spaces} />Indent with spaces</label
  ><label class="checkbox"
    ><input type="checkbox" bind:checked={studio.settings.wrap} />Word wrap</label
  >
  <div class="section-label">PREVIEW</div>
  <label
    >Update delay (ms)<input
      type="number"
      min="50"
      max="3000"
      step="50"
      bind:value={studio.settings.debounce}
    /></label
  ><label
    >Excluded names / globs<textarea rows="3" bind:value={studio.settings.excludes}
    ></textarea></label
  >
  <div class="section-label">KEYBOARD SHORTCUTS</div>
  <p class="small muted">
    Enter a shortcut such as Ctrl+Shift+L. Editor shortcuts remain controlled by CodeMirror.
  </p>
  {#each [{ id: 'new', title: 'New file', key: 'Ctrl+N' }, { id: 'save', title: 'Save', key: 'Ctrl+S' }, { id: 'palette', title: 'Command palette', key: 'Ctrl+Shift+P' }, { id: 'sidebar', title: 'Toggle sidebar', key: 'Ctrl+B' }] as action}<label
      >{action.title}<input
        aria-label={`${action.title} shortcut`}
        placeholder={action.key}
        value={studio.settings.shortcuts[action.id] ?? ''}
        onchange={(e) => (studio.settings.shortcuts[action.id] = e.currentTarget.value)}
      /></label
    >{/each}
</div>
