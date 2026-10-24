use crate::security::{relative, Result};
use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use tiny_http::{Header, Response, Server, StatusCode};
#[derive(Default)]
pub struct PreviewData {
    pub root: PathBuf,
    pub overlays: HashMap<String, String>,
    pub bridge: String,
}
pub struct PreviewServer {
    pub url: String,
    pub data: Arc<Mutex<PreviewData>>,
    stop: Arc<AtomicBool>,
    thread: Option<thread::JoinHandle<()>>,
}
pub fn inject_bridge(html: &str, bridge: &str) -> String {
    if bridge.is_empty() {
        return html.into();
    }
    let lower = html.to_ascii_lowercase();
    let at = lower
        .find("<head")
        .and_then(|start| html[start..].find('>').map(|end| start + end + 1))
        .or_else(|| {
            lower
                .find("<!doctype")
                .and_then(|start| html[start..].find('>').map(|end| start + end + 1))
        })
        .unwrap_or(0);
    format!("{}<script>{}</script>{}", &html[..at], bridge, &html[at..])
}
impl PreviewServer {
    pub fn start(root: PathBuf) -> Result<Self> {
        let server = Server::http("127.0.0.1:0").map_err(|e| e.to_string())?;
        let addr = server
            .server_addr()
            .to_ip()
            .ok_or("Invalid preview address")?;
        let token = hex::encode(rand::random::<[u8; 32]>());
        let url = format!("http://127.0.0.1:{}/{}", addr.port(), token);
        let host = addr.to_string();
        let data = Arc::new(Mutex::new(PreviewData {
            root,
            ..Default::default()
        }));
        let stop = Arc::new(AtomicBool::new(false));
        let shared = data.clone();
        let stopping = stop.clone();
        let thread = thread::spawn(move || {
            while !stopping.load(Ordering::Relaxed) {
                let request = match server.recv_timeout(Duration::from_millis(100)) {
                    Ok(Some(r)) => r,
                    _ => continue,
                };
                let valid_host = request
                    .headers()
                    .iter()
                    .any(|h| h.field.equiv("Host") && h.value.as_str() == host);
                let path = request.url().split('?').next().unwrap_or("");
                let prefix = format!("/{token}/");
                let response = (|| -> Result<(Vec<u8>, String)> {
                    if !valid_host || request.method().as_str() != "GET" {
                        return Err("Denied".into());
                    }
                    let encoded = path.strip_prefix(&prefix).ok_or("Invalid preview token")?;
                    let decoded = percent_encoding::percent_decode_str(encoded)
                        .decode_utf8()
                        .map_err(|_| "Invalid URL")?;
                    let decoded = if decoded.is_empty() {
                        "index.html"
                    } else {
                        decoded.as_ref()
                    };
                    let rel = relative(decoded)?;
                    if rel
                        .components()
                        .any(|c| c.as_os_str().to_string_lossy().starts_with('.'))
                    {
                        return Err("Hidden files are not served".into());
                    }
                    let d = match shared.lock() {
                        Ok(d) => d,
                        Err(_) => return Err("Preview unavailable".into()),
                    };
                    let mut file = d.root.join(&rel);
                    if file.is_dir() {
                        file = file.join("index.html")
                    }
                    let canonical = fs::canonicalize(&file).map_err(|e| e.to_string())?;
                    if !canonical.starts_with(&d.root) {
                        return Err("Symlink escape denied".into());
                    }
                    let relative = canonical
                        .strip_prefix(&d.root)
                        .map_err(|e| e.to_string())?
                        .to_string_lossy()
                        .replace('\\', "/");
                    let mut bytes = if let Some(text) = d.overlays.get(&relative) {
                        text.as_bytes().to_vec()
                    } else {
                        if fs::metadata(&canonical).map_err(|e| e.to_string())?.len()
                            > 32 * 1024 * 1024
                        {
                            return Err("Asset exceeds 32 MiB".into());
                        }
                        fs::read(&canonical).map_err(|e| e.to_string())?
                    };
                    let mime = mime_guess::from_path(&canonical)
                        .first_or_octet_stream()
                        .to_string();
                    if mime == "text/html" {
                        let html = String::from_utf8_lossy(&bytes);
                        bytes = inject_bridge(&html, &d.bridge).into_bytes();
                    }
                    Ok((bytes, mime))
                })();
                let (status, bytes, mime) = match response {
                    Ok((b, m)) => (200, b, m),
                    Err(e) => (404, e.into_bytes(), "text/plain".into()),
                };
                let mut response = Response::from_data(bytes).with_status_code(StatusCode(status));
                for(name,value)in[("Content-Type",mime.as_str()),("Cache-Control","no-store"),("Access-Control-Allow-Origin","null"),("X-Content-Type-Options","nosniff"),("Content-Security-Policy","default-src 'self' data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src 'self'; frame-ancestors *; object-src 'none'")]{if let Ok(h)=Header::from_bytes(name,value){response.add_header(h)}}
                let _ = request.respond(response);
            }
        });
        Ok(Self {
            url,
            data,
            stop,
            thread: Some(thread),
        })
    }
}
impl Drop for PreviewServer {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpStream,
    };
    fn request(url: &str, path: &str) -> String {
        let parts = url.strip_prefix("http://").unwrap();
        let host = parts.split('/').next().unwrap();
        let mut stream = TcpStream::connect(host).unwrap();
        stream
            .write_all(format!("GET {path} HTTP/1.0\r\nHost: {host}\r\n\r\n").as_bytes())
            .unwrap();
        let mut output = String::new();
        stream.read_to_string(&mut output).unwrap();
        output
    }
    #[test]
    fn bridge_preserves_doctype() {
        let html = inject_bridge(
            "<!doctype html><html><head></head><body>Hello</body></html>",
            "console.log('ready')",
        );
        assert!(html.starts_with("<!doctype html>"));
        assert!(html.contains("<head><script>console.log('ready')</script>"));
    }
    #[test]
    fn serves_overlays_and_rejects_unapproved_requests() {
        let t = tempfile::tempdir().unwrap();
        fs::write(t.path().join("index.html"), "disk").unwrap();
        let s = PreviewServer::start(t.path().to_owned()).unwrap();
        s.data
            .lock()
            .unwrap()
            .overlays
            .insert("index.html".into(), "unsaved".into());
        let token = s.url.split('/').next_back().unwrap();
        assert!(request(&s.url, &format!("/{token}/index.html")).contains("unsaved"));
        assert!(request(&s.url, "/index.html").contains("404"));
        assert!(request(&s.url, &format!("/{token}/%2e%2e/secret")).contains("404"));
    }
}
