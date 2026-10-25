import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
export default ts.config(
  { ignores: ['dist/**', 'node_modules/**', 'src-tauri/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.{ts,svelte}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { parser: ts.parser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'svelte/no-at-html-tags': 'error',
      'svelte/require-each-key': 'off',
      'svelte/prefer-svelte-reactivity': 'off',
    },
  },
);
