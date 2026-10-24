# Live Editor — Complete Production-Ready Desktop IDE

## MASTER IMPLEMENTATION PROMPT

### 1. Your Role

Act as a senior software architect, Rust engineer, frontend engineer, desktop application developer, UI/UX designer, security engineer, and QA lead.

Your mission is to **design, implement, test, package, and deliver Renderift v1.0.0**, a lightweight, professional desktop coding IDE with real-time visual preview.

This is a complete software development assignment, not a prototype or proof of concept.

You are responsible for delivering a functioning application, not merely generating source files.

**Repository:** The connected GitHub repository named `renderift`.

**Product name:** Renderift

**Tagline:** Write. See. Ship.

**Primary platform:** Windows 10 and Windows 11, x64.

**License:** MIT.

### 2. Non-Negotiable Requirements

1. Implement ALL features described in this specification in version 1.0.
2. Do not defer features to future versions.
3. Do not implement fake buttons, placeholder components, simulated functionality, or nonfunctional UI.
4. Every visible action must be connected to working application logic.
5. Deliver actual source code, tests, documentation, and installable release artifacts.
6. Follow SOLID, DRY, KISS, separation of concerns, and secure software development practices.
7. Keep application startup fast and resource consumption low.
8. Avoid unnecessary frameworks, excessive dependencies, and overengineering.
9. Do not sacrifice usability or security to reduce application size.
10. Do not silently discard requirements due to complexity.
11. If an implementation fails, investigate, fix, and rerun its relevant tests.
12. Do not claim that a test, build, feature, or release succeeded without verification.
13. Work autonomously through implementation, testing, and packaging without requesting approval for routine technical decisions.
14. If an environment limitation prevents completion, report the exact limitation, preserve the working implementation, and identify the unfinished acceptance criteria.

The final result must look and behave like genuine desktop software, not a basic HTML demonstration.

---

# PART I — Technology and Architecture

## 3. Technology Stack

Use the following architecture:

### Desktop Layer

- Tauri 2
- Rust stable toolchain
- Microsoft Edge WebView2 on Windows
- Native Windows file dialogs and desktop integration

### Frontend Layer

- TypeScript with strict mode
- Svelte with Vite, using compatible stable versions
- CodeMirror 6
- Lightweight modular CSS with design tokens
- Lucide SVG icons, tree-shaken or bundled locally
- Avoid large UI component libraries unless justified

### Supporting Libraries

Use maintained, compatible tools as needed:

- Prettier for source formatting
- ESLint for TypeScript validation
- Vitest for frontend unit tests
- Playwright for UI testing where practical
- Rust unit/integration tests
- git2/libgit2 or another well-supported Git implementation
- Safe filesystem watching
- A minimal localhost preview server where required
- Native operating-system credential storage for sensitive Git credentials

Do not introduce Electron or package a complete Chromium browser.

Select compatible dependencies, commit lockfiles, and explain significant architectural decisions.

## 4. Architecture Principles

Separate the application into independently testable modules:

- Application Shell
- Editor Engine
- Document Manager
- Playground Manager
- Workspace Manager
- File Explorer
- Preview Engine
- Preview Server
- Inspector Engine
- Console Manager
- Project Runtime Manager
- Git Integration
- Extension Host
- Theme Manager
- Settings Manager
- Persistence Layer
- Security Layer

Use clearly defined interfaces and explicit ownership of state.

Avoid circular dependencies, giant components, duplicated business logic, and unnecessary abstraction layers.

Separate frontend presentation logic from filesystem access, subprocess management, and security-sensitive operations.

## 5. Suggested Directory Structure

