use live_editor_core::{processes::Runtime, workspace};
use std::{
    io::{self, BufRead, Write},
    path::PathBuf,
};

fn main() {
    let root = PathBuf::from(std::env::args_os().nth(1).expect("project folder required"));
    let initial: Vec<live_editor_core::processes::Buffer> =
        std::env::var("LIVE_EDITOR_INITIAL_BUFFERS")
            .ok()
            .map(|value| serde_json::from_str(&value).unwrap())
            .unwrap_or_default();
    let runtime =
        Runtime::start_with_buffers(&root, &initial).expect("Vite preview must become ready");
    println!(
        "{}",
        serde_json::json!({"url":"http://127.0.0.1:5173","workspace":workspace::detect(&root)})
    );
    io::stdout().flush().unwrap();
    for line in io::stdin().lock().lines() {
        let line = line.unwrap();
        if line.is_empty() {
            break;
        }
        let buffers: Vec<live_editor_core::processes::Buffer> =
            serde_json::from_str(&line).unwrap();
        runtime
            .update(&buffers)
            .expect("buffer update must succeed");
        println!("{}", serde_json::json!({"updated":true}));
        io::stdout().flush().unwrap();
    }
}
