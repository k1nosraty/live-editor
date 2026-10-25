import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const hash = createHash('sha256').update(readFileSync('package-lock.json')).digest('hex');
const stamp = 'node_modules/.renderift-lock';
const manager = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (args) => {
  const result = spawnSync(manager, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};
if (!existsSync(stamp) || readFileSync(stamp, 'utf8') !== hash) {
  run(['ci']);
  writeFileSync(stamp, hash);
}
run(['run', 'tauri', 'dev']);