```text
renderift/
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── editor/
│   │   ├── playground/
│   │   ├── workspace/
│   │   ├── explorer/
│   │   ├── preview/
│   │   ├── inspector/
│   │   ├── console/
│   │   ├── git/
│   │   ├── extensions/
│   │   ├── settings/
│   │   └── themes/
│   ├── services/
│   ├── shared/
│   ├── stores/
│   └── styles/
├── src-tauri/
│   ├── src/
│   │   ├── commands/
│   │   ├── documents/
│   │   ├── filesystem/
│   │   ├── workspace/
│   │   ├── preview/
│   │   ├── processes/
│   │   ├── git/
│   │   ├── extensions/
│   │   ├── security/
│   │   └── settings/
│   ├── capabilities/
│   └── tauri.conf.json
├── extensions/
│   └── examples/
├── examples/
│   ├── html-css-js/
│   ├── react-vite/
│   └── vue-vite/
├── tests/
├── docs/
├── scripts/
├── .github/workflows/
├── README.md
├── CONTRIBUTING.md
├── LICENSE
└── package.json
```

The structure may be improved if the implementation provides a compelling reason.

---

# PART II — Product and User Experience

## 6. Product Vision

Renderift combines two workflows inside one application.

### Playground Mode

A zero-configuration coding environment.

Users open Renderift and immediately start writing HTML, CSS, and JavaScript.

No project initialization, terminal, dependency installation, or manual server setup is required for basic web development.

Changes appear immediately in the preview.

### Project Mode

A lightweight workspace for opening and editing actual local projects.

Users can open folders, browse files, edit source code, preview websites, manage Git changes, and run supported development servers.

Both modes must share the same underlying editor, document management, preview, and settings infrastructure.

Switching modes must not result in data loss.

## 7. Main Interface

Create a professional desktop IDE layout.

### Title Bar

Include:

- Application branding
- Current project name
- Native window controls
- Minimal, carefully organized actions

### Menu Bar

Implement native-looking desktop menus:

- File
- Edit
- View
- Run
- Git
- Extensions
- Help

Use functional nested submenus where appropriate.

### Activity Bar

Provide compact navigation for:

- Explorer
- Search
- Git
- Extensions
- Settings

### Editor Area

Support:

- Multiple tabs
- Active tab highlighting
- File-type icons
- Unsaved indicators
- Tab rearrangement
- Close individual tabs
- Close other tabs
- Close all tabs
- Reopen closed tab
- Split editor views where appropriate

### Preview Area

Include:

- Live Preview
- Responsive presets
- Refresh
- Open in external browser when safely supported
- Inspector toggle
- Zoom controls
- Auto-refresh toggle
- Preview address/status

### Bottom Panel

Implement:

- Console
- Problems
- Development server output

The bottom panel must be collapsible and resizable.

### Status Bar

Display useful information such as:

- Cursor position
- Current language
- File encoding
- Indentation settings
- Git branch
- Live Preview status
- Development server status

Do not fill the interface with unnecessary text or decorative widgets.

---

# PART III — Editor Features

## 8. Code Editing

Use CodeMirror 6 as the editing foundation.

Implement:

- Syntax highlighting
- Line numbers
- Active line highlighting
- Auto indentation
- Bracket matching
- Automatic closing brackets
- Autocomplete
- Code folding
- Search and replace
- Regular-expression search
- Multiple selections and cursors
- Undo and redo
- Word wrapping
- Minimap only if it can be implemented efficiently
- Configurable tab width
- Spaces versus tabs
- Font family and font size configuration
- Basic configurable keyboard shortcuts
- Current line and column display
- Code formatting
- File language detection

Provide syntax-aware editing for:

- HTML
- CSS
- JavaScript
- TypeScript
- JSX
- TSX
- JSON
- Markdown
- Vue single-file components

Additional file types may use plain-text editing with appropriate highlighting.

The application must support UTF-8 and Persian text correctly.

Code editing should remain left-to-right by default, even when source files contain Persian or other RTL text.

## 9. Document Lifecycle

Implement:

- New file
- Open file
- Save
- Save As
- Save All
- Rename
- Delete
- Reopen recently closed documents
- Unsaved change detection
- Recovery after abnormal termination
- External file modification detection
- Conflict resolution when files change on disk

