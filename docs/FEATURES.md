# Features and usage

## Editor and documents

File → New/Open, Save/Save As/Save All. Each tab owns a document buffer and saved baseline. Dot indicators show unsaved text. Tabs can be dragged, closed individually/others/all, or reopened. Source splits share text. CodeMirror supplies syntax, autocomplete, folding, bracket matching, multiple cursors, search/replace/regex and history. Edit → Format runs bundled Prettier on supported source. Settings controls wrap, tabs/spaces, font/size and a small configurable shortcut set. Text remains LTR in the editor; Persian source content remains UTF-8.

A disk revision mismatch blocks Save. Reload discards current editor text only after confirmation; Save As preserves it elsewhere. Filesystem events update clean documents and flag dirty conflicts. Normal app exit preserves recovery; startup compares recovered documents with disk. Native path grants are restored separately from session JSON. Files larger than 8 MiB or non-UTF-8 bytes receive explicit errors.

## Playground

Playground sidebar: create/select/rename/duplicate/delete sessions; deletion asks first. Six templates are fully offline. HTML/CSS/JS buffers are recovered. File → Playground imports HTML/JSON, exports a self-contained HTML file, exports separate files to a selected folder, or downloads a ZIP. Generated output can be copied. Local browser development supports playground workflows but native tools clearly require the desktop app.

## Preview and inspector

File → New creates an `untitled.html` buffer that previews immediately without saving or opening a folder. A standalone `.html`/`.htm` file opened without a workspace previews the same way. Full HTML documents retain their head, inline styles/scripts, language and text direction; switching tabs updates the preview. These self-contained documents use the playground sandbox and network restrictions. Open the containing folder to preview relative local assets.

Updates default to 200 ms and are configurable. CSS-only changes inject without replacing JS state; HTML/JS refresh the execution context. Manual refresh, auto toggle, mobile/tablet/desktop/custom dimensions, rotation, zoom, fit/reset and a draggable viewport handle affect the real iframe viewport. Desktop can open the loopback preview in the system browser. The full-preview button expands the preview panel.

The pointer tool selects DOM elements and displays their tag, ID/classes, dimensions, matching rules and computed styles. Box model layers are interactive shortcuts for property selection. Choose a matching standalone CSS source rule and a property/value; Apply changes the exact PostCSS declaration and source buffer, then supports editor Undo. Use Go to rule to navigate. Open referenced CSS before source editing. Framework/generated/inline style source mapping is not claimed.

## Workspaces

Open Folder grants native scope. Explorer supports nested directories, file/folder creation, rename, file duplicate, move, permanent delete confirmation and system reveal. Settings exclusion names/globs apply to native listing/search. Search supports filenames or literal text, result snippets and line navigation, with limits that keep large trees manageable. Current active root is served by the tokenized preview server; open buffers overlay disk. Workspace source is never silently saved by opening or previewing it.

## Project runtimes

React/Vue/vanilla Vite manifests and package-manager lockfiles are detected. Install dependencies explicitly in your terminal. Run → Start asks before running the existing Vite dev script. Host is loopback, port 5173 is strict. Stop/Restart cleans up process lifetime; logs appear under Server output. Save files for framework preview and Vite HMR. Missing runtimes and failed starts produce actionable messages/logs.

## Git

Source Control shows the branch and staged/unstaged files. Choose a file for its diff, use +/- to stage/unstage, and commit with a message. Discard asks for confirmation. History, create/switch branch and fetch/pull/push are available. Switching with local changes is rejected. Git initialization is offered if no repository is detected. Remote actions use existing Git credentials and normal Git errors; Renderift does not collect passwords.

## Extensions and preferences

Install local JSON/ZIP packages, view permissions/version, enable/disable and uninstall. Enabled contributions provide commands, snippets, templates, themes and limited text panels/event integrations. Examples and API are in EXTENSIONS.md. No executable extension JavaScript runs in the app.

Studio, Daylight and Midnight themes update immediately. Accent, editor font/size, density, panel dimensions, orientation and visibility are persisted. View provides Focus, Preview Only, split editor, fullscreen and Reset Layout. Command Palette and Quick Open expose common actions.

## Console and diagnostics

Static/playground console log/info/warn/error, uncaught errors and rejected promises are captured with timestamp and available source details. Console filters, search, copy and clear work. Runtime locations/stacks are shown when the browser provides them. Problems uses language parsers plus PostCSS validation; it does not claim full TypeScript semantic type checking. Internal diagnostics and Vite output are separate from user console entries.

Parser diagnostics are skipped above 512 KiB to avoid repeatedly reparsing very large files on the UI thread. The editor still accepts UTF-8 files up to 8 MiB.
