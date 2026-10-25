# QA report — Live Editor 1.0.0 development candidate

Verification date: 2026-10-25 (Asia/Tehran). Host: Linux x86_64, Node.js 22 runtime, Rust stable 1.99.1. Windows cross-target: x86_64-pc-windows-gnu. Local verification runs on Linux; hosted Windows packaging and a basic launch smoke passed for commit 6d93ae7. Clean-machine installation and complete Windows workflows remain unverified. This report does not certify the complete production-ready acceptance specification.

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
| Hosted GitHub CI | At 6d93ae7 frontend, core and Windows passed; Linux packages built, but native smoke failed because tauri-driver required an absolute WebKitWebDriver path. This update fixes the path; current hosted results are pending |

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

## Linux support update

A native x86_64 Linux build and both Tauri bundles were generated on Ubuntu 24.04: `.deb` approximately 4.63 MiB and AppImage approximately 79.02 MiB. The larger AppImage includes a portable dependency set; these local sizes do not establish Windows/Linux size equivalence or older glibc compatibility. Ubuntu 22.04 remains the CI release baseline.

The main-frame authenticated native gateway adds two Rust negative tests and removes frontend access to dialog/window mutation plugins. A native WebKit WebDriver test covers real rendering, console interaction, a valid native request, rejection of a forged native request, parent-DOM denial and absence of the native secret inside the preview.

The local virtual-display command was blocked before application launch: `dbus-daemon: Failed to open socket: Operation not permitted`. This is a container execution limitation; no local Linux GUI smoke result is claimed. The same command is configured on the Linux GitHub runner, where ordinary desktop/DBus sockets are available. Record hosted results separately once that run actually completes. See LINUX.md for install/build details.

QML was investigated, not implemented. QML-SUPPORT.md records an optional Qt provider design and its tooling, process, import and inspector constraints.

The initial hosted Windows run passed frontend/core verification but failed two Windows path tests: raw temporary-directory paths were compared to Windows canonical extended paths. The root containment helper and preview-server constructor now canonicalize their root before containment/overlay checks. The existing tests are retained as regressions rather than skipped; the updated hosted Windows run must pass before packaging is considered certified.

Final local Linux checks for the support update: full desktop Rust Clippy passed; 12 Rust tests (including both Vite runtimes) passed; 10 frontend unit tests and Svelte/ESLint checks passed. Eight browser workflows passed initially; the Rust-server browser test hit a concurrent Cargo build lock, then passed when rerun after native compilation. The existing nine browser workflows therefore all passed on the updated code, with that infrastructure-only timeout recorded. No local native GUI execution result is claimed. Windows target compilation is checked separately; Windows runtime regression tests await the updated hosted CI results.

A repeated local AppImage bundle attempt hit a segmentation fault in linuxdeploy's GTK plugin. The final AppImage was successfully rebuilt from a clean generated AppDir with `NO_STRIP=true`; the Linux CI uses that same setting. Both final package files exist and their checksums are included in the Linux delivery bundle. These are Ubuntu 24.04-built local candidates (the native executable references GLIBC_2.39), not verified Ubuntu 22.04 release artifacts.

## Standalone HTML preview regression

File → New previously switched to project mode without providing a preview source unless a workspace or Vite server was open. Unsaved HTML now uses the isolated document preview; standalone HTML opened without a folder uses the same path. Full-document serialization retains `lang`, `dir`, head styles and scripts. Active-tab changes now invalidate the preview even without text edits.

Local checks passed: Svelte/TypeScript (zero errors/warnings), ESLint, 10 unit tests and the production build. Three new Chromium workflows cover the reported Persian profile card in an unsaved tab with/without an existing workspace, live edits, tab switching, early script/console execution, parent/native isolation, and a restored standalone `.HTM` file. Five existing playground, persistence, inspector/Undo, isolation and extension browser workflows also passed. Direct execution of this fix in Windows WebView2 remains unverified.


## Live Editor naming, Vite preview and CI update

Product titles, menu/dialog text, native binary, launchers and packages now use Live Editor. Legacy launchers forward to Start-Live-Editor; identifiers and recovery/extension keys remain stable for data compatibility.

Opening a React/Vue/Vite entry point now shows a launch panel with a dependency check and install command. Startup waits for HTTP readiness and reports port conflicts or startup logs. The Vite iframe retains its own loopback origin for modules, cookies and storage while parent/native access remains denied. Static/playground iframe isolation is unchanged.

