import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  copyFileSync,
  readdirSync,
} from 'node:fs';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { zipSync } from 'fflate';
const binaryRoot = resolve(process.env.LIVE_EDITOR_TARGET_DIR ?? 'src-tauri/target/release');
const output = resolve('release');
mkdirSync(output, { recursive: true });
const files = {
  'live-editor.exe': new Uint8Array(readFileSync(resolve(binaryRoot, 'live-editor.exe'))),
};
if (existsSync(resolve(binaryRoot, 'WebView2Loader.dll')))
  files['WebView2Loader.dll'] = new Uint8Array(
    readFileSync(resolve(binaryRoot, 'WebView2Loader.dll')),
  );
for (const filename of [
  'LICENSE',
  'docs/PORTABLE.md',
  'docs/THIRD-PARTY-NOTICES.md',
  'docs/QA-REPORT.md',
])
  files[basename(filename)] = new Uint8Array(readFileSync(filename));
writeFileSync(
  resolve(output, 'Live-Editor_1.0.0_x64_portable-candidate.zip'),
  zipSync(files, { level: 9 }),
);
const installer = process.env.LIVE_EDITOR_INSTALLER;
if (installer)
  copyFileSync(installer, resolve(output, 'Live-Editor_1.0.0_x64_setup-candidate.exe'));
const artifacts = readdirSync(output).filter(
  (f) => /\.(exe|zip)$/.test(f) && !f.includes('bundle'),
);
const measurements = {
  version: '1.0.0',
  status: 'experimental-windows-candidate',
  target: process.env.LIVE_EDITOR_TARGET ?? 'windows-msvc',
  windowsExecutionVerified: false,
  startupMilliseconds: null,
  aggregateMemoryBytes: null,
  files: Object.fromEntries(
    artifacts.map((name) => [name, readFileSync(resolve(output, name)).byteLength]),
  ),
  executableBytes: files['live-editor.exe'].byteLength,
  loaderIncluded: !!files['WebView2Loader.dll'],
  webAssetsBytes: readdirSync('dist/assets').reduce(
    (total, name) => total + readFileSync(resolve('dist/assets', name)).byteLength,
    0,
  ),
};
writeFileSync(
  resolve(output, 'BUILD-MEASUREMENTS.json'),
  JSON.stringify(measurements, null, 2) + '\n',
);
const checksummed = [...artifacts, 'BUILD-MEASUREMENTS.json'];
writeFileSync(
  resolve(output, 'SHA256SUMS.txt'),
  checksummed
    .map(
      (name) =>
        createHash('sha256')
          .update(readFileSync(resolve(output, name)))
          .digest('hex') +
        '  ' +
        name,
    )
    .join('\n') + '\n',
);
console.log(JSON.stringify(measurements, null, 2));
