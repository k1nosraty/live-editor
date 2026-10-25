<script lang="ts">
  import {
    GitBranch,
    GitCommitHorizontal,
    RefreshCw,
    Plus,
    Minus,
    Undo2,
    ArrowDown,
    ArrowUp,
    Download,
    GitFork,
  } from '@lucide/svelte';
  import { studio } from '../app/state.svelte';
  import { native, desktop, ask } from '../services/native';
  import { attempt } from '../app/actions';
  import { prompt } from '../app/dialog.svelte';
  import type { GitStatus } from '../shared/types';
  let gitState = $state<GitStatus | null>(null);
  let error = $state('');
  let message = $state('');
  let busy = $state(false);
  let output = $state('');
  let display = $state('diff');
  let root = '';
  export async function refresh() {
    if (!studio.root) return;
    try {
      gitState = await native<GitStatus>('git_status', { root: studio.root });
      studio.gitBranch = gitState.branch;
      error = '';
    } catch (e) {
      gitState = null;
      error = String(e);
    }
  }
  $effect(() => {
    if (studio.root && root !== studio.root && desktop) {
      root = studio.root;
      attempt(refresh);
    }
  });
  export async function run(action: string, path?: string, value?: string) {
    if (!studio.root) throw new Error('Open a workspace first');
    if (
      action === 'discard' &&
      !(await ask(`Discard unstaged changes in ${path}? This cannot be undone.`))
    )
      return;
    if (['switch_branch', 'create_branch'].includes(action)) {
      value =
        (await prompt(
          action === 'switch_branch' ? 'Switch branch' : 'Create branch',
          'Branch name',
        )) ?? undefined;
      if (!value) return;
    }
    if (
      ['pull', 'push'].includes(action) &&
      !(await ask(
        `${action === 'pull' ? 'Pull into' : 'Push from'} the current workspace using system Git credentials?`,
      ))
    )
      return;
    busy = true;
    try {
      output = await native<string>('git', {
        root: studio.root,
        action,
        path: path ?? null,
        value: value ?? null,
      });
      display = action === 'history' ? 'history' : 'diff';
      if (action === 'commit') message = '';
      await refresh();
      studio.notice = `Git ${action.replaceAll('_', ' ')} finished`;
    } finally {
      busy = false;
    }
  }
</script>

<div class="sidebar-heading">
  <strong>SOURCE CONTROL</strong><button
    aria-label="Refresh Git"
    disabled={busy || !studio.root}
    onclick={() => attempt(refresh)}><RefreshCw size={14} /></button
  >
</div>
{#if !studio.root}<div class="sidebar-empty">
    <GitBranch size={28} />
    <p>Open a workspace<br />to work with Git.</p>
  </div>{:else if !gitState}<div class="sidebar-form">
    <p class="muted small">{error}</p>
    <button class="primary" disabled={busy} onclick={() => attempt(() => run('init'))}
      >Initialize repository</button
    >
  </div>{:else}
  <div class="sidebar-form">
    <button
      class="branch-select"
      title="Switch branch"
      disabled={busy}
      onclick={() => attempt(() => run('switch_branch'))}
      ><GitBranch size={14} />{gitState.branch || 'Unborn branch'}</button
    ><textarea
      aria-label="Commit message"
      placeholder="Describe your changes…"
      rows="3"
      bind:value={message}
    ></textarea><button
      class="primary"
      disabled={busy || !message.trim()}
      onclick={() => attempt(() => run('commit', undefined, message))}
      ><GitCommitHorizontal size={14} />Commit staged</button
    >
    <div class="tools">
      <button title="Fetch" disabled={busy} onclick={() => attempt(() => run('fetch'))}
        ><Download size={14} />Fetch</button
      ><button title="Pull" disabled={busy} onclick={() => attempt(() => run('pull'))}
        ><ArrowDown size={14} />Pull</button
      ><button title="Push" disabled={busy} onclick={() => attempt(() => run('push'))}
        ><ArrowUp size={14} />Push</button
      >
    </div>
    <div class="tools">
      <button disabled={busy} onclick={() => attempt(() => run('create_branch'))}
        ><GitFork size={14} />Branch</button
      ><button disabled={busy} onclick={() => attempt(() => run('history'))}>History</button>
    </div>
  </div>
  {#each [{ title: 'STAGED CHANGES', staged: true }, { title: 'CHANGES', staged: false }] as group}<div
      class="section-label"
    >
      {group.title}
    </div>
    {#each gitState.files.filter( (f) => (group.staged ? f.index !== ' ' && f.index !== '?' : f.worktree !== ' ' || f.index === '?') ) as file}<div
        class="git-file"
      >
        <button
          class="ellipsis"
          title={file.path}
          onclick={() => attempt(() => run(group.staged ? 'staged_diff' : 'diff', file.path))}
          >{file.path}</button
        ><span class="accent small">{group.staged ? file.index : file.worktree}</span><button
          title={group.staged ? 'Unstage' : 'Stage'}
          aria-label={`${group.staged ? 'Unstage' : 'Stage'} ${file.path}`}
          disabled={busy}
          onclick={() => attempt(() => run(group.staged ? 'unstage' : 'stage', file.path))}
          >{#if group.staged}<Minus size={13} />{:else}<Plus size={13} />{/if}</button
        >{#if !group.staged && file.index !== '?'}<button
            title="Discard unstaged"
            disabled={busy}
            onclick={() => attempt(() => run('discard', file.path))}><Undo2 size={13} /></button
          >{/if}
      </div>{/each}{/each}
  {#if output}<details class="git-output" open>
      <summary>{display === 'history' ? 'History' : 'Git output'}</summary>
      <pre>{output}</pre>
    </details>{/if}{/if}
