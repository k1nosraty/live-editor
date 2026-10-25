use crate::{
    security::{self, Result},
    workspace,
};
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use std::{
    collections::{BTreeMap, VecDeque},
    fs,
    io::{BufRead, BufReader, Read, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};
#[derive(serde::Deserialize)]
pub struct Buffer {
    pub path: String,
    pub text: String,
}
fn vite_path(path: &Path) -> String {
    let path = path.to_string_lossy().replace('\\', "/");
    let path = path.strip_prefix("//?/").unwrap_or(&path);
    if let Some(unc) = path.strip_prefix("UNC/") {
        format!("//{unc}")
    } else {
        path.into()
    }
}
fn snapshot(root: &Path, buffers: &[Buffer]) -> Result<Vec<u8>> {
    let mut files = BTreeMap::new();
    let mut size = 0;
    if buffers.len() > 1000 {
        return Err("Too many preview buffers".into());
    }
    for buffer in buffers {
        let path = security::canonical_target(Path::new(&buffer.path))?;
        if !path.starts_with(root) {
            return Err("Live preview buffer escapes workspace".into());
        }
        size += buffer.text.len();
        if buffer.text.len() > 8 * 1024 * 1024 || size > 32 * 1024 * 1024 {
            return Err("Live preview buffers exceed size limit".into());
        }
        let path = vite_path(&path);
        let path = if path.as_bytes().get(1) == Some(&b':') {
            format!("{}{}", path[..1].to_ascii_lowercase(), &path[1..])
        } else {
            path
        };
        files.insert(path, &buffer.text);
    }
    serde_json::to_vec(&files).map_err(|error| error.to_string())
}
pub struct Runtime {
    stopped: bool,
    child: Child,
    pub logs: Arc<Mutex<VecDeque<String>>>,
    pub root: PathBuf,
    state: tempfile::TempDir,
    #[cfg(windows)]
    job: isize,
}
impl Runtime {
    pub fn start(root: &Path) -> Result<Self> {
        Self::start_with_buffers(root, &[])
    }
    pub fn start_with_buffers(root: &Path, buffers: &[Buffer]) -> Result<Self> {
        let root = fs::canonicalize(root).map_err(|error| error.to_string())?;
        let root = root.as_path();
        let project = workspace::detect(root);
        if project["dev"] != true {
            return Err("Only projects with a vite dev script are supported. Configure scripts.dev as vite.".into());
        }
        if project["dependenciesInstalled"] != true {
            return Err(format!(
                "Project dependencies are missing. Run {} in {} and start Vite again.",
                project["installCommand"].as_str().unwrap_or("npm install"),
                root.display()
            ));
        }
        // Vite uses strictPort; report conflicts before showing an unrelated server.
        drop(TcpListener::bind("127.0.0.1:5173").map_err(|_| {
            "Port 5173 is already in use. Stop that server before starting this project."
                .to_string()
        })?);
        let state = tempfile::tempdir().map_err(|error| error.to_string())?;
        let overlay = state.path().join("buffers.json");
        fs::write(&overlay, snapshot(root, buffers)?).map_err(|error| error.to_string())?;
        let config = state.path().join("live-editor-vite.mjs");
        let source = format!(
            "const projectRoot={};\nconst overlayFile={};\n{}",
            serde_json::to_string(&vite_path(root)).unwrap(),
            serde_json::to_string(&vite_path(&overlay)).unwrap(),
            include_str!("live_preview.mjs")
        );
        fs::write(&config, source).map_err(|error| error.to_string())?;
        let manager = project["manager"].as_str().unwrap_or("npm");
        #[cfg(windows)]
        let executable = format!("{manager}.cmd");
        #[cfg(not(windows))]
        let executable = manager.to_string();
        let mut command = Command::new(executable);
        command
            .current_dir(root)
            .args([
                "run",
                "dev",
                "--",
                "--host",
                "127.0.0.1",
                "--port",
                "5173",
                "--strictPort",
            ])
            .arg("--config")
            .arg(&config)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(unix)]
        command.process_group(0);
        let mut child=command.spawn().map_err(|e|format!("Cannot start {manager}. Install Node.js LTS and {manager}, then install this project's dependencies explicitly. {e}"))?;
        #[cfg(windows)]
        let job = unsafe {
            use windows_sys::Win32::System::{JobObjects::*, Threading::*};
            let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if job.is_null() {
                let _ = child.kill();
                return Err("Cannot create process cleanup job".into());
            }
            let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &limits as *const _ as _,
                std::mem::size_of_val(&limits) as u32,
            ) == 0
            {
                windows_sys::Win32::Foundation::CloseHandle(job);
                let _ = child.kill();
                return Err("Cannot configure process cleanup".into());
            }
            let process = OpenProcess(
                PROCESS_SET_QUOTA | PROCESS_TERMINATE,
                false as i32,
                child.id(),
            );
            let assigned = AssignProcessToJobObject(job, process);
            windows_sys::Win32::Foundation::CloseHandle(process);
            if assigned == 0 {
                windows_sys::Win32::Foundation::CloseHandle(job);
                let _ = child.kill();
                return Err("Cannot assign development server to cleanup job".into());
            }
            job as isize
        };
        let logs = Arc::new(Mutex::new(VecDeque::new()));
        if let Some(out) = child.stdout.take() {
            let log = logs.clone();
            thread::spawn(move || capture(BufReader::new(out), log));
        }
        if let Some(err) = child.stderr.take() {
            let log = logs.clone();
            thread::spawn(move || capture(BufReader::new(err), log));
        }
        let mut runtime = Self {
            stopped: false,
            child,
            logs,
            root: root.to_owned(),
            state,
            #[cfg(windows)]
            job,
        };
        runtime.wait_until_ready()?;
        Ok(runtime)
    }
    pub fn update(&self, buffers: &[Buffer]) -> Result<()> {
        let bytes = snapshot(&self.root, buffers)?;
        security::atomic_write(&self.state.path().join("buffers.json"), &bytes)
    }
    fn wait_until_ready(&mut self) -> Result<()> {
        let deadline = Instant::now() + Duration::from_secs(30);
        while Instant::now() < deadline {
            if !self.running() {
                return Err(self.start_error("Vite exited before the preview was ready"));
            }
            if let Ok(mut socket) = TcpStream::connect_timeout(
                &"127.0.0.1:5173".parse().unwrap(),
                Duration::from_millis(100),
            ) {
                socket
                    .set_read_timeout(Some(Duration::from_millis(500)))
                    .ok();
                socket
                    .set_write_timeout(Some(Duration::from_millis(500)))
                    .ok();
                if socket
                    .write_all(b"GET / HTTP/1.0\r\nHost: 127.0.0.1:5173\r\n\r\n")
                    .is_ok()
                {
                    let mut response = [0; 64];
                    if let Ok(count) = socket.read(&mut response) {
                        let status = String::from_utf8_lossy(&response[..count]);
                        if status.starts_with("HTTP/1.1 200") || status.starts_with("HTTP/1.0 200")
                        {
                            return Ok(());
                        }
                    }
                }
            }
            thread::sleep(Duration::from_millis(100));
        }
        Err(self.start_error("Vite did not become ready within 30 seconds"))
    }
    fn start_error(&self, message: &str) -> String {
        let logs = self
            .logs
            .lock()
            .map(|lines| lines.iter().cloned().collect::<Vec<_>>().join("\n"))
            .unwrap_or_default();
        format!("{message}. Check Node.js, project dependencies, and vite.config.\n{logs}")
    }
    pub fn running(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }
    pub fn stop(&mut self) {
        if self.stopped {
            return;
        }
        self.stopped = true;
        #[cfg(windows)]
        unsafe {
            if self.job != 0 {
                windows_sys::Win32::Foundation::CloseHandle(self.job as _);
                self.job = 0;
            }
        }
        #[cfg(unix)]
        {
            let _ = Command::new("kill")
                .args(["-TERM", "--", &format!("-{}", self.child.id())])
                .status();
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
fn capture<R: BufRead>(reader: R, logs: Arc<Mutex<VecDeque<String>>>) {
    for line in reader.lines().map_while(std::result::Result::ok) {
        if let Ok(mut lines) = logs.lock() {
            lines.push_back(line.chars().take(16000).collect());
            while lines.len() > 1000 {
                lines.pop_front();
            }
        }
    }
}
impl Drop for Runtime {
    fn drop(&mut self) {
        self.stop()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn buffer_snapshot_is_virtual_and_rejects_workspace_escape() {
        let root = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(root.path()).unwrap();
        let file = root.join("main.jsx");
        fs::write(&file, "disk source").unwrap();
        let buffers = [Buffer {
            path: file.to_string_lossy().into(),
            text: "unsaved source".into(),
        }];
        let state: BTreeMap<String, String> =
            serde_json::from_slice(&snapshot(&root, &buffers).unwrap()).unwrap();
        assert_eq!(state.values().next().unwrap(), "unsaved source");
        assert_eq!(fs::read_to_string(&file).unwrap(), "disk source");
        let outside = tempfile::NamedTempFile::new().unwrap();
        assert!(snapshot(
            &root,
            &[Buffer {
                path: outside.path().to_string_lossy().into(),
                text: "outside".into()
            }]
        )
        .is_err());
        assert_eq!(
            vite_path(Path::new(r"\\?\C:\project\src\App.tsx")),
            "C:/project/src/App.tsx"
        );
    }
    #[test]
    fn missing_dependencies_report_install_command_without_launching() {
        let root = tempfile::tempdir().unwrap();
        std::fs::write(
            root.path().join("package.json"),
            r#"{"scripts":{"dev":"vite"},"devDependencies":{"vite":"*"}}"#,
        )
        .unwrap();
        std::fs::write(root.path().join("package-lock.json"), "{}").unwrap();
        let error = Runtime::start(root.path()).err().expect("must not start");
        assert!(error.contains("npm ci"), "{error}");
        assert!(error.contains("dependencies are missing"), "{error}");
    }
    #[test]
    #[ignore = "Install both example dependencies and provide Node.js/npm first"]
    fn modern_vite_workflows() {
        for example in ["react-vite", "vue-vite"] {
            let root = Path::new(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .unwrap()
                .join("examples")
                .join(example);
            let mut runtime = Runtime::start(&root).unwrap();
            // start() must wait for HTTP readiness before the iframe is navigated.
            assert!(TcpStream::connect("127.0.0.1:5173").is_ok());
            let deadline = Instant::now() + Duration::from_secs(25);
            let mut ready = false;
            while Instant::now() < deadline {
                assert!(
                    runtime.running(),
                    "Vite exited: {:?}",
                    runtime.logs.lock().unwrap()
                );
                if let Ok(mut socket) = TcpStream::connect("127.0.0.1:5173") {
                    socket
                        .set_read_timeout(Some(Duration::from_secs(2)))
                        .unwrap();
                    socket
                        .write_all(b"GET / HTTP/1.0\r\nHost: 127.0.0.1:5173\r\n\r\n")
                        .unwrap();
                    let mut response = String::new();
                    if socket.read_to_string(&mut response).is_ok() && response.contains("200 OK") {
                        ready = true;
                        break;
                    }
                }
                thread::sleep(Duration::from_millis(100));
            }
            assert!(ready, "Vite did not serve {example}");
            runtime.stop();
            assert!(!runtime.running());
            thread::sleep(Duration::from_millis(200));
        }
    }
}
