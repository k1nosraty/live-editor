import type { Doc } from '../../shared/types';
import { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { vue } from '@codemirror/lang-vue';
import postcss from 'postcss';
export function diagnostics(doc: Doc): string[] {
  if (doc.text.length > 512 * 1024) return [];
  const ext = doc.name.split('.').pop();
  const language =
    ext === 'html'
      ? html()
      : ext === 'css'
        ? css()
        : ['js', 'jsx', 'ts', 'tsx'].includes(ext ?? '')
          ? javascript({
              jsx: ext === 'jsx' || ext === 'tsx',
              typescript: ext === 'ts' || ext === 'tsx',
            })
          : ext === 'json'
            ? json()
            : ext === 'vue'
              ? vue()
              : null;
  if (!language) return [];
  const errors: string[] = [];
  if (ext === 'css') {
    try {
      postcss.parse(doc.text, { from: doc.name });
    } catch (error) {
      errors.push(String(error));
    }
  }
  const state = EditorState.create({ doc: doc.text, extensions: [language] });
  syntaxTree(state).iterate({
    enter(node) {
      if (node.type.isError && errors.length < 12) {
        const line = state.doc.lineAt(node.from);
        errors.push(
          `${doc.name}:${line.number}:${node.from - line.from + 1} — Unexpected or incomplete ${ext?.toUpperCase()} syntax`,
        );
      }
    },
  });
  return errors;
}
