# Verification

Use the exact commands in README. `npm run verify` runs Svelte/TypeScript validation, ESLint, Vitest and a production web build. `npm run test:ui` drives Chromium in an isolated browser context per test. Install Playwright Chromium and sample dependencies first.

## Automated coverage

- Vitest: unsaved state, filename languages, path rejection, settings recovery, update debounce/cancellation, preview CSP/script escaping, exact CSS transforms and repeated selectors, extension compatibility/permissions/archive rejection.
- Rust: traversal, outside scope/symlink escape, UTF-8 save/reload, external conflict preservation, real Git init/stage/commit and dirty-branch rejection, tokenized preview overlays and denial, native file lifecycle/durable grants, actual external filesystem events.
- Explicit ignored-by-default runtime test: starts and stops real React/Vite and Vue/Vite examples through the Rust manager. Invoke `modern_vite_workflows -- --ignored` after installing both example dependencies. This is separate from the default core test count.
- Playwright: JS interactions/console, CSS updates preserving state, Persian buffer recovery, theme/palette, Inspector apply/Undo, iframe parent denial/no Tauri global, extension install/activate/disable/uninstall, ZIP export and actual screenshot. Framework browser tests verify real rendering, interaction and Vite HMR for both React and Vue. Automatic-preview tests use the real Rust runtime through a mocked desktop gateway, type through CodeMirror without Run/Save, Undo, recover from invalid syntax and reopen a trusted project. React also checks live CSS preserving component state and unsaved HTML. Core tests cover persisted project approval and workspace snapshot boundaries.
- Project preview tests start the real Rust runtime manager, open its HTTP-ready Vite URL in the editor iframe, verify storage and parent/native isolation, and exercise React/Vue interaction and unsaved-source HMR without changing disk files. Set `LIVE_EDITOR_VALIDATION_PROJECT` to the semantic-word-game frontend folder to include that optional regression. No backend or automatic dependency installation is included.

The screenshot in README is captured from the browser-rendered application UI during tests. It is not evidence that a Windows installer was executed.

## Native desktop acceptance before stable publication

On a clean Windows 10/11 x64 machine with WebView2:

- [ ] Install/uninstall the NSIS package; optionally MSI. Check shortcuts, launch and user data retention.
- [ ] Extract portable ZIP and run without Rust, Node or an IDE; verify documented WebView2 dependency.
- [ ] Use real native dialogs; open/save/Save As, edit Persian, and verify disk contents.
- [ ] Open nested static project, images/fonts/imported CSS/modules and unsaved buffers.
- [ ] Modify an open file externally, verify clean reload and dirty conflict choices.
- [ ] Exercise tab close/reopen/reorder, both splits, layout persistence, fullscreen and shortcuts.
- [ ] Inspector matched rule choice, source navigation, CSS Apply and Undo/Redo.
- [ ] Open React and Vue projects, approve once, type without Save for HMR, pause/restart and verify no orphan process after exit/crash.
- [ ] Git operations against a disposable local repository and a test remote using normal credentials.
- [ ] Both example extensions, permissions, restart persistence, disable and uninstall.
- [ ] Hostile preview attempts to invoke Rust IPC, access parent DOM, navigate privileged origin, open popups, read outside the tokenized root, or send forged native-action messages.
- [ ] Abnormal-exit recovery; corrupted storage; missing runtime, permission-denied and missing-asset errors.
- [ ] Measure cold startup, installer/portable bytes, parent+WebView2 aggregate private memory and typing responsiveness on representative hardware.

CI Windows smoke detects a visible main window and reports **parent** process working set separately. This is not a full renderer-memory benchmark or clean-machine acceptance. CI must actually run before its results can be reported.

To reproduce the local experimental candidate on Linux, provide the GNU Windows Rust target and MinGW linker/resource compiler, build the web assets, then compile with `--features custom-protocol --target x86_64-pc-windows-gnu`. The Tauri-generated NSIS script is under the target's `release/nsis/x64`; the local system makensis can compile it with the matching Tauri NSIS plugin available. This is a fallback; the supported release route is Windows MSVC CI. `scripts/package.mjs` packages an existing executable/loader with notices and checksums; set `LIVE_EDITOR_TARGET_DIR`, `LIVE_EDITOR_TARGET` and optional `LIVE_EDITOR_INSTALLER` to the actual built paths. It does not claim to execute or certify the binary.
