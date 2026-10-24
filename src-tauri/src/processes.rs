use crate::{security::Result, workspace};
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use std::{
    collections::VecDeque,
    io::{BufRead, BufReader},
    path::Path,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
};
pub struct Runtime {
    stopped: bool,
    child: Child,
    pub logs: Arc<Mutex<VecDeque<String>>>,
    #[cfg(windows)]
    job: isize,
}
impl Runtime {
    pub fn start(root: &Path) -> Result<Self> {
        let project = workspace::detect(root);
        if project["dev"] != true {
            return Err("Only projects with a vite dev script are supported. Configure scripts.dev as vite.".into());
        }
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
        Ok(Self {
            stopped: false,
            child,
            logs,
            #[cfg(windows)]
            job,
        })
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
    use std::{
        io::{Read, Write},
        net::TcpStream,
        time::{Duration, Instant},
    };
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
