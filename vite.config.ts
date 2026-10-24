import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: '127.0.0.1',
    // Tauri watches Rust sources; Vite must not watch compiler-locked build files.
    watch: { ignored: ['**/src-tauri/**'] },
  },
  test: { include: ['tests/**/*.test.ts'] },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/prettier')) return 'format';
          if (id.includes('node_modules/@codemirror') || id.includes('node_modules/@lezer'))
            return 'editor';
        },
      },
    },
  },
});
