# Implementation ledger

The supplied specification is retained in SPECIFICATION.md. Repository: live-editor; product: Live Editor. The remote feature branch was created from develop. Source commits and verification are local; publishing the implementation was blocked by automatic approval review pending explicit user authorization. No PR or release is claimed.

| Milestone | Implementation | Actual verification |
|---|---|---|
| A: Foundation | Tauri/Rust/Svelte/CodeMirror, shell, design tokens | Typecheck/lint, web build and Windows target check passed |
| B: Editor/playground | Buffers, sessions, templates, recovery, export | Unit tests and browser workflows passed |
| C: Preview | Sandboxed preview, relative assets, CSS injection, console, dimensions | Rust server tests and browser workflows passed; WebView2 IPC still requires Windows |
| D: Workspace | Scoped dialogs, file tools, watch/search/conflicts, durable grants | Rust file/watch/security tests passed; native dialogs require desktop manual QA |
| E: Inspector | Selection, computed/matched CSS, exact standalone rule edits and Undo | PostCSS tests and browser Apply/Undo passed |
| F: Frameworks | Detection, confirmed Vite lifecycle, saved-file preview | Real React/Vue Rust runtime tests and browser HMR passed |
| G: Git/extensions | Allowlisted Git and declarative extension API/manager/examples | Local Git core tests, package tests and extension browser workflow passed; remotes need credentials/Windows manual QA |
| H: QA/release | Docs, negative tests, screenshot and CI/packaging workflows | Local checks tracked in QA-REPORT; no passing hosted CI/release claimed |

## Acceptance still requiring certification

- [ ] Execute the packaged app and native dialogs on Windows WebView2.
- [ ] Run the packaged Windows IPC negative tests.
- [ ] Install/uninstall NSIS and execute the portable build on a clean supported Windows machine.
- [ ] Measure representative Windows cold start and aggregate memory.
- [ ] Publish source, open PR and run the configured hosted CI after explicit authorization.
- [ ] Create/publish a stable release only after release gates pass.

Known functional boundaries (rather than hidden unfinished buttons) are recorded in README and FEATURES: standalone-CSS source edits, literal workspace search, saved-file framework preview, declarative extensions, relative static asset paths and file-only duplicate. No blanket claim that every acceptance criterion in the broad specification is certified.

Linux addition: native `.deb`/AppImage platform configuration, Ubuntu 22.04 packaging/release gate, Linux starter script, WebKit WebDriver integration and per-launch authenticated native gateway. Local Linux packages were built; local GUI execution hit a DBus socket restriction. QML remains a documented feasibility investigation only. This update targets the existing feature branch and PR #1.
