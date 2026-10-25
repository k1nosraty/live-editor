# Live Editor 1.0.0 — development candidate

Desktop coding studio with CodeMirror editing, isolated live HTML/CSS/JS preview, responsive viewports, console capture, source-aware standalone CSS edits, project file tools, Git commands, a Vite runtime manager, local declarative extensions, themes and recovery.

This is not a declaration that the complete specification is certified. Consult QA-REPORT.md and IMPLEMENTATION.md for verified checks and release blockers. Windows packages must pass CI and desktop smoke tests; clean-machine installer, security-boundary testing on WebView2 and manual acceptance remain separate gates. Releases are prepared as drafts until those gates pass.

Linux x86_64 distribution now has separate `.deb` and AppImage configuration, CI packaging, native WebKit verification and platform documentation. Native command authentication also protects the iframe boundary on Linux. QML support has been assessed as an optional Qt provider; it is not enabled in this candidate.
