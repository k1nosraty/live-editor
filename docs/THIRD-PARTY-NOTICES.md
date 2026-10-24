# Third-party components

Renderift's own source is MIT licensed. Its dependencies retain their respective licenses. Exact versions are locked in package-lock.json and src-tauri/Cargo.lock; installed package/crate metadata is the authoritative dependency inventory.

The bundled frontend uses Svelte, CodeMirror/Lezer, PostCSS, Prettier and fflate (MIT), and Lucide icons (ISC). Tauri/Rust dependencies use their published MIT, Apache-2.0 or other stated licenses.

The GNU Windows candidate includes Microsoft's WebView2Loader.dll from the webview2-com-sys dependency. WebView2 components are Microsoft components governed by the Microsoft Edge WebView2 SDK/runtime distribution terms. The separately installed Evergreen WebView2 runtime is not a complete bundled browser in this distribution. Microsoft SDK terms: https://www.nuget.org/packages/Microsoft.Web.WebView2/

The installer uses NSIS and Tauri's NSIS utility plugin under their respective published licenses. No dependency license is replaced by Renderift's MIT license. Source dependencies and original package license notices can be obtained through the lockfiles' package sources.