Never silently overwrite newer content from another application.

Persist editing state and recovery data separately from the original source files.

---

# PART IV — Playground Mode

## 10. Instant Playground

The user should be able to launch Renderift and begin coding immediately.

Provide three primary editing tabs:

- HTML
- CSS
- JavaScript

Automatically combine their contents into the live preview.

Implement:

- Automatic playground state recovery
- Multiple playground sessions
- Create new playground
- Rename playground
- Duplicate playground
- Delete playground with confirmation
- Built-in example templates
- Export as HTML
- Export as separate HTML/CSS/JS files
- Export as ZIP
- Import supported playground files
- Copy generated output

Include working example templates:

1. Responsive landing page
2. Interactive buttons
3. CSS animation
4. Flexbox and Grid examples
5. JavaScript DOM interaction
6. Form validation

Every example must run correctly without external services.

---

# PART V — Real-Time Preview

## 11. Preview Engine

The preview engine is a core feature, not an optional addition.

Implement real-time previews for HTML, CSS, and JavaScript.

### CSS Updates

Where technically safe:

- Inject updated CSS without full navigation
- Preserve scroll position
- Preserve JavaScript application state
- Avoid unnecessary repainting
- Detect changes efficiently

### HTML Updates

- Rebuild the preview when required
- Handle invalid or incomplete HTML gracefully
- Avoid crashing during incomplete typing
- Preserve scroll position when practical

### JavaScript Updates

- Re-execute scripts in a correctly isolated context
- Prevent multiple stale executions
- Properly clean up obsolete preview sessions
- Display runtime exceptions

### Update Behavior

Use a configurable debounce mechanism.

Default debounce: approximately 200 milliseconds.

Avoid rebuilding the entire preview on every keystroke.

Allow manual refresh and disabling automatic refresh.

### Correct Asset Resolution

Support:

- Relative links
- Nested CSS files
- JavaScript modules
- Images
- Fonts
- Local static assets
- Multiple project directories within an approved workspace

Unsaved editor buffers must be correctly reflected in preview for supported static projects.

Create a secure virtual document and asset-resolution layer if needed.

### Preview Isolation

Do not run arbitrary project JavaScript with privileged Tauri application capabilities.

Use an appropriately isolated preview origin, restricted webview/iframe configuration, and carefully designed communication boundaries.

Prevent preview content from invoking privileged Rust commands.

Apply suitable CSP and permission restrictions.

Never expose unrestricted filesystem or shell APIs to the preview.

---

# PART VI — Responsive Preview

## 12. Device Simulation

Provide working presets:

- Mobile
- Tablet
- Desktop
- Responsive/custom width

Example default viewport widths:

- Mobile: 375 px
- Tablet: 768 px
- Desktop: 1440 px

Allow custom viewport dimensions.

Implement:

- Resize handles
- Zoom controls
- Orientation switching
- Fit-to-window
- Reset size

Ensure CSS media queries operate according to the actual preview viewport width.

Device simulation is viewport emulation, not a claim of complete hardware or mobile-browser emulation.

---

# PART VII — Live CSS Inspector

## 13. Interactive Visual Inspector

This advanced feature MUST be included in version 1.0.

Users should be able to activate an Inspector tool and click elements inside the live preview.

When an element is selected:

1. Highlight the element visually.
2. Display its HTML tag, classes, and ID.
3. Show dimensions and box model.
4. Show computed styles.
5. Display applicable CSS rules.
6. Identify the source stylesheet and rule location where feasible.
7. Navigate to relevant source code.
8. Allow supported CSS property values to be edited.
9. Reflect property changes immediately.
10. Synchronize supported edits with the actual source buffer.

Include an interactive box-model visualization for margin, border, padding, and content.

Provide practical property editors for:

