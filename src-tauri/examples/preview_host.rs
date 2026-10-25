use live_editor_core::preview::PreviewServer;
use std::{
    io::{self, Write},
    path::Path,
};
fn main() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("examples/html-css-js");
    let server = PreviewServer::start(root.canonicalize().unwrap()).unwrap();
    if let Ok(bridge) = std::env::var("RENDERIFT_TEST_BRIDGE") {
        server.data.lock().unwrap().bridge = bridge;
    }
    println!("{}", server.url);
    io::stdout().flush().unwrap();
    let mut line = String::new();
    let _ = io::stdin().read_line(&mut line);
}
