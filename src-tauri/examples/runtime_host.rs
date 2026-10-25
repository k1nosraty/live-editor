use live_editor_core::{processes::Runtime, workspace};
use std::{
    io::{self, Write},
    path::PathBuf,
};

fn main() {
    let root = PathBuf::from(std::env::args_os().nth(1).expect("project folder required"));
    let _runtime = Runtime::start(&root).expect("Vite preview must become ready");
    println!(
        "{}",
        serde_json::json!({"url":"http://127.0.0.1:5173","workspace":workspace::detect(&root)})
    );
    io::stdout().flush().unwrap();
    let mut line = String::new();
    let _ = io::stdin().read_line(&mut line);
}