- Colors
- Backgrounds
- Padding
- Margin
- Width and height
- Font size
- Border radius
- Borders
- Display
- Gap
- Alignment

Use color pickers, numeric controls, and text inputs where appropriate.

### Source Mapping

Implement source-aware CSS editing using CSS parsing and reliable range tracking.

Handle multiple selectors, declarations, and external stylesheets.

Do not blindly replace matching text.

For generated, minified, or dynamically injected styles where exact source mapping is unavailable, show a clear limitation and provide a safe computed-style inspection fallback.

Never corrupt source files to simulate inspector editing.

Ensure inspector modifications participate in Undo/Redo.

---

# PART VIII — Project Workspace

## 14. File Explorer

Implement a fully functional file explorer supporting:

- Open folder
- Multiple recent workspaces
- Nested directory navigation
- Create file
- Create folder
- Rename
- Delete
- Duplicate
- Move files
- Drag and drop where appropriate
- Open file
- Reveal file in Windows Explorer
- Refresh
- File-type icons
- Modified-file indicators

Watch the filesystem for relevant changes.

Ignore noisy directories such as `node_modules`, `.git` internal files, build outputs, and configured exclusions where appropriate.

Support configurable exclusion patterns.

Use explicit workspace root permissions.

Protect against path traversal, symlink escapes, and unauthorized access outside approved paths.

## 15. Workspace Search

Implement:

- Search by filename
- Search text across workspace files
- Search result highlighting
- Navigate directly to matching lines
- Sensible handling of large files
- Respect configured exclusions

Search must not freeze the main interface.

## 16. Workspace Persistence

Persist:

- Recently opened projects
- Open tabs
- Active file
- Panel sizes
- Layout mode
- Editor preferences
- Current project configuration

Restore the previous session after reopening the application.

Do not modify project source files simply by opening a workspace.

---

# PART IX — React, Vue, and Vite Support

## 17. Modern Frontend Project Support

React and Vue support MUST be implemented in version 1.0.

Support at least:

- React + Vite
- Vue + Vite
- Vanilla Vite
- Static HTML/CSS/JS projects

Detect supported projects using their configuration and package manifests.

### Development Server Management

Allow the user to:

- Detect available package managers
- Identify the project's development command
- Start a development server
- Stop a development server
- Restart the server
- View server logs
- Open the running application in Preview
- Observe hot module reload updates

Use existing Node.js/npm/pnpm/yarn installations when available.

If a required runtime is missing, provide an explicit setup guide and actionable error message.

Do not silently download or execute unknown runtimes.

Never execute arbitrary package scripts without an explicit user action or consent.

Run processes with argument arrays rather than unsafe shell-string concatenation.

Manage process lifetime and cleanup correctly.

Avoid orphaned development servers after application exit.

### Framework Preview

Display supported dev servers using isolated preview functionality.

Allow refreshing and responsive resizing.

Support existing Vite HMR instead of interfering with it.

For framework projects, clearly distinguish unsaved editor changes from changes actually processed by the development server.

Where a safe temporary workspace overlay can be implemented, support live unsaved preview. Otherwise, provide explicit Save-to-Preview behavior without silently writing changes to disk.

Do not claim unsaved framework changes are rendered if they are not.

Basic HTML/CSS/JS projects must always support unsaved-buffer live preview.

---

# PART X — Console and Diagnostics

## 18. Console

Capture relevant preview events:

- console.log
- console.info
- console.warn
- console.error
- Uncaught exceptions
- Unhandled promise rejections

Display:

- Severity
- Message
- Timestamp
- Source filename
- Line and column where available
- Stack trace when available

Support:

- Clear console
- Filter by severity
- Search messages
- Copy messages
- Jump to source when supported

Keep source-code console events separate from application-internal diagnostic logs.

## 19. Problems Panel

Show actionable diagnostics including:

- JavaScript syntax errors
- Relevant TypeScript diagnostics
- Supported HTML/CSS validation problems
- Preview failures
- File access errors

