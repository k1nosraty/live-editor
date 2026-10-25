# QML support: feasibility and proposed scope

Status: investigated, **not implemented or advertised as a working preview feature**. Current `.qml` files can be opened as UTF-8 plain text, but there is no QML language service or Qt renderer in Live Editor.

## Decision

QML support is feasible on both Windows and Linux without replacing the Tauri application. Use an optional Qt runtime provider outside the privileged web UI. The first practical experience is a real Qt Quick preview window beside the editor, driven by a user-selected installed Qt kit. Do not bundle the full Qt SDK with the base editor or approximate QML rendering with HTML.

Qt supplies a `qml` runtime tool, `qmlpreview` for live preview, `qmllint`, `qmlformat` and `qmlls`. Their presence and capabilities depend on the selected Qt version/kit. A Qt 6 kit is the proposed initial target; Qt 5/qmlscene compatibility would require a distinct tested provider.

## Integration with the current source

| Current module | Required QML change |
|---|---|
| `CodeEditor.svelte` / `shared/types.ts` | QML language detection, highlighting, indentation and folding; use a real QML grammar rather than labeling JavaScript mode as QML |
| `features/editor/diagnostics.ts` | Optional `qmllint`/`qmlls` diagnostics; report missing kit/modules clearly |
| `app/actions.ts` | Route Format for QML to `qmlformat`; preserve buffer history and disk conflict protection |
| `features/preview` / `Preview.svelte` | Explicit preview provider selection; Qt preview is a native window, not the HTML iframe |
| `src-tauri/src/processes.rs` | Separate Qt process lifecycle, bounded logs, cancellation and Windows job/Unix process cleanup; reuse safe argument-array patterns |
| `src-tauri/src/lib.rs` | Authenticated, allowlisted QML operations; native Qt executable/kit selection and explicit execution consent |
| Workspace manager | Entry QML file, import paths, chosen Qt kit and module diagnostics |
| Persistence | Persist kit path/configuration and preview entry, never silently run a restored project |

## Useful first implementation

- Recognize `.qml`, syntax-aware editing, a small Qt Quick template and examples.
- Discover/select an installed Qt kit and validate `qml`, `qmllint`, `qmlformat` and optional `qmlls` versions individually.
- Explicit **Run QML**, Stop and Restart; show Qt errors and `console.log` output separately from browser console events.
- Run the chosen QML entry with its approved workspace and known import paths. Never concatenate source or filenames into shell text.
- Use a bounded shadow workspace to preview unsaved buffers while preserving relative imports/assets. File watching updates the shadow copy; it must not silently save original files.
- Start with a clearly labeled preview restart on edit; scene state may reset. Only advertise state-preserving hot reload after testing a Qt preview protocol/helper implementation.
- Add QML language-server completion/navigation as an optional local subprocess. `qmlls` may need build metadata to understand C++-defined types. Disable automatic CMake configuration/builds unless explicitly requested by the user.

## What requires more work

| Capability | Assessment |
|---|---|
| Basic syntax and formatting | Small-to-moderate integration; Qt tooling must be present for accurate diagnostics/formatting |
| Pure Qt Quick preview | Feasible with installed Qt and a separate process/window |
| Unsaved multi-file preview | Requires a reliable shadow workspace and import/asset handling |
| Qt Controls/imported modules | Requires those modules in the selected compatible Qt kit |
| Arbitrary C++/QML applications | Not handled by loading Main.qml alone; registered C++ types/native plugins require the project's own build/run configuration or a compatible exported QML plugin |
| Preview embedded in the existing Tauri pane | Substantial native integration, especially Wayland, focus/input, DPI and accessibility; external-window embedding is not a portable drop-in feature |
| Visual QML inspector | Separate feature; DOM/CSS inspector cannot edit QML anchors, bindings and Qt Quick properties. Needs Qt object/property mapping and QML-aware source transforms |
| Qt-for-WebAssembly renderer | Possible research direction, but needs a separate Qt/WASM deployment and module/build compatibility. It is not a lightweight generic renderer for arbitrary local Qt projects |

## Security and distribution

The Qt QML engine is not a sandbox for untrusted QML/JavaScript. Loading QML can load native modules and access capabilities exposed by its environment. A separate process isolates crashes/lifetime, **not** OS permissions. Run only after explicit trust/consent, similar to starting Vite scripts; a hostile project requires real OS sandboxing beyond a plain subprocess.

The main app stays Tauri/Svelte. Users who do not use QML do not install Qt. Using the user's installed Qt runtime avoids shipping that runtime in every base package. Exact additional download size cannot be claimed until a concrete Qt kit/module set has been packaged and measured.

## Acceptance before enabling a QML feature

- [ ] Matching Qt kit discovery/errors on Windows and Linux.
- [ ] Real QML scene, interaction, imported components/assets and error output.
- [ ] Unsaved-buffer preview with unchanged original disk contents.
- [ ] Clear restart/state-reset behavior; correct Stop and application-exit cleanup.
- [ ] Version/module mismatch and missing-runtime recovery.
- [ ] No automatic Qt downloads, arbitrary package execution, or native API access from a preview.
- [ ] Qt tooling fixtures and native UI tests for both platforms.

## Official references checked

- Qt QML tooling: https://doc.qt.io/qt-6/qtqml-tooling.html
- Runtime initialization and the qml tool: https://doc.qt.io/qt-6/qtqml-initializing-qml-runtime.html
- QML Language Server: https://doc.qt.io/qt-6/qtqml-tooling-qmlls.html
- QML preview: https://doc.qt.io/qt-6/qtqml-prototyping-debugging-profiling.html
- Import paths and native modules: https://doc.qt.io/qt-6/qtqml-syntax-imports.html
- QML trust model: https://doc.qt.io/qt-6/shared-security-model.html
