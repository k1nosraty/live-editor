use crate::security::{Result, Scope};
use globset::{Glob, GlobSet, GlobSetBuilder};
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
};
use walkdir::WalkDir;
#[derive(Serialize)]
pub struct Entry {
    pub path: String,
    pub name: String,
    pub directory: bool,
}
pub fn exclusions(patterns: &str) -> Result<GlobSet> {
    let mut builder = GlobSetBuilder::new();
    for p in patterns.split(',').map(str::trim).filter(|p| !p.is_empty()) {
        builder.add(Glob::new(p).map_err(|e| e.to_string())?);
    }
    builder.build().map_err(|e| e.to_string())
}
pub fn list(scope: &Scope, path: &str, patterns: &str) -> Result<Vec<Entry>> {
    let excluded = exclusions(patterns)?;
    let p = scope.resolve(path)?;
    let mut entries = vec![];
    for item in fs::read_dir(p).map_err(|e| e.to_string())? {
        let item = item.map_err(|e| e.to_string())?;
        let path = item.path();
        if scope.resolve(path.to_string_lossy().as_ref()).is_err() {
            continue;
        }
        let name = item.file_name().to_string_lossy().to_string();
        if name == ".git" || excluded.is_match(&name) {
            continue;
        }
        entries.push(Entry {
            path: path.to_string_lossy().to_string(),
            name,
            directory: path.is_dir(),
        });
    }
    entries.sort_by(|a, b| {
        b.directory
            .cmp(&a.directory)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}
#[derive(Serialize)]
pub struct Hit {
    path: String,
    line: usize,
    text: String,
}
pub fn search(
    scope: &Scope,
    root: &str,
    query: &str,
    filename: bool,
    patterns: &str,
) -> Result<Vec<Hit>> {
    if query.is_empty() {
        return Ok(vec![]);
    }
    let root = scope.resolve(root)?;
    let excluded = exclusions(patterns)?;
    let q = query.to_lowercase();
    let mut hits = vec![];
    for item in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            e.depth() == 0
                || (!excluded.is_match(e.file_name().to_string_lossy().as_ref())
                    && e.file_name() != ".git")
        })
    {
        let item = item.map_err(|e| e.to_string())?;
        if !item.file_type().is_file() {
            continue;
        }
        let path = item.path();
        if item.metadata().map_err(|e| e.to_string())?.len() > 2 * 1024 * 1024 {
            continue;
        }
        if filename {
            if path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_lowercase()
                .contains(&q)
            {
                hits.push(Hit {
                    path: path.to_string_lossy().into(),
                    line: 1,
                    text: path
                        .strip_prefix(&root)
                        .unwrap_or(path)
                        .to_string_lossy()
                        .into(),
                });
            }
        } else if let Ok(text) = fs::read_to_string(path) {
            for (i, line) in text.lines().enumerate() {
                if line.to_lowercase().contains(&q) {
                    hits.push(Hit {
                        path: path.to_string_lossy().into(),
                        line: i + 1,
                        text: line.chars().take(240).collect(),
                    });
                    if hits.len() >= 1000 {
                        return Ok(hits);
                    }
                }
            }
        }
        if hits.len() >= 1000 {
            break;
        }
    }
    Ok(hits)
}
pub fn mutate(scope: &Scope, op: &str, path: &str, target: Option<&str>) -> Result<()> {
    let p = scope.resolve(path)?;
    if scope.roots.contains(&p) {
        return Err("Workspace root cannot be modified".into());
    }
    match op {
        "create_file" => {
            use std::io::Write;
            let mut f = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(p)
                .map_err(|e| e.to_string())?;
            f.write_all(b"").map_err(|e| e.to_string())?
        }
        "create_folder" => fs::create_dir(p).map_err(|e| e.to_string())?,
        "delete" => if p.is_dir() {
            fs::remove_dir_all(p)
        } else {
            fs::remove_file(p)
        }
        .map_err(|e| e.to_string())?,
        "rename" | "move" | "duplicate" => {
            let target = scope.resolve(target.ok_or("Missing destination")?)?;
            if target.exists() {
                return Err("Destination already exists".into());
            }
            if op == "duplicate" {
                if p.is_dir() {
                    return Err(
                        "Duplicate files individually; directory duplication is not supported"
                            .into(),
                    );
                }
                fs::copy(p, target).map_err(|e| e.to_string())?;
            } else {
                fs::rename(p, target).map_err(|e| e.to_string())?;
            }
        }
        _ => return Err("Unknown filesystem operation".into()),
    }
    Ok(())
}
pub fn detect(root: &Path) -> serde_json::Value {
    let manifest = fs::read_to_string(root.join("package.json"))
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok());
    let mut framework = "static";
    let mut dev = false;
    if let Some(m) = manifest {
        let source = m.to_string();
        let script = m
            .pointer("/scripts/dev")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        dev = script.split_whitespace().next() == Some("vite");
        if source.contains("\"vite\"") {
            framework = if source.contains("\"react\"") {
                "React + Vite"
            } else if source.contains("\"vue\"") {
                "Vue + Vite"
            } else {
                "Vanilla Vite"
            };
        }
    }
    let manager = if root.join("pnpm-lock.yaml").exists() {
        "pnpm"
    } else if root.join("yarn.lock").exists() {
        "yarn"
    } else {
        "npm"
    };
    serde_json::json!({"root":root,"name":root.file_name().unwrap_or_default().to_string_lossy(),"framework":framework,"manager":manager,"dev":dev})
}
pub fn approved_root(scope: &Scope, path: &str) -> Result<PathBuf> {
    let p = fs::canonicalize(path).map_err(|e| e.to_string())?;
    if !scope.roots.contains(&p) {
        return Err("Select this workspace through Open Folder first".into());
    }
    Ok(p)
}
