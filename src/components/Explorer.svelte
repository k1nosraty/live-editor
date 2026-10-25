<script lang="ts">
  import {
    FolderOpen,
    FolderPlus,
    FilePlus,
    RefreshCw,
    MoreHorizontal,
    Folder,
    FileCode2,
    ChevronRight,
    ChevronDown,
    Copy,
    Trash2,
    PenLine,
    ExternalLink,
    Move,
  } from '@lucide/svelte';
  import { studio } from '../app/state.svelte';
  import { attempt, openFolder, openPath } from '../app/actions';
  import { native, ask, desktop } from '../services/native';
  import { prompt } from '../app/dialog.svelte';
  import type { FileEntry } from '../shared/types';
  let tree = $state<Record<string, FileEntry[]>>({});
  let expanded = $state<string[]>([]);
  let selected = $state('');
  let menu = $state('');
  let rootSeen = '';
  let excludesSeen = '';
  async function load(path: string) {
    tree[path] = await native<FileEntry[]>('list', { path, excludes: studio.settings.excludes });
  }
  export async function refresh() {
    if (studio.root) await load(studio.root);
    for (const path of expanded) await load(path);
  }
  $effect(() => {
    const root = studio.root;
    const patterns = studio.settings.excludes;
    if (root && (root !== rootSeen || patterns !== excludesSeen) && desktop) {
      rootSeen = root;
      excludesSeen = patterns;
      expanded = [];
      tree = {};
      attempt(() => load(root));
    }
  });
  async function toggle(entry: FileEntry) {
    selected = entry.path;
    if (entry.directory) {
      if (expanded.includes(entry.path)) expanded = expanded.filter((p) => p !== entry.path);
      else {
        await load(entry.path);
        expanded.push(entry.path);
      }
    } else await openPath(entry.path);
  }
  async function create(directory: boolean) {
    const parent = selected && tree[selected] ? selected : studio.root;
    const name = await prompt(directory ? 'New folder' : 'New file', 'Name');
    if (!name) return;
    if (/[\\/]|^\.{1,2}$/.test(name) || Array.from(name).some((c) => c.charCodeAt(0) < 32))
      throw new Error('Enter a filename without path separators');
    const path = `${parent}/${name}`;
    await native('fs', { action: directory ? 'create_folder' : 'create_file', path });
    await load(parent);
    if (!directory) await openPath(path);
  }
  async function mutate(action: string, path: string) {
    menu = '';
    const affected = (file: string | undefined) =>
      file === path || file?.startsWith(path + '/') || file?.startsWith(path + '\\');
    if (action === 'delete') {
      if (studio.docs.some((d) => affected(d.path) && d.text !== d.saved))
        throw new Error('Save or close unsaved edits before deleting this file');
      if (!(await ask(`Permanently delete ${path}?`))) return;
      await native('fs', { action, path });
      const ids = studio.docs.filter((d) => affected(d.path)).map((d) => d.id);
      for (const id of ids) studio.remove(id);
    } else if (action === 'reveal') {
      await native('reveal', { path });
      return;
    } else {
      const name = await prompt(
        action === 'rename' ? 'Rename' : action === 'move' ? 'Move file' : 'Duplicate file',
        action === 'move' ? 'Destination path inside approved workspace' : 'New filename',
        action === 'move' ? path : path.split(/[\\/]/).at(-1),
      );
      if (!name || name === path.split(/[\\/]/).at(-1)) return;
      const target = action === 'move' ? name : path.replace(/[^\\/]+$/, name);
      if (studio.docs.some((d) => affected(d.path) && d.text !== d.saved))
        throw new Error('Save or close unsaved edits before moving or renaming');
      await native('fs', { action, path, target });
      if (action !== 'duplicate')
        for (const d of studio.docs)
          if (affected(d.path)) {
            d.path = target + (d.path?.slice(path.length) ?? '');
            d.name = d.path.split(/[\\/]/).at(-1) ?? d.name;
          }
    }
    await refresh();
  }
  const excluded = (name: string) =>
    studio.settings.excludes.split(',').some((p) => p.trim() === name);
</script>

<div class="sidebar-heading">
  <strong>EXPLORER</strong>
  <div class="tools">
    <button
      aria-label="New file in workspace"
      title="New file"
      disabled={!studio.root}
      onclick={() => attempt(() => create(false))}><FilePlus size={14} /></button
    ><button
      aria-label="New folder"
      title="New folder"
      disabled={!studio.root}
      onclick={() => attempt(() => create(true))}><FolderPlus size={14} /></button
    ><button
      aria-label="Refresh explorer"
      title="Refresh explorer"
      disabled={!studio.root}
      onclick={() => attempt(refresh)}><RefreshCw size={14} /></button
    >
  </div>
</div>
{#if studio.root}<button class="workspace-label" onclick={() => (selected = studio.root)}
    ><ChevronDown size={13} />{studio.root.split(/[\\/]/).at(-1)?.toUpperCase()}</button
  >{@render branch(studio.root, 0)}{:else}<div class="sidebar-empty">
    <FolderOpen size={28} />
    <p>Bring your project<br />into the picture.</p>
    <button class="primary" disabled={!desktop} onclick={() => attempt(() => openFolder())}
      >Open Folder</button
    >{#if !desktop}<p class="small muted">Filesystem tools require the desktop app.</p>{/if}
  </div>{/if}
{#snippet branch(path: string, depth: number)}
  {#each tree[path] ?? [] as entry (entry.path)}{#if !excluded(entry.name)}<div
        class="tree-item"
        class:selected={selected === entry.path}
        style:padding-left={`${12 + depth * 14}px`}
      >
        <button class="tree-name" title={entry.path} onclick={() => attempt(() => toggle(entry))}
          >{#if entry.directory}{#if expanded.includes(entry.path)}<ChevronDown
                size={12}
              />{:else}<ChevronRight size={12} />{/if}<Folder
              size={14}
              color="#aab6c8"
            />{:else}<span class="tree-indent"></span><FileCode2
              size={14}
              color={entry.name.endsWith('.css') ? '#83afff' : '#e8b088'}
            />{/if}<span>{entry.name}</span
          >{#if studio.docs.some((d) => d.path === entry.path && d.text !== d.saved)}<span
              class="dirty-dot"
            ></span>{/if}</button
        ><button
          class="file-more"
          aria-label={`Actions for ${entry.name}`}
          onclick={() => (menu = menu === entry.path ? '' : entry.path)}
          ><MoreHorizontal size={13} /></button
        >{#if menu === entry.path}<div class="context-menu">
            <button onclick={() => attempt(() => mutate('rename', entry.path))}
              ><PenLine size={13} />Rename</button
            ><button
              disabled={entry.directory}
              onclick={() => attempt(() => mutate('duplicate', entry.path))}
              ><Copy size={13} />Duplicate</button
            ><button onclick={() => attempt(() => mutate('move', entry.path))}
              ><Move size={13} />Move</button
            ><button onclick={() => attempt(() => mutate('reveal', entry.path))}
              ><ExternalLink size={13} />Reveal in Explorer</button
            ><button class="danger" onclick={() => attempt(() => mutate('delete', entry.path))}
              ><Trash2 size={13} />Delete</button
            >
          </div>{/if}
      </div>
      {#if entry.directory && expanded.includes(entry.path)}{@render branch(
          entry.path,
          depth + 1,
        )}{/if}{/if}{/each}
{/snippet}
