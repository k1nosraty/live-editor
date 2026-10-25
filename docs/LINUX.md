# Linux desktop distribution

Target architecture: x86_64. Linux is built natively; the Windows executable is not run through Wine. The configured release baseline is Ubuntu 22.04 x64, with Debian 12+ as a package compatibility target. A successful build is not evidence of installation on every distribution.

## Packages

- **`.deb`**: Debian/Ubuntu package with the Tauri-generated desktop entry, PNG icon and runtime dependencies, plus `xdg-utils` for opening files/URLs. Install using `sudo apt install ./Live\ Editor_*.deb` so dependencies are resolved.
- **`.AppImage`**: executable distribution with a larger bundled dependency set. Run `chmod +x ./Live\ Editor_*.AppImage` and execute it. It still requires a compatible glibc/graphics stack. If FUSE is unavailable, try `APPIMAGE_EXTRACT_AND_RUN=1 ./Live\ Editor_*.AppImage` or the `.deb` package.

Do not expect an AppImage to match the small Windows installer size: packaging WebKitGTK/GTK-related dependencies can make it substantially larger. No exact size target is claimed without measuring an actual artifact.

## Build from source

Install Node.js 22 LTS and stable Rust. On Ubuntu:

```sh
sudo apt update
sudo apt install build-essential pkg-config libwebkit2gtk-4.1-dev libssl-dev \
  libxdo-dev libayatana-appindicator3-dev librsvg2-dev patchelf xdg-utils
npm ci
npm run tauri dev
NO_STRIP=true npm run tauri build -- --bundles deb,appimage
```

`Start-Live-Editor.sh` checks installed tools and reuses dependencies if the npm lockfile has not changed. It does not download a runtime or install workspace project dependencies. Source builds need the development libraries; installed `.deb` users need only the runtime packages declared in the package.

Build outputs: `src-tauri/target/release/bundle/deb/` and `bundle/appimage/`. For broad glibc compatibility use the oldest supported builder; the CI uses Ubuntu 22.04. Locally building on Ubuntu 24.04 does not establish Ubuntu 22.04 binary compatibility.

## Desktop workflows

Native Open/Save dialogs, file watching/search, GTK/WebKit rendering, Git and Vite use the same Rust modules as Windows. System reveal and local preview opening use `xdg-open`. A desktop launched through a menu may not inherit shell initialization or a Node version manager's PATH; missing runtime errors identify the required local package manager. Live Editor does not source shell startup scripts automatically.

Playground/static editing works without Node.js. React/Vue/Vite project execution requires a local runtime and explicitly installed project dependencies. Git operations require system Git and its configured credential helper.

## Preview and native boundary

Linux webview capability checks have an iframe-origin limitation documented by Tauri. The native gateway therefore additionally requires a random per-launch secret injected only into the trusted top-level app origin. Sandboxed previews cannot read that secret. All file/process/dialog/window mutations go through that authenticated gateway; frontend plugin/window mutation permissions are not granted. The token is never stored in project/recovery files or preview messages.

This complements sandboxing, CSP, path grants and operation validation. Native WebKit tests are configured to verify a valid call, a forged call rejection, isolated preview parent/token access, real preview interaction and console capture.

## CI and smoke tests

The Linux CI job installs WebKitGTK, runs native Rust checks/tests, builds `.deb`/AppImage, executes `scripts/native-smoke.py` through `tauri-driver`/WebKitWebDriver under Xvfb, and uploads packages, checksums and smoke evidence. Tag releases collect **both** Windows and Linux artifacts into a draft release only after both jobs pass.

To run the native test locally after building:

```sh
sudo apt install xvfb dbus-x11 webkit2gtk-driver
cargo install tauri-driver --locked
dbus-run-session -- xvfb-run -a python3 scripts/native-smoke.py \
  --binary src-tauri/target/release/live-editor --output release/linux-smoke
```

A virtual-display smoke is not clean desktop installation/uninstallation QA. Remaining checks include real X11/Wayland sessions, file dialogs, package installation, fonts/Persian input, system-browser launching and AppImage behavior on representative distributions.
