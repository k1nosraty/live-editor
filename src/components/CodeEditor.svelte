<script lang="ts">
  import { onMount } from 'svelte';
  import { EditorState, Compartment, Transaction } from '@codemirror/state';
  import { EditorView, keymap } from '@codemirror/view';
  import { basicSetup } from 'codemirror';
  import { indentUnit, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
  import { tags } from '@lezer/highlight';
  import { indentWithTab, undo, redo } from '@codemirror/commands';
  import { openSearchPanel } from '@codemirror/search';
  import { html } from '@codemirror/lang-html';
  import { css } from '@codemirror/lang-css';
  import { javascript } from '@codemirror/lang-javascript';
  import { json } from '@codemirror/lang-json';
  import { markdown } from '@codemirror/lang-markdown';
  import { vue } from '@codemirror/lang-vue';
  import { normalizeSettings } from '../features/settings/persistence';
  import type { Doc, Settings } from '../shared/types';
  let {
    doc,
    settings,
    onchange,
    oncursor,
    onready,
  }: {
    doc: Doc;
    settings: Settings;
    onchange: (id: string, text: string) => void;
    oncursor: (line: number, column: number) => void;
    onready?: (api: EditorApi | null) => void;
  } = $props();
  export interface EditorApi {
    action: (name: string) => void;
    insert: (text: string) => void;
    go: (line: number) => void;
  }
  let host: HTMLDivElement;
  let view: EditorView | undefined;
  const config = new Compartment();
  let active = '';
  const states = new Map<string, EditorState>();
  function support(name: string) {
    const ext = name.split('.').pop();
    switch (ext) {
      case 'html':
      case 'htm':
        return html();
      case 'css':
        return css();
      case 'js':
      case 'mjs':
        return javascript();
      case 'ts':
        return javascript({ typescript: true });
      case 'jsx':
        return javascript({ jsx: true });
      case 'tsx':
        return javascript({ jsx: true, typescript: true });
      case 'json':
        return json();
      case 'md':
        return markdown();
      case 'vue':
        return vue();
      default:
        return [];
    }
  }
  function extensions() {
    const safe = normalizeSettings(settings);
    return [
      support(doc.name),
      syntaxHighlighting(
        HighlightStyle.define([
          { tag: tags.tagName, color: safe.theme === 'light' ? '#225b47' : '#7fd5b2' },
          { tag: tags.attributeName, color: safe.theme === 'light' ? '#455f95' : '#9ebcf0' },
          { tag: tags.string, color: safe.theme === 'light' ? '#80552b' : '#dec293' },
          { tag: tags.keyword, color: safe.theme === 'light' ? '#704195' : '#c7a7e8' },
          {
            tag: tags.comment,
            color: safe.theme === 'light' ? '#69796a' : '#829389',
            fontStyle: 'italic',
          },
          { tag: tags.number, color: safe.theme === 'light' ? '#9b533b' : '#e4ab8c' },
          { tag: tags.propertyName, color: safe.theme === 'light' ? '#355880' : '#99bde0' },
        ]),
      ),
      EditorState.tabSize.of(safe.tabSize),
      indentUnit.of(safe.spaces ? ' '.repeat(safe.tabSize) : '\t'),
      safe.wrap ? EditorView.lineWrapping : [],
      EditorView.theme(
        {
          '&': {
            height: '100%',
            fontSize: `${safe.fontSize}px`,
            backgroundColor: 'transparent',
            color: 'var(--text)',
          },
          '.cm-content': {
            fontFamily: safe.font,
            caretColor: 'var(--accent)',
            padding: '16px 0',
          },
          '.cm-gutters': { background: 'transparent', color: 'var(--muted)', border: 'none' },
          '.cm-lineNumbers .cm-gutterElement': { padding: '0 16px 0 12px' },
          '.cm-activeLine': { background: 'var(--line)' },
          '.cm-activeLineGutter': { background: 'transparent', color: 'var(--text)' },
          '.cm-scroller': { overflow: 'auto' },
          '&.cm-focused': { outline: 'none' },
          '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
            background: 'var(--selection)',
          },
          '.cm-cursor': { borderLeftColor: 'var(--accent)' },
          '.cm-panels': { background: 'var(--surface)', color: 'var(--text)' },
          '.cm-tooltip': {
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          },
        },
        { dark: safe.theme !== 'light' },
      ),
    ];
  }
  onMount(() => {
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: doc.text,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          config.of(extensions()),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onchange(active, update.state.doc.toString());
            if (update.selectionSet || update.docChanged) {
              const pos = update.state.selection.main.head;
              const line = update.state.doc.lineAt(pos);
              oncursor(line.number, pos - line.from + 1);
            }
          }),
        ],
      }),
    });
    active = doc.id;
    const api: EditorApi = {
      action(name) {
        if (!view) return;
        if (name === 'undo') undo(view);
        else if (name === 'redo') redo(view);
        else if (name === 'search' || name === 'replace') openSearchPanel(view);
        else if (name === 'selectAll')
          view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
        view.focus();
      },
      insert(text) {
        if (view) view.dispatch(view.state.replaceSelection(text));
        view?.focus();
      },
      go(line) {
        if (!view) return;
        const pos = view.state.doc.line(Math.max(1, Math.min(line, view.state.doc.lines))).from;
        view.dispatch({
          selection: { anchor: pos },
          effects: EditorView.scrollIntoView(pos, { y: 'center' }),
        });
        view.focus();
      },
    };
    onready?.(api);
    return () => {
      states.clear();
      onready?.(null);
      view?.destroy();
      view = undefined;
    };
  });
  $effect(() => {
    const id = doc.id;
    const text = doc.text;
    const prefs = JSON.stringify(settings);
    void prefs;
    if (!view) return;
    if (active !== id) {
      states.set(active, view.state);
      active = id;
      let state = states.get(id);
      if (state && state.doc.toString() !== text)
        state = state.update({
          changes: { from: 0, to: state.doc.length, insert: text },
          annotations: Transaction.addToHistory.of(false),
        }).state;
      if (state) view.setState(state);
      else
        view.setState(
          EditorState.create({
            doc: text,
            extensions: [
              basicSetup,
              keymap.of([indentWithTab]),
              config.of(extensions()),
              EditorView.updateListener.of((u) => {
                if (u.docChanged) onchange(active, u.state.doc.toString());
                if (u.selectionSet || u.docChanged) {
                  const pos = u.state.selection.main.head;
                  const line = u.state.doc.lineAt(pos);
                  oncursor(line.number, pos - line.from + 1);
                }
              }),
            ],
          }),
        );
    } else if (view.state.doc.toString() !== text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    }
    view.dispatch({ effects: config.reconfigure(extensions()) });
  });
</script>

<div class="code-editor" bind:this={host} aria-label="Code editor" dir="ltr"></div>

<style>
  .code-editor {
    height: 100%;
    min-width: 0;
    overflow: hidden;
    text-align: left;
    direction: ltr;
  }
  .code-editor :global(.cm-editor) {
    height: 100%;
  }
</style>
