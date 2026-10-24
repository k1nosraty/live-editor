use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs,
    path::{Component, Path, PathBuf},
};
pub type Result<T> = std::result::Result<T, String>;
pub fn digest(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}
pub fn relative(path: &str) -> Result<PathBuf> {
    if path
        .split('/')
        .any(|p| p == "." || p == ".." || p.is_empty())
        || path.is_empty()
        || path.contains(['\0', '\\', ':'])
    {
        return Err("Invalid relative path".into());
    }
    let p = Path::new(path);
    if p.components().any(|c| !matches!(c, Component::Normal(_))) {
        return Err("Path traversal is not allowed".into());
    }
    Ok(p.to_owned())
}
#[derive(Default)]
pub struct Scope {
    pub roots: HashSet<PathBuf>,
    pub files: HashSet<PathBuf>,
}
impl Scope {
    pub fn approve_root(&mut self, path: &Path) -> Result<PathBuf> {
        let p = fs::canonicalize(path).map_err(|e| e.to_string())?;
        if !p.is_dir() {
            return Err("Choose a folder".into());
        }
        self.roots.insert(p.clone());
        Ok(p)
    }
    pub fn approve_file(&mut self, path: &Path) -> Result<PathBuf> {
        let p = canonical_target(path)?;
        self.files.insert(p.clone());
        Ok(p)
    }
    pub fn resolve(&self, path: &str) -> Result<PathBuf> {
        let p = canonical_target(Path::new(path))?;
        if self.files.contains(&p) || self.roots.iter().any(|r| p.starts_with(r)) {
            Ok(p)
        } else {
            Err("Access outside approved workspace denied".into())
        }
    }
    pub fn in_root(&self, root: &Path, path: &str) -> Result<PathBuf> {
        let rel = relative(path)?;
        let p = self.resolve(root.join(rel).to_string_lossy().as_ref())?;
        if !p.starts_with(root) {
            return Err("Symlink escapes workspace".into());
        }
        Ok(p)
    }
}
pub fn canonical_target(path: &Path) -> Result<PathBuf> {
    if path.exists() {
        return fs::canonicalize(path).map_err(|e| e.to_string());
    }
    if fs::symlink_metadata(path).is_ok() {
        return Err("Broken symlink rejected".into());
    }
    let parent = path.parent().ok_or("Missing parent directory")?;
    let parent = fs::canonicalize(parent).map_err(|e| e.to_string())?;
    let name = path.file_name().ok_or("Missing filename")?;
    if name == ".." || name == "." {
        return Err("Invalid filename".into());
    }
    Ok(parent.join(name))
}
pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    use std::io::Write;
    let mut temp = tempfile::NamedTempFile::new_in(path.parent().ok_or("Missing parent")?)
        .map_err(|e| e.to_string())?;
    temp.write_all(bytes).map_err(|e| e.to_string())?;
    if let Ok(meta) = fs::metadata(path) {
        temp.as_file()
            .set_permissions(meta.permissions())
            .map_err(|e| e.to_string())?;
    }
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    temp.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_traversal() {
        for p in [
            "../secret",
            "/etc/passwd",
            "a/../../b",
            "C:/file",
            "a\\b",
            "a/./b",
            "",
        ] {
            assert!(relative(p).is_err(), "{p}");
        }
    }
    #[test]
    fn scope_rejects_outside() {
        let a = tempfile::tempdir().unwrap();
        let b = tempfile::tempdir().unwrap();
        let mut s = Scope::default();
        s.approve_root(a.path()).unwrap();
        assert!(s.resolve(b.path().join("x").to_str().unwrap()).is_err());
        assert!(s.in_root(a.path(), "new.txt").is_ok());
    }
    #[cfg(unix)]
    #[test]
    fn symlink_escape() {
        let a = tempfile::tempdir().unwrap();
        let b = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(b.path(), a.path().join("escape")).unwrap();
        let mut s = Scope::default();
        s.approve_root(a.path()).unwrap();
        assert!(s.in_root(a.path(), "escape/file").is_err());
    }
}