Use accurate diagnostics, not invented warning messages.

Do not require a full heavyweight language server for basic functionality.

---

# PART XI — Git Integration

## 20. Built-In Git Tools

Git integration is mandatory in version 1.0.

Implement:

- Detect Git repository
- Initialize repository
- Show current branch
- Show changed files
- Show staged and unstaged changes
- View diffs
- Stage files
- Unstage files
- Discard changes with confirmation
- Commit changes
- View commit history
- Create branch
- Switch branch
- Fetch
- Pull
- Push

Provide meaningful Git errors.

Do not overwrite local changes when switching branches.

Use established Git libraries or safe Git process integration.

Never concatenate untrusted filenames into shell commands.

Support existing system Git credentials where practical.

Do not store credentials or tokens in plaintext.

Operations that could discard user data must require clear confirmation.

The Git UI should be compact and useful rather than copying every feature of a full Git client.

---

# PART XII — Plugin and Extension System

## 21. Extension Architecture

An actual extension system is required in version 1.0.

Do not merely create an empty Extensions screen.

Implement a documented, versioned extension API.

A plugin should have a manifest similar in concept to:

```json
{
  "id": "example.theme",
  "name": "Example Theme",
  "version": "1.0.0",
  "apiVersion": "1",
  "permissions": []
}
```

The exact schema may be improved.

### Supported Extension Points

At minimum, allow extensions to contribute:

- Themes
- Code snippets
- Playground templates
- Commands
- Command Palette entries
- Limited UI panels or views
- Document/editor event integrations

### Extension Manager

Implement:

- List installed extensions
- Install from local package
- Enable
- Disable
- Uninstall
- Show version
- Show declared permissions
- Validate compatibility
- Show meaningful errors
- Persist extension state

### Security

Do not execute arbitrary extension JavaScript in the privileged application context.

Use an isolated worker or sandboxed execution environment and a permission-limited messaging API.

Native filesystem and shell access must not be granted automatically.

Validate plugin manifests and package contents.

Prevent archive path traversal and unauthorized overwrites during installation.

Provide at least two functioning example extensions:

1. A custom theme extension
2. A code snippets or playground template extension

Both must be usable through the extension manager.

Document how developers can create extensions.

A public extension marketplace is not necessary, but installation, removal, activation, APIs, and examples must genuinely work.

---

# PART XIII — Visual Design System

## 22. Design Direction: Focused Developer Studio

Renderift should feel like a refined desktop developer tool.

Design references include the usability and information density of established editors, without copying their branding or interfaces.

### Visual Identity

Create a distinctive Renderift identity using:

- Deep slate surfaces
- Carefully selected mint/emerald accents
- Restrained blue highlights
- Strong typography
- Clean SVG icons
- Consistent spacing
- Subtle separators
- Deliberate hierarchy

Suggested foundation colors:

```css
--app-bg: #111827;
--panel-bg: #172033;
--surface-bg: #1e293b;
--accent: #65e6bb;
--accent-blue: #609bff;
--text-primary: #f1f5f9;
--text-secondary: #94a3b8;
```

These are starting points, not mandatory final values.

Avoid:

- Oversized cards
- Excessive whitespace
- Generic dashboard layouts
- Random gradients
- Excessive shadows
- Gratuitous animations
- Tiny unreadable controls
- Toolbars with confusing organization
- Overdecorated AI-generated aesthetics

### Theme System

Implement:

- Dark theme
- Light theme
- At least one additional refined theme
- Custom accent color
- Editor font selection
- Font size adjustments
- UI density preferences
- Persisted preferences

Theme switching must update the interface immediately without requiring a restart.

### Layout Customization

Provide:

- Vertical split
- Horizontal split
- Adjustable panel sizes
- Collapsible sidebar
- Collapsible console
- Fullscreen preview
- Focus/Zen mode
- Reset layout

Store layout configuration across sessions.

