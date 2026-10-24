<script lang="ts">
  import { MousePointer2, X, ArrowUpRight } from '@lucide/svelte';
  import { tick } from 'svelte';
  import { studio } from '../app/state.svelte';
  import { attempt, openPath } from '../app/actions';
  import type { Selection } from '../shared/types';
  import { sourceRules, updateDeclaration, type SourceRule } from '../features/inspector/css';
  let {
    selection,
    onclose,
    onnavigate,
  }: { selection: Selection; onclose: () => void; onnavigate: (line: number) => void } = $props();
  let chosen = $state('');
  let property = $state('color');
  let value = $state('');
  const properties = [
    'color',
    'background-color',
    'padding',
    'margin',
    'width',
    'height',
    'font-size',
    'border-radius',
    'border',
    'display',
    'gap',
    'align-items',
    'justify-content',
  ];
  let mappings = $derived.by(() => {
    const mappings: { docId: string; rule: SourceRule; occurrence: number }[] = [];
    for (const doc of studio.docs.filter((d) => d.name.endsWith('.css'))) {
      try {
        const rules = sourceRules(doc.text, doc.name);
        const counts: Record<string, number> = {};
        for (const rule of rules) {
          const occurrence = counts[rule.selector] ?? 0;
          counts[rule.selector] = occurrence + 1;
          if (selection.rules.some((r) => r.selector === rule.selector))
            mappings.push({ docId: doc.id, rule, occurrence });
        }
      } catch {
        /* Incomplete CSS remains editable in the source editor. */
      }
    }
    return mappings;
  });
  const selectedMapping = () => mappings.find((m) => `${m.docId}:${m.rule.start}` === chosen);
  async function apply() {
    const mapping = selectedMapping();
    if (!mapping) throw new Error('Choose an exact source rule first');
    const doc = studio.docs.find((d) => d.id === mapping.docId)!;
    studio.active = doc.id;
    await tick();
    studio.update(
      doc.id,
      updateDeclaration(doc.text, mapping.rule.selector, property, value, mapping.occurrence),
    );
    studio.notice = `Updated ${property} in ${doc.name}`;
  }
  async function openSheet(sheet: string) {
    if (!studio.root || sheet === 'playground.css') return;
    let path: string;
    try {
      path = decodeURIComponent(new URL(sheet).pathname).split('/').slice(2).join('/');
    } catch {
      throw new Error('Cannot resolve source stylesheet');
    }
    await openPath(`${studio.root}/${path}`);
  }
</script>

<aside class="inspector" aria-label="CSS inspector">
  <div class="sidebar-heading">
    <strong><MousePointer2 size={13} />INSPECTOR</strong><button
      aria-label="Close inspector"
      onclick={onclose}><X size={14} /></button
    >
  </div>
  <div class="inspector-content">
    <div class="tag-name">&lt;{selection.tag}&gt; {selection.id ? '#' + selection.id : ''}</div>
    <div class="small muted">{selection.classes}</div>
    <div class="box-model" title="Computed box model">
      <button
        class="box-margin"
        onclick={() => {
          property = 'margin';
          value = selection.styles['margin-top'];
        }}
        >margin <span>{selection.styles['margin-top']}</span><span class="box-border"
          >border <span>{selection.styles['border-top-width']}</span><span class="box-padding"
            >padding <span>{selection.styles['padding-top']}</span><span class="box-content"
              >{Math.round(selection.width)} × {Math.round(selection.height)}</span
            ></span
          ></span
        ></button
      >
    </div>
    <div class="section-label">EDIT SOURCE RULE</div>
    <select aria-label="Inspector source rule" bind:value={chosen}
      ><option value="">Choose a matching rule…</option>{#each mappings as m}<option
          value={`${m.docId}:${m.rule.start}`}
          >{m.rule.file}:{m.rule.line} · {m.rule.selector}</option
        >{/each}</select
    >{#if !mappings.length}<p class="small muted">
        Open the source CSS stylesheet to edit it. Generated and inline styles are inspect-only.
      </p>{/if}<select
      aria-label="CSS property"
      bind:value={property}
      onchange={() => (value = selection.styles[property] ?? '')}
      >{#each properties as p}<option>{p}</option>{/each}</select
    >
    <div class="property-value">
      {#if property.includes('color')}<input
          type="color"
          aria-label="CSS color"
          value={/^#[a-f\d]{6}$/i.test(value) ? value : '#35785d'}
          oninput={(e) => (value = e.currentTarget.value)}
        />{/if}<input
        aria-label="CSS property value"
        bind:value
        placeholder={selection.styles[property] ?? 'value'}
      />
    </div>
    <div class="tools">
      <button class="primary" disabled={!selectedMapping() || !value} onclick={() => attempt(apply)}
        >Apply to source</button
      ><button
        title="Go to rule"
        disabled={!selectedMapping()}
        onclick={() => {
          const m = selectedMapping();
          if (m) {
            studio.active = m.docId;
            onnavigate(m.rule.line);
          }
        }}><ArrowUpRight size={15} /></button
      >
    </div>
    <details>
      <summary>Applicable rules ({selection.rules.length})</summary
      >{#each selection.rules as rule}<div class="matched-rule">
          <strong>{rule.selector}</strong>
          <pre>{rule.css}</pre>
          <button
            class="small"
            disabled={!studio.root || rule.sheet === 'playground.css'}
            onclick={() => attempt(() => openSheet(rule.sheet))}
            >{rule.sheet.split('/').at(-1)} ↗</button
          >
        </div>{/each}
    </details>
    <details>
      <summary>Computed styles</summary>{#each Object.entries(selection.styles) as [key, val]}<div
          class="computed-row"
        >
          <span>{key}</span><code>{val}</code>
        </div>{/each}
    </details>
  </div>
</aside>
