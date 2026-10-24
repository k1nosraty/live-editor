<script lang="ts">
  import { Puzzle, Plus, Trash2, Power, FileCode2, Palette } from '@lucide/svelte';
  import { unpack, type Extension } from '../features/extensions/manager';
  import { attempt } from '../app/actions';
  import { ask } from '../services/native';
  let {
    extensions,
    onchange,
    oncommand,
  }: {
    extensions: Extension[];
    onchange: (items: Extension[]) => void;
    oncommand: (extension: Extension, command: string) => void;
  } = $props();
  let input: HTMLInputElement;
  async function install(file?: File) {
    if (!file) return;
    const extension = unpack(new Uint8Array(await file.arrayBuffer()), file.name);
    if (
      extensions.some((e) => e.id === extension.id) &&
      !(await ask(`Replace installed extension ${extension.name}?`))
    )
      return;
    if (
      extension.permissions.length &&
      !(await ask(
        `${extension.name} requests ${extension.permissions.join(', ')}. Allow this extension to read document events?`,
      ))
    )
      return;
    onchange([...extensions.filter((e) => e.id !== extension.id), extension]);
  }
</script>

<div class="sidebar-heading">
  <strong>EXTENSIONS</strong><button
    title="Install local extension"
    aria-label="Install extension"
    onclick={() => input.click()}><Plus size={16} /></button
  >
</div>
<input
  hidden
  bind:this={input}
  type="file"
  accept=".json,.zip"
  onchange={(e) => {
    attempt(() => install(e.currentTarget.files?.[0]));
    e.currentTarget.value = '';
  }}
/>
<div class="sidebar-form">
  <p class="small muted">
    Local, declarative extensions.<br />No shell, network, or native access.
  </p>
  <button class="outlined" onclick={() => input.click()}
    ><Puzzle size={14} />Install from package</button
  >
</div>
{#each extensions as extension (extension.id)}<article class="extension">
    <div class="extension-title">
      {#if extension.themes}<Palette size={20} />{:else}<FileCode2 size={20} />{/if}
      <div>
        <strong>{extension.name}</strong><span class="small muted"
          >{extension.id} · {extension.version}</span
        >
      </div>
    </div>
    <p class="small muted">Permissions: {extension.permissions.join(', ') || 'none'}</p>
    <div class="tools">
      <button
        class:chosen={extension.enabled}
        aria-label={`Toggle ${extension.name}`}
        onclick={() =>
          onchange(
            extensions.map((e) => (e.id === extension.id ? { ...e, enabled: !e.enabled } : e)),
          )}><Power size={13} />{extension.enabled ? 'Enabled' : 'Disabled'}</button
      ><button
        title="Uninstall extension"
        aria-label={`Uninstall ${extension.name}`}
        onclick={() =>
          attempt(async () => {
            if (await ask(`Uninstall ${extension.name}?`))
              onchange(extensions.filter((e) => e.id !== extension.id));
          })}><Trash2 size={13} /></button
      >
    </div>
    {#if extension.enabled}{#each extension.commands ?? [] as command}<button
          class="extension-command"
          onclick={() => oncommand(extension, command.id)}>{command.title} ↗</button
        >{/each}{/if}
  </article>{/each}
