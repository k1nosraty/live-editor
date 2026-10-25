# Contributing

Target `develop` with small reviewable feature/fix branches. Preserve valid work. Run `npm ci` and `npm run tauri dev`; source prerequisites are documented in README. Core Rust tests can be run on Linux without WebKit using `--no-default-features`.

Use strict TypeScript, Svelte components for UI, pure modules for transformations, and Rust for filesystem/process/security work. All native paths pass through Scope. Do not introduce shell strings containing project input, privileged preview scripts, automatic runtime downloads, plaintext credentials, blind CSS string replacements or controls without working behavior.

Run `npm run verify`, `npm run test:ui`, Rust formatting, Clippy and tests. Install sample project dependencies before framework integration tests. New nontrivial behavior needs a meaningful test. Keep dependencies justified and commit npm/Cargo lockfiles. Use `npm run format` and `cargo fmt` before committing.

Update FEATURES, SECURITY and QA-REPORT when behavior/verification changes. Do not mark a feature verified merely because its source exists. Attach screenshots from the actual UI; generated mockups are not evidence.

Packaging uses the Windows CI job. Tags prepare a draft release only after all gates pass. Clean Windows install/uninstall, portable startup, WebView2 IPC boundaries, performance and manual acceptance must pass before publishing a stable release. Do not merge or publish failing builds.
