import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(join(projectRoot, 'package.json'));
const viteModule = await import(pathToFileURL(require.resolve('vite')).href);
const vite = viteModule.default ?? viteModule;
const key = (file) => vite.normalizePath(resolve(file)).replace(/^[A-Z]:/, (drive) => drive.toLowerCase());
const readBuffers = () => new Map(Object.entries(JSON.parse(readFileSync(overlayFile, 'utf8'))).map(([file, text]) => [key(file), text]));

export default async (env) => {
  // The final --config is our adapter; retain a config selected by the project's dev script.
  const args = process.argv.slice(2, -2);
  let originalConfig;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--config' || args[index] === '-c') originalConfig = args[++index];
    else if (args[index].startsWith('--config=')) originalConfig = args[index].slice(9);
  }
  const loaded = await vite.loadConfigFromFile(env, originalConfig, projectRoot);
  let buffers = readBuffers();
  const overlay = {
    name: 'live-editor-unsaved-buffers',
    enforce: 'pre',
    load(id) {
      // Vue's virtual style/template requests must use the Vue plugin's descriptor cache.
      const [file, query] = id.split('?');
      if (query && (file.endsWith('.vue') || !/^(direct|inline|import|t=\d+)$/.test(query))) return null;
      return buffers.get(key(file)) ?? null;
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html, context) => buffers.get(key(context.filename)) ?? html,
    },
    handleHotUpdate(context) {
      const text = buffers.get(key(context.file));
      if (text !== undefined) context.read = async () => text;
    },
    configureServer(server) {
      const configFiles = new Set([loaded?.path, ...(loaded?.dependencies ?? [])].filter(Boolean).map(key));
      server.watcher.add([overlayFile, ...configFiles]);
      server.watcher.on('change', (file) => {
        if (configFiles.has(key(file))) {
          void server.restart();
          return;
        }
        if (key(file) !== key(overlayFile)) return;
        const next = readBuffers();
        const changed = new Set([...buffers.keys(), ...next.keys()]);
        const previous = buffers;
        buffers = next;
        for (const path of changed) {
          if (previous.get(path) !== next.get(path)) server.watcher.emit('change', path);
        }
      });
    },
  };
  const config = vite.mergeConfig(loaded?.config ?? {}, {
    server: { host: '127.0.0.1', port: 5173, strictPort: true, hmr: { overlay: false } },
  });
  return { ...config, plugins: [overlay, ...(config.plugins ?? [])] };
};
