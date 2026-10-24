pub mod documents;
pub mod git;
pub mod preview;
pub mod processes;
pub mod security;
pub mod workspace;
use notify::{RecursiveMode, Watcher};
use security::{Result, Scope};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
pub struct Backend {
    pub scope: Scope,
    preview: Option<preview::PreviewServer>,
    playground_preview: Option<preview::PreviewServer>,
    runtime: Option<processes::Runtime>,
    watcher: Option<notify::RecommendedWatcher>,
    changes: Arc<Mutex<Vec<String>>>,
    pub data_dir: PathBuf,
}
impl Backend {
    pub fn new(data_dir: PathBuf) -> Self {
        let mut scope = Scope::default();
        if let Ok(bytes) = fs::read(data_dir.join("grants.json")) {
            if let Ok((roots, files)) =
                serde_json::from_slice::<(Vec<PathBuf>, Vec<PathBuf>)>(&bytes)
            {
                for root in roots.into_iter().take(100) {
                    let _ = scope.approve_root(&root);
                }
                for file in files.into_iter().take(1000) {
                    let _ = scope.approve_file(&file);
                }
            }
        }
        Self {
            scope,
            preview: None,
            playground_preview: None,
            runtime: None,
            watcher: None,
            changes: Arc::new(Mutex::new(vec![])),
            data_dir,
        }
    }
    pub fn persist_grants(&self) -> Result<()> {
        fs::create_dir_all(&self.data_dir).map_err(|e| e.to_string())?;
        let bytes = serde_json::to_vec(&(&self.scope.roots, &self.scope.files))
            .map_err(|e| e.to_string())?;
        security::atomic_write(&self.data_dir.join("grants.json"), &bytes)
    }
    pub fn watch(&mut self, path: &Path) -> Result<()> {
        let events = self.changes.clone();
        let mut watcher =
            notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
                if let Ok(event) = result {
                    if let Ok(mut pending) = events.lock() {
                        for path in event.paths {
                            if pending.len() < 1000 {
                                let text = path.to_string_lossy().to_string();
                                if !text.contains("node_modules")
                                    && !text.contains(".git/")
                                    && !pending.contains(&text)
                                {
                                    pending.push(text)
                                }
                            }
                        }
                    }
                }
            })
            .map_err(|e| e.to_string())?;
        watcher
            .watch(path, RecursiveMode::Recursive)
            .map_err(|e| e.to_string())?;
        self.watcher = Some(watcher);
        Ok(())
    }
    pub fn execute(&mut self, op: &str, args: Value) -> Result<Value> {
        let string = |key: &str| -> Result<&str> {
            args.get(key)
                .and_then(Value::as_str)
                .ok_or_else(|| format!("Missing {key}"))
        };
        match op {
            "read" => Ok(
                serde_json::to_value(documents::read(&self.scope, string("path")?)?)
                    .map_err(|e| e.to_string())?,
            ),
            "save" => Ok(serde_json::to_value(documents::save(
                &self.scope,
                string("path")?,
                string("text")?,
                args["revision"].as_str(),
            )?)
            .map_err(|e| e.to_string())?),
            "list" => Ok(serde_json::to_value(workspace::list(
                &self.scope,
                string("path")?,
                args["excludes"]
                    .as_str()
                    .unwrap_or("node_modules,.git,dist,build,target"),
            )?)
            .map_err(|e| e.to_string())?),
            "detect" => {
                let p = workspace::approved_root(&self.scope, string("root")?)?;
                Ok(workspace::detect(&p))
            }
            "fs" => {
                workspace::mutate(
                    &self.scope,
                    string("action")?,
                    string("path")?,
                    args["target"].as_str(),
                )?;
                Ok(Value::Null)
            }
            "search" => Ok(serde_json::to_value(workspace::search(
                &self.scope,
                string("root")?,
                string("query")?,
                args["filename"].as_bool().unwrap_or(false),
                args["excludes"]
                    .as_str()
                    .unwrap_or("node_modules,.git,dist,build,target"),
            )?)
            .map_err(|e| e.to_string())?),
            "watch" => {
                let root = workspace::approved_root(&self.scope, string("root")?)?;
                self.watch(&root)?;
                Ok(Value::Null)
            }
            "poll" => {
                let changes = std::mem::take(&mut *self.changes.lock().map_err(|e| e.to_string())?);
                let mut logs = vec![];
                let mut running = false;
                if let Some(runtime) = self.runtime.as_mut() {
                    running = runtime.running();
                    if let Ok(mut out) = runtime.logs.lock() {
                        logs = out.drain(..).collect()
                    }
                }
                Ok(json!({"changes":changes,"logs":logs,"running":running}))
            }
            "playground_preview" => {
                if self.playground_preview.is_none() {
                    let root = self.data_dir.join("playground-preview");
                    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
                    fs::write(root.join("index.html"), "").map_err(|e| e.to_string())?;
                    self.playground_preview = Some(preview::PreviewServer::start(
                        fs::canonicalize(root).map_err(|e| e.to_string())?,
                    )?);
                }
                let server = self.playground_preview.as_ref().unwrap();
                server
                    .data
                    .lock()
                    .map_err(|e| e.to_string())?
                    .overlays
                    .insert("index.html".into(), string("html")?.into());
                Ok(json!(format!("{}/index.html", server.url)))
            }
            "preview_start" => {
                let root = workspace::approved_root(&self.scope, string("root")?)?;
                self.preview = Some(preview::PreviewServer::start(root)?);
                Ok(json!(self.preview.as_ref().unwrap().url))
            }
            "preview_update" => {
                let server = self
                    .preview
                    .as_ref()
                    .ok_or("Open a workspace before previewing")?;
                let mut data = server.data.lock().map_err(|e| e.to_string())?;
                let buffers = args["buffers"]
                    .as_array()
                    .ok_or("Missing preview buffers")?;
                let mut overlays = HashMap::new();
                let mut size = 0;
                for buffer in buffers {
                    let path = buffer["path"].as_str().ok_or("Invalid buffer path")?;
                    let p = self.scope.resolve(path)?;
                    if let Ok(rel) = p.strip_prefix(&data.root) {
                        let text = buffer["text"].as_str().ok_or("Invalid buffer")?;
                        size += text.len();
                        if size > 32 * 1024 * 1024 {
                            return Err("Preview buffers exceed 32 MiB".into());
                        }
                        overlays.insert(rel.to_string_lossy().replace('\\', "/"), text.into());
                    }
                }
                data.overlays = overlays;
                data.bridge = string("bridge")?.into();
                Ok(Value::Null)
            }
            "server_start" => {
                if self.runtime.is_some() {
                    return Err("Stop the existing development server first".into());
                }
                let root = workspace::approved_root(&self.scope, string("root")?)?;
                self.runtime = Some(processes::Runtime::start(&root)?);
                Ok(json!("http://127.0.0.1:5173"))
            }
            "server_stop" => {
                self.runtime = None;
                Ok(Value::Null)
            }
            "git_status" => {
                let root = workspace::approved_root(&self.scope, string("root")?)?;
                Ok(serde_json::to_value(git::status(&root)?).map_err(|e| e.to_string())?)
            }
            "git" => {
                let root = workspace::approved_root(&self.scope, string("root")?)?;
                Ok(json!(git::operation(
                    &root,
                    string("action")?,
                    args["path"].as_str(),
                    args["value"].as_str()
                )?))
            }
            "recovery_save" => {
                let data = string("data")?;
                if data.len() > 48 * 1024 * 1024 {
                    return Err("Recovery exceeds 48 MiB".into());
                }
                serde_json::from_str::<Value>(data).map_err(|e| e.to_string())?;
                fs::create_dir_all(&self.data_dir).map_err(|e| e.to_string())?;
                security::atomic_write(&self.data_dir.join("session.json"), data.as_bytes())?;
                Ok(Value::Null)
            }
            "recovery_load" => {
                let p = self.data_dir.join("session.json");
                if !p.exists() {
                    return Ok(Value::Null);
                }
                let data = fs::read_to_string(p).map_err(|e| e.to_string())?;
                Ok(json!(data))
            }
            "reveal" => {
                let p = self.scope.resolve(string("path")?)?;
                reveal(&p)?;
                Ok(Value::Null)
            }
            "external" => {
                let url = string("url")?;
                if !url.starts_with("http://127.0.0.1:") {
                    return Err("Only local preview addresses can be opened".into());
                }
                open_external(url)?;
                Ok(Value::Null)
            }
            _ => Err("Unsupported native operation".into()),
        }
    }
}
fn reveal(path: &Path) -> Result<()> {
    #[cfg(windows)]
    let mut command = {
        let mut c = std::process::Command::new("explorer.exe");
        c.arg("/select,").arg(path);
        c
    };
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut c = std::process::Command::new("open");
        c.arg("-R").arg(path);
        c
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut c = std::process::Command::new("xdg-open");
        c.arg(if path.is_dir() {
            path
        } else {
            path.parent().unwrap_or(path)
        });
        c
    };
    command.spawn().map_err(|e| e.to_string())?;
    Ok(())
}
fn open_external(url: &str) -> Result<()> {
    #[cfg(windows)]
    let mut command = {
        let mut c = std::process::Command::new("rundll32.exe");
        c.args(["url.dll,FileProtocolHandler", url]);
        c
    };
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut c = std::process::Command::new("open");
        c.arg(url);
        c
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut c = std::process::Command::new("xdg-open");
        c.arg(url);
        c
    };
    command.spawn().map_err(|e| e.to_string())?;
    Ok(())
}
#[cfg(feature = "desktop")]
mod desktop {
    use super::*;
    use tauri::{Manager, State};
    use tauri_plugin_dialog::DialogExt;
    #[tauri::command]
    async fn dispatch(
        app: tauri::AppHandle,
        state: State<'_, Arc<Mutex<Backend>>>,
        op: String,
        args: Value,
    ) -> Result<Value> {
        let backend = state.inner().clone();
        tauri::async_runtime::spawn_blocking(move || {
            if op == "select_folder" || op == "select_file" || op == "select_save" {
                let selection = if op == "select_folder" {
                    app.dialog().file().blocking_pick_folder()
                } else if op == "select_save" {
                    app.dialog()
                        .file()
                        .set_file_name(args["name"].as_str().unwrap_or("untitled.html"))
                        .blocking_save_file()
                } else {
                    app.dialog().file().blocking_pick_file()
                };
                let Some(file) = selection else {
                    return Ok(Value::Null);
                };
                let path = file.into_path().map_err(|e| e.to_string())?;
                let mut core = backend.lock().map_err(|e| e.to_string())?;
                let approved = if op == "select_folder" {
                    core.scope.approve_root(&path)?
                } else {
                    core.scope.approve_file(&path)?
                };
                core.persist_grants()?;
                return Ok(json!(approved));
            }
            let result = backend
                .lock()
                .map_err(|e| e.to_string())?
                .execute(&op, args);
            result
        })
        .await
        .map_err(|e| e.to_string())?
    }
    pub fn run() {
        tauri::Builder::default()
            .plugin(tauri_plugin_dialog::init())
            .setup(|app| {
                let data_dir = app.path().app_data_dir()?;
                app.manage(Arc::new(Mutex::new(Backend::new(data_dir))));
                Ok(())
            })
            .invoke_handler(tauri::generate_handler![dispatch])
            .run(tauri::generate_context!())
            .expect("Renderift desktop runtime");
    }
}
#[cfg(feature = "desktop")]
pub use desktop::run;

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};
    #[test]
    fn native_file_lifecycle_and_durable_grants() {
        let root = tempfile::tempdir().unwrap();
        let data = tempfile::tempdir().unwrap();
        let mut backend = Backend::new(data.path().into());
        backend.scope.approve_root(root.path()).unwrap();
        backend.persist_grants().unwrap();
        let file = root.path().join("first.txt").to_string_lossy().to_string();
        backend
            .execute("fs", json!({"action":"create_file","path":file}))
            .unwrap();
        let first = backend.execute("read", json!({"path":file})).unwrap();
        backend
            .execute(
                "save",
                json!({"path":file,"text":"سلام","revision":first["revision"]}),
            )
            .unwrap();
        let copy = root.path().join("second.txt").to_string_lossy().to_string();
        backend
            .execute(
                "fs",
                json!({"action":"duplicate","path":file,"target":copy}),
            )
            .unwrap();
        let mut restored = Backend::new(data.path().into());
        assert_eq!(
            restored.execute("read", json!({"path":copy})).unwrap()["text"],
            "سلام"
        );
        restored
            .execute("recovery_save", json!({"data":"{\"docs\":[]}"}))
            .unwrap();
        assert!(restored
            .execute("recovery_load", json!({}))
            .unwrap()
            .as_str()
            .unwrap()
            .contains("docs"));
        assert!(restored
            .execute("shell", json!({"command":"evil"}))
            .is_err());
    }
    #[test]
    fn observes_external_changes() {
        let root = tempfile::tempdir().unwrap();
        let data = tempfile::tempdir().unwrap();
        let mut backend = Backend::new(data.path().into());
        backend.scope.approve_root(root.path()).unwrap();
        backend.watch(root.path()).unwrap();
        let file = root.path().join("external.txt");
        fs::write(&file, "external").unwrap();
        let end = Instant::now() + Duration::from_secs(3);
        let mut found = false;
        while Instant::now() < end {
            let result = backend.execute("poll", json!({})).unwrap();
            if result["changes"]
                .as_array()
                .unwrap()
                .iter()
                .any(|p| p.as_str() == file.to_str())
            {
                found = true;
                break;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        assert!(found);
    }
}