### Accessibility

Include:

- Keyboard navigation
- Visible focus states
- Accessible labels
- Reasonable contrast
- Clear disabled states
- Reduced-motion support
- Resizable text

The primary interface language is English.

Correct rendering of Persian text and RTL webpage previews is required.

---

# PART XIV — Keyboard Shortcuts

## 23. Essential Shortcuts

Implement standard Windows shortcuts, including:

| Shortcut | Action |
|---|---|
| Ctrl+N | New File |
| Ctrl+O | Open File |
| Ctrl+Shift+O | Open Folder |
| Ctrl+S | Save |
| Ctrl+Shift+S | Save As |
| Ctrl+Shift+F | Search Workspace |
| Ctrl+F | Search Current File |
| Ctrl+H | Replace |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+P | Quick Open |
| Ctrl+Shift+P | Command Palette |
| Ctrl+B | Toggle Sidebar |
| Ctrl+` | Toggle Console |
| Ctrl+W | Close Tab |
| Ctrl+Tab | Next Tab |
| F5 | Refresh Preview |
| F11 | Fullscreen |

Make shortcuts discoverable in menus.

Avoid conflicts with CodeMirror behavior and system shortcuts.

---

# PART XV — Performance and Reliability

## 24. Performance Requirements

Optimize for everyday Windows laptops and desktops.

Performance targets:

- Cold startup: aim below 2 seconds on representative hardware
- Small and efficient application distribution
- Installer/package size target: below 30 MB where practical, excluding separately installed WebView2 runtime
- Responsive editor during normal typing
- Nonblocking filesystem operations
- Bounded memory growth
- Lazy loading of advanced modules
- Efficient file tree updates
- No unnecessary project-wide rescans
- No repeated dependency installation on launch
- No telemetry or cloud service requirement

Measure actual startup time, package size, and memory usage.

Include performance measurements in the QA report.

These are engineering targets, not reasons to remove required functionality.

Advanced capabilities should load only when used.

## 25. Error Recovery

Handle:

- Invalid HTML
- Invalid CSS
- JavaScript runtime exceptions
- Missing image assets
- Missing files
- Access denied
- Corrupted settings
- External filesystem changes
- Failed Git operations
- Missing Node.js
- Failed development server startup
- Crashing preview scripts
- Invalid extension packages

Errors must not crash the entire application.

Use meaningful error messages and recovery paths.

Keep internal logging separate from user project output.

---

# PART XVI — Security

## 26. Mandatory Security Controls

Treat project files, preview scripts, extensions, and development server output as potentially untrusted.

Implement:

- Least-privilege Tauri capabilities
- Separate security boundaries for app and preview content
- Restricted filesystem scope
- Path normalization and validation
- Symlink traversal protection
- Safe subprocess argument handling
- Appropriate CSP policies
- Extension isolation
- Explicit permissions
- Safe ZIP extraction
- No unrestricted native execution from preview content
- No hidden remote code execution
- No plaintext credential storage

For local development servers, bind to loopback by default.

Avoid exposing local services on all network interfaces.

Avoid automatically loading arbitrary remote URLs in privileged contexts.

Document threat boundaries and remaining limitations in `docs/SECURITY.md`.

Add negative tests for unauthorized filesystem access and privileged IPC attempts from untrusted preview content.

---

# PART XVII — Packaging and Distribution

## 27. Windows Release

Deliver version `1.0.0`.

Generate:

- Windows installer (.exe, NSIS)
- Portable Windows build
- Release checksums
- Release notes

Where practical, also generate an MSI package.

The portable build must be genuinely usable without running an installer, while clearly documenting system dependencies such as WebView2.

Do not represent an unconfigured development executable as a verified portable release.

Use reproducible build steps.

Do not require users to install Rust, development dependencies, or an IDE to run the distributed application.

Static HTML/CSS/JS editing and preview must work offline without Node.js.

React/Vue development workflows may require a compatible local Node.js environment.

Document this distinction.

## 28. GitHub Actions

Create working CI workflows for:

- Frontend linting
- Type checking
- Frontend tests
- Rust formatting checks
- Rust linting
- Rust tests
- Production build
- Windows packaging
- Release artifact upload

Use appropriate GitHub Actions permissions and pin dependencies sensibly.

Do not publish failing builds.

Provide a release workflow triggered by version tags.

If signing certificates are unavailable, produce unsigned artifacts and clearly document Windows SmartScreen implications rather than pretending the builds are signed.

---

# PART XVIII — Testing and Quality Assurance

## 29. Automated Testing

Implement meaningful unit tests for:

- Document state
- Unsaved buffers
- Preview update scheduling
- Project asset resolution
- Workspace path security
- Settings persistence
- File conflict handling
- Git state handling
- Plugin validation
- Inspector CSS transformations

Implement integration tests for:

- Playground HTML/CSS/JS preview
- Relative asset loading
- JavaScript console capture
- File save and reload
- Workspace opening
- External file changes
- Git staging and commits
- Extension installation and activation
- React/Vite preview
- Vue/Vite preview

Use automated UI tests for key interactions where the execution environment supports them.

## 30. Manual QA Checklist

Verify at least these workflows:

1. Launch application on a clean supported Windows installation.
2. Open Playground Mode.
3. Type HTML and observe the preview.
4. Modify CSS and verify the rendered appearance.
5. Run JavaScript DOM interactions.
6. Verify console output.
7. Export playground files.
8. Restart Renderift and restore the session.
9. Open a real multi-file static project.
10. Edit CSS without saving and observe preview changes.
11. Save files and verify actual disk contents.
12. Open and switch between multiple tabs.
13. Edit an image or external file and detect changes.
14. Use the visual CSS Inspector.
15. Select an element and navigate to its source.
16. Edit a CSS property through the Inspector.
17. Undo the Inspector change and verify source synchronization.
18. Test mobile and desktop preview sizes.
19. Open React/Vite example.
20. Start its development server and verify rendering.
21. Edit React source and verify HMR after the supported update action.
22. Repeat equivalent tests with Vue/Vite.
23. Initialize and modify a Git repository.
24. View diffs, stage, commit, and switch branches.
25. Install and activate an example extension.
26. Disable and uninstall the extension.
27. Switch themes and change accent colors.
28. Test keyboard shortcuts.
29. Test Persian content.
30. Verify abnormal-exit recovery.
31. Verify restricted preview code cannot access privileged native APIs.
32. Test the packaged installer.
33. Test the portable build.
34. Check startup performance and memory consumption.

Do not mark a feature complete solely because the source code contains an implementation.

Verify actual behavior.

---

# PART XIX — Documentation

## 31. Required Documentation

Create:

### README.md

Include:

- Product overview
- Features
- Screenshots of the actual application
- Requirements
- Installation
- Quick start
- Playground workflow
- Project workflow
- Development instructions
- Build commands
- Test commands
- Known limitations

### docs/ARCHITECTURE.md

Describe:

- Application architecture
- Module responsibilities
- Frontend/backend communication
- Preview isolation
- Document buffer model
- Preview asset resolution
- Project runtime integration

### docs/FEATURES.md

Describe all implemented features and their usage.

### docs/SECURITY.md

Describe trust boundaries, permissions, and security decisions.

### docs/EXTENSIONS.md

Document the extension API and installation process.

### docs/TESTING.md

Explain automated and manual testing procedures.

### docs/QA-REPORT.md

Report actual verification results, performance measurements, and remaining limitations.

### CONTRIBUTING.md

Explain development standards and contribution workflow.

Documentation must match the code.

Do not document nonexistent functionality as implemented.

---

# PART XX — Implementation Strategy

## 32. Autonomous Execution

Complete the assignment through these internal implementation milestones:

**Milestone A — Foundation**

Initialize Tauri, frontend tooling, architecture, design tokens, editor integration, and application shell.

**Milestone B — Editor and Playground**

Implement document buffers, editor behavior, Playground Mode, templates, persistence, and export.

**Milestone C — Preview Engine**

Implement isolated preview, live updates, asset resolution, console capture, and responsive viewports.

**Milestone D — Workspace**

Implement filesystem operations, tab management, project navigation, file watching, conflicts, and workspace persistence.

**Milestone E — Visual Inspector**

Implement DOM selection, computed styles, CSS rule mapping, visual property editing, and synchronized source transformations.

**Milestone F — Modern Projects**

Implement React/Vue/Vite detection, safe development-server lifecycle, preview integration, and relevant diagnostics.

**Milestone G — Git and Extensions**

Implement the integrated Git tools, extension APIs, extension manager, and functioning sample plugins.

**Milestone H — Polish, Security, QA, and Release**

Perform security review, UI improvements, automated tests, integration tests, packaging, and documentation.

These milestones are an execution sequence, not separate product releases.

**All milestones are required for version 1.0.0.**

Do not stop after delivering only Foundation or Playground Mode.

## 33. Repository Workflow

1. Inspect the repository before changing anything.
2. Preserve existing valid work.
3. Create a development branch such as `feat/renderift-v1`.
4. Commit logical changes with meaningful messages.
5. Keep commits scoped and reviewable.
6. Add or update tests as features are implemented.
7. Maintain an implementation checklist in the repository.
8. Run verification after significant changes.
9. Fix detected defects before continuing.
10. Push the implementation branch when repository permissions allow.
11. Create a pull request for review.
12. Produce release artifacts after successful verification.
13. Prepare the `v1.0.0` release from verified code.
14. Do not report a release as published unless it actually exists.

Avoid unnecessary documentation proliferation.

Keep the repository clean, organized, and easy for another developer to understand.

---

# PART XXI — Definition of Done

## 34. Acceptance Criteria

Renderift v1.0.0 is complete only when:

- The desktop application builds successfully.
- Playground Mode works.
- Project Mode works.
- HTML/CSS/JS live preview works.
- Static project assets resolve correctly.
- Editor and file management features work.
- Responsive preview works.
- Console and diagnostics work.
- Interactive CSS inspection and supported visual editing work.
- React/Vue/Vite development workflows work.
- Git integration works.
- The extension manager and example extensions work.
- Themes and layout customization work.
- Recovery and persistence work.
- Security boundaries have been tested.
- Automated tests pass.
- Windows release artifacts have been generated and verified.
- Documentation reflects actual behavior.
- No known release-blocking bugs remain.

A visually polished interface without functioning backend integration does not meet these criteria.

Likewise, working backend functionality with a broken or incomplete UI does not meet them.

## 35. Final Deliverables

Provide:

1. Complete working source code.
2. Clear repository structure.
3. Functional Windows desktop application.
4. Windows installer.
5. Portable Windows package.
6. Automated tests.
7. Real QA results.
8. Screenshots from the implemented application.
9. Complete documentation.
10. GitHub development branch and pull request, where access permits.
11. Verified release artifacts and release notes.

At completion, report:

- Implemented functionality
- Test results
- Build results
- Actual package size
- Measured performance
- Security checks
- Known limitations
- Repository and release links

Do not fabricate measurements, screenshots, CI results, or release URLs.

## FINAL INSTRUCTION

Build Renderift as a real, polished, maintainable, lightweight developer tool.

The defining experience is:

**Open Renderift → Write code → Immediately see the result → Inspect and refine visually → Save or ship a real project.**

All capabilities specified here belong to version 1.0.0.

Prioritize technical correctness, user experience, security, and maintainability.

Proceed with implementation rather than stopping at planning or producing only a scaffold.

**Deliver the complete application, not a demonstration of what the application could become.**