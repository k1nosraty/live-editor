use crate::security::{relative, Result};
use serde::Serialize;
use std::{path::Path, process::Command};
fn run(root: &Path, args: &[&str]) -> Result<String> {
    let out = Command::new("git")
        .current_dir(root)
        .args([
            "-c",
            if cfg!(windows) {
                "core.hooksPath=NUL"
            } else {
                "core.hooksPath=/dev/null"
            },
            "-c",
            "protocol.ext.allow=never",
            "-c",
            "core.fsmonitor=false",
            "-c",
            "core.pager=cat",
        ])
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|e| format!("Git could not start. Install Git and restart Renderift: {e}"))?;
    if !out.status.success() && !(args.contains(&"--no-index") && out.status.code() == Some(1)) {
        return Err(String::from_utf8_lossy(&out.stderr).trim().into());
    }
    if out.stdout.len() > 4 * 1024 * 1024 {
        return Err("Git output exceeds 4 MiB limit".into());
    }
    Ok(String::from_utf8_lossy(&out.stdout).into())
}
#[derive(Serialize)]
pub struct GitFile {
    path: String,
    index: String,
    worktree: String,
}
#[derive(Serialize)]
pub struct GitStatus {
    branch: String,
    files: Vec<GitFile>,
}
pub fn status(root: &Path) -> Result<GitStatus> {
    let output = run(
        root,
        &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    )?;
    let mut items = output.split('\0');
    let mut files = vec![];
    while let Some(item) = items.next() {
        if item.len() < 4 {
            continue;
        }
        let bytes = item.as_bytes();
        let index = (bytes[0] as char).to_string();
        let worktree = (bytes[1] as char).to_string();
        let path = item[3..].into();
        if index == "R" || index == "C" {
            items.next();
        }
        files.push(GitFile {
            path,
            index,
            worktree,
        });
    }
    let branch = run(root, &["branch", "--show-current"])?;
    Ok(GitStatus {
        branch: branch.trim().into(),
        files,
    })
}
pub fn operation(root: &Path, op: &str, path: Option<&str>, value: Option<&str>) -> Result<String> {
    match op {
        "init" => run(root, &["init"]),
        "history" => run(root, &["log", "-30", "--format=%h %s (%an)"]),
        "branches" => run(root, &["branch", "--format=%(refname:short)"]),
        "fetch" => run(root, &["fetch"]),
        "pull" => run(root, &["pull", "--ff-only"]),
        "push" => run(root, &["push"]),
        "commit" => {
            let message = value.ok_or("Write a commit message")?;
            if message.trim().is_empty() || message.len() > 2000 {
                return Err("Commit message must be 1–2000 characters".into());
            }
            run(root, &["commit", "-m", message])
        }
        "create_branch" | "switch_branch" => {
            let name = value.ok_or("Missing branch name")?;
            if name.starts_with('-') || name.contains(['\0', '\n']) {
                return Err("Invalid branch name".into());
            }
            run(root, &["check-ref-format", "--branch", name])?;
            if op == "switch_branch" && !status(root)?.files.is_empty() {
                return Err("Commit or safely save local changes before switching branches".into());
            }
            if op == "create_branch" {
                run(root, &["switch", "-c", name])
            } else {
                run(root, &["switch", name])
            }
        }
        "stage" | "unstage" | "discard" | "diff" | "staged_diff" => {
            let path = path.ok_or("Choose a file")?;
            relative(path)?;
            match op {
                "stage" => run(root, &["add", "--", path]),
                "unstage" => run(root, &["restore", "--staged", "--", path]),
                "discard" => run(root, &["restore", "--worktree", "--", path]),
                "diff"
                    if status(root)?
                        .files
                        .iter()
                        .any(|file| file.path == path && file.index == "?") =>
                {
                    run(
                        root,
                        &[
                            "diff",
                            "--no-index",
                            "--no-ext-diff",
                            "--no-textconv",
                            "--",
                            if cfg!(windows) { "NUL" } else { "/dev/null" },
                            path,
                        ],
                    )
                }
                "diff" => run(
                    root,
                    &["diff", "--no-ext-diff", "--no-textconv", "--", path],
                ),
                _ => run(
                    root,
                    &[
                        "diff",
                        "--cached",
                        "--no-ext-diff",
                        "--no-textconv",
                        "--",
                        path,
                    ],
                ),
            }
        }
        _ => Err("Unsupported Git operation".into()),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stage_commit_and_protect_branch() {
        let t = tempfile::tempdir().unwrap();
        operation(t.path(), "init", None, None).unwrap();
        run(t.path(), &["config", "user.email", "test@example.invalid"]).unwrap();
        run(t.path(), &["config", "user.name", "Renderift Test"]).unwrap();
        std::fs::write(t.path().join("hello.txt"), "first").unwrap();
        assert!(operation(t.path(), "diff", Some("hello.txt"), None)
            .unwrap()
            .contains("+first"));
        operation(t.path(), "stage", Some("hello.txt"), None).unwrap();
        assert_eq!(status(t.path()).unwrap().files[0].index, "A");
        operation(t.path(), "commit", None, Some("Initial")).unwrap();
        assert!(status(t.path()).unwrap().files.is_empty());
        std::fs::write(t.path().join("hello.txt"), "second").unwrap();
        assert!(operation(t.path(), "switch_branch", None, Some("main")).is_err());
        assert!(operation(t.path(), "stage", Some("../escape"), None).is_err());
    }
}