Before the temporary execution environment reset, this update passed 15 Chromium workflows (14 defaults plus the actual semantic-word-game/frontend), 10 frontend unit tests, Svelte/ESLint, full desktop Clippy, 13 Rust tests including the real Vite runtimes, and a Windows GNU target check. A native Linux binary and renamed Debian package were also built. The game frontend rendered inside the editor with its expected API-unavailable state: the Python backend and full gameplay were not run. The update was reconstructed from the recorded source changes after the reset; fresh verification and hosted checks validate the published tree.

CI investigation: early Windows failures were canonical-path containment regressions, fixed and subsequently passing. Older Linux jobs were cancelled by newer pushes; their always-running artifact uploader then reported missing packages. Completed run 40138518310 built both Linux package formats but tauri-driver exited before listening because --native-driver received a relative binary name. The smoke script now resolves WebKitWebDriver through PATH, passes its absolute path, fails immediately if the driver exits, and preserves failure logs/screenshots. An actual driver /status probe passed with the resolved path before the reset. CI now validates feature branches through PRs, caches Rust builds, and separates diagnostic uploads from passing packages.

Fresh verification after reconstruction passed: 14 default Chromium workflows, 10 frontend unit tests, Svelte/ESLint and production build, core Clippy with warnings denied, and all 13 Rust tests including the real React/Vue runtime test.


Hosted follow-up at 3f7f08f: frontend/core and Windows packaging/window-launch smoke passed. Linux packaging and authenticated/forged native command checks passed, but WebDriver timed out after selecting the preview frame. The follow-up waits for the preview's actual bridge-ready handshake before selecting its browsing context, saves HTTP/frame state and a top-level screenshot first, and starts DBus inside the Xvfb display environment. Eight affected browser workflows and type checking passed locally; the hosted native result is pending.


The preview server also emitted frame-ancestors *, which does not match the packaged Linux/macOS tauri://localhost ancestor under CSP source-matching rules. Its response policy now explicitly permits the application origins and the configured dev origin instead of a wildcard. The HTTP regression checks the emitted ancestor policy; the native Linux smoke remains the execution gate for this platform fix.


At 98b3e5e, Windows passed and Linux completed every native assertion: authenticated access, forged-token denial, rendered iframe heading, parent/token isolation, real button interaction and console capture. The job failed afterward only because WebKit's screenshot endpoint hung. Native evidence now captures the Xvfb display through scrot with a bounded timeout, retaining all functional/security assertions and a real screenshot after interaction. No application or boundary check is skipped.

## Automatic preview and unsaved framework editing

Opening a Vite project now starts preview after a one-time project execution approval, remembered in native application data. Reopening a trusted folder and restoring a session starts it automatically. The private Vite adapter overlays unsaved source/CSS/HTML buffers, including recovered edits and Undo, without modifying original files. Save remains explicit. Dependencies must already be installed; no package installation or backend startup is automatic.

Local verification passed: 16 default Chromium workflows plus the actual semantic-word-game frontend regression, 10 frontend unit tests, Svelte/TypeScript (zero errors/warnings), ESLint, production build, Rust formatting/core Clippy and all 15 Rust tests including real React/Vue startup/cleanup. New browser tests exercise opening via the UI without Run, CodeMirror typing without Save, Undo, temporary syntax errors, CSS updates preserving component state, unsaved HTML and reopening with dirty snapshots without another approval. The desktop gateway is mocked in these browser tests; compilation/HMR uses the actual Rust runtime manager and project Vite. Native unit tests verify persisted trust and outside-root snapshot rejection. A separate disposable-project smoke verified a dev script's custom --config and restart after saving that config.

The optional game regression uses its Vite 5/CJS API and verifies a TSX heading update from an unsaved buffer while disk remains unchanged. An initial test attempted to replace the rendered heading as one source string, but the source contains a nested span; the assertion failed until the fixture edit targeted the actual JSX. The earlier Vite 5 namespace incompatibility was fixed before the passing run. Its Python backend/full gameplay was not run.

The prior published baseline bc5873a passed hosted frontend/core, Windows NSIS/MSI/portable packaging and window launch, plus Linux deb/AppImage packaging and native WebKit UI/isolation checks in run 40191526644. Hosted platform verification for this new automatic-preview change is pending at publication. Clean-machine installation, complete manual workflows and typing latency on representative Windows hardware remain unverified. No stable release is claimed.
