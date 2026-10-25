use crate::security::{atomic_write, digest, Result, Scope};
use serde::Serialize;
use std::fs;
const MAX_TEXT: u64 = 8 * 1024 * 1024;
#[derive(Debug, Serialize)]
pub struct Document {
    pub text: String,
    pub revision: String,
}
pub fn read(scope: &Scope, path: &str) -> Result<Document> {
    let p = scope.resolve(path)?;
    if fs::metadata(&p).map_err(|e| e.to_string())?.len() > MAX_TEXT {
        return Err("File exceeds 8 MiB editing limit".into());
    }
    let bytes = fs::read(p).map_err(|e| e.to_string())?;
    let revision = digest(&bytes);
    let text = String::from_utf8(bytes).map_err(|_| "Only UTF-8 text files can be edited")?;
    Ok(Document { text, revision })
}
pub fn save(scope: &Scope, path: &str, text: &str, revision: Option<&str>) -> Result<Document> {
    let p = scope.resolve(path)?;
    if text.len() as u64 > MAX_TEXT {
        return Err("Document exceeds 8 MiB".into());
    }
    if p.exists() {
        let disk = fs::read(&p).map_err(|e| e.to_string())?;
        if revision != Some(digest(&disk).as_str()) {
            return Err(
                "CONFLICT: File changed on disk. Reload or Save As; no data was overwritten."
                    .into(),
            );
        }
    } else if revision.is_some() {
        return Err("CONFLICT: File was removed on disk. Use Save As.".into());
    }
    atomic_write(&p, text.as_bytes())?;
    Ok(Document {
        text: text.into(),
        revision: digest(text.as_bytes()),
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn saves_and_detects_conflict() {
        let t = tempfile::tempdir().unwrap();
        let mut s = Scope::default();
        s.approve_root(t.path()).unwrap();
        let p = t.path().join("test.txt");
        let p = p.to_str().unwrap();
        let d = save(&s, p, "سلام", None).unwrap();
        assert_eq!(read(&s, p).unwrap().text, "سلام");
        fs::write(p, "external").unwrap();
        assert!(save(&s, p, "unsaved", Some(&d.revision))
            .unwrap_err()
            .starts_with("CONFLICT"));
        assert_eq!(fs::read_to_string(p).unwrap(), "external");
    }
}
