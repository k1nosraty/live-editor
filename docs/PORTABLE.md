# Portable Windows distribution

Extract the ZIP to a writable folder and run Renderift.exe. No Rust, Node.js, npm, IDE, or installer is required for playground and static HTML/CSS/JS workflows. Windows 10/11 x64 and the Microsoft Edge WebView2 Evergreen Runtime are required. If WebView2 is missing, install Microsoft's official Evergreen Runtime first.

React/Vue/Vite workflows additionally require your own Node.js LTS installation and project dependencies. Git operations require Git for Windows and its normal credential manager. The app never installs either runtime or project dependencies on launch.

The portable executable uses the standard application data directory for settings/recovery. It is a no-install distribution, not a fully self-contained WebView2 browser and not a portable-settings profile. The executable and installers are unsigned. SmartScreen may require More info → Run anyway after checking the SHA256 checksum and source of the download. No signing certificate has been supplied.

The supplied Linux GNU cross-build is explicitly an experimental candidate. Keep its bundled WebView2Loader.dll beside Renderift.exe. This loader is separate from the installed Evergreen Runtime. The Windows MSVC CI distribution may statically link the loader instead. Consult QA-REPORT.md before treating either artifact as verified.
