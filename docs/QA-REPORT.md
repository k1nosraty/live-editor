# QA report — Renderift 1.0.0 development candidate

Verification date: 2026-10-25 (Asia/Tehran). Host: Linux x86_64, Node.js 22 runtime, Rust stable 1.99.1. Windows cross-target: x86_64-pc-windows-gnu. The application has **not** been executed on Windows in this session. This report does not certify the complete production-ready acceptance specification.

## Executed checks

| Check | Actual result |
|---|---|
| Svelte/TypeScript validation | Passed: zero errors and zero warnings |
| ESLint | Passed |
| Vitest | 10 tests passed |
| Playwright Chromium | 9 workflows passed (including real React/Vue HMR, Rust static CSS/module server, inspector Apply/Undo, recovery, sandbox and extensions) |
| Rust core/integration including explicit runtime test | 10 tests passed, including real Vite start/stop for both frameworks |
| Rust formatting and core Clippy with warnings denied | Passed |
| Production web build | Passed; the formatter remains a separately loaded large chunk and produces a bundle-size advisory |
| Windows target native check | Passed |
| Windows GUI executable cross-build | Produced a real PE32+ x64 GUI executable |
| NSIS packaging | Local Linux makensis generated an installer from Tauri's generated script; see distribution files for actual byte counts |
| Windows execution/installer/portable smoke | Not run: no Windows execution environment available |
| MSI packaging | Not run: requires Windows/WiX |
| Hosted GitHub CI | Not run: implementation push was rejected by automatic approval review |

## Evidence

Actual screenshot: `docs/screenshots/studio.png`. Browser tests use fresh browser contexts. Rust tests create disposable directories and repositories. The static-server browser integration loads imported CSS and ES modules through the actual Rust loopback server inside a sandboxed opaque-origin iframe, and verifies CSSOM access after a CORS stylesheet reload.

The inspector Undo test initially failed because edits reached a never-activated source document before its editor history existed. The implementation now activates the source editor before applying the transformation; the regression test passes. Additional tests cover malformed untrusted inspector messages, archive traversal and source-range changes.

## Size and performance

`release/SHA256SUMS.txt` and `release/BUILD-MEASUREMENTS.json` report exact distribution bytes for the delivered local files. The first cross-build executable was approximately 24 MiB and its NSIS output approximately 5 MiB. These are measured local cross-build sizes, not a Windows performance benchmark. The final exact byte counts are generated after final packaging.

Cold startup, aggregate private memory (including WebView2), typing latency and clean-machine installer duration were **not measured** on representative Windows hardware. No claim is made for the under-two-second startup target. The configured Windows CI smoke records window-visible time and parent-process memory separately if actually run.

## Security evidence and limits

Passed negative tests: outside-root paths, relative traversal, Unix symlink escape, missing preview token, encoded traversal, unknown native operation, extension executable/native-permission packages, malformed inspector data, iframe parent access and absent Tauri globals in browser preview. Git uses safe arguments and revision-checked save tests preserve externally modified bytes.

Chromium iframe tests are not equivalent to packaged WebView2 IPC penetration tests. Direct native IPC attempts, hostile iframe navigation, OS filesystem races, renderer hangs, process cleanup after an uncatchable kill and clean Windows execution must be tested before stable release. See SECURITY.md.

## Remaining acceptance and delivery gates

1. Execute native dialogs, workspace tools, Git remote authentication and layout/shortcut workflows in the packaged Windows application.
2. Install/uninstall the NSIS package and exercise the portable ZIP on a clean Windows 10/11 x64 machine with WebView2.
3. Verify packaged WebView2 IPC isolation with hostile preview content and measure representative startup/memory.
4. Run Windows MSVC CI and optionally build MSI. The delivered local GNU cross-build is an experimental candidate, not the certified Windows distribution.
5. Publish the source branch, create a PR and run hosted checks after explicit user authorization. No PR or release URL has been fabricated.

Functional scope boundaries remain explicit in README: standalone CSS source edits, parser-level diagnostics, relative static assets under one root, saved-file Vite preview, declarative extensions and file-only duplicate. No nonexistent feature is documented as verified.

Local NSIS reported two packaging advisories: `/a` file-attribute preservation is disabled on a non-Windows host, and the generated Tauri template referenced an unset English `choowHowToInstall` language string. The installer was generated successfully, but its screens have not been inspected on Windows; verify that label before stable release.
