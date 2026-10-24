# Extension API v1

Install a JSON manifest or a ZIP containing exactly one root `manifest.json` through Extensions → Install from package. Packages are at most 1 MiB compressed/input and 2 MiB expanded. The manifest ID must be lowercase letters, digits, dots and hyphens; version must be numeric `major.minor.patch`; `apiVersion` must be `"1"`.

```json
{
  "id": "example.tools",
  "name": "Example Tools",
  "version": "1.0.0",
  "apiVersion": "1",
  "permissions": [],
  "snippets": [{"name":"Button", "language":"HTML", "body":"<button>Go</button>"}],
  "commands": [{"id":"insert", "title":"Insert Button", "action":"insertSnippet", "value":"Button"}]
}
```

| Contribution | Schema / behavior |
|---|---|
| `themes` | Array of `{name, accent, background}`; colors are six-digit hex. Apply through a `setTheme` command. |
| `snippets` | Array of `{name, language, body}`. `insertSnippet` inserts at the active editor selection and participates in Undo. |
| `templates` | Array of `{name, html, css, js}`. `newPlayground` creates a named session from it. |
| `commands` | Array of `{id, title, action, value}`. Actions: `insertSnippet`, `newPlayground`, `setTheme`, `showPanel`. The value names the contributed item. Commands appear in the manager and Command Palette. |
| `panels` | Array of `{id, title, text}`. Text is rendered as text, never privileged HTML. `showPanel` opens the view. |
| `events` | Array of `{on, panel, format}`. Event names: `documentChanged`, `documentOpened`. Formats support `{name}`, `{lines}`, `{characters}` in an open contributed panel. Requires `document:read`. |

Only the optional `document:read` permission is supported. The user confirms it before installation. No filesystem, shell, network, clipboard or arbitrary execution permission exists. API v1 is declarative: `.js` payloads are rejected. This is an intentional execution boundary, not an empty extension screen or a claim to support VS Code extensions.

Enable/disable and uninstall take effect immediately. Installed state is persisted in the application origin's storage. Disabling/removing a theme clears its background override; the user's selected accent remains a normal preference. Package replacement asks for confirmation and validates the replacement before removing an installed extension.

Try `extensions/examples/forest-theme.json` and `starter-kit.json`. The latter contributes an accessible button, a working playground template and a live document statistics panel. To distribute a ZIP:

```sh
# Put your validated manifest in an otherwise empty folder, then ZIP it as manifest.json.
```

Do not include executable code, path names, remote script URLs or native binaries. The app does not contact a marketplace.
