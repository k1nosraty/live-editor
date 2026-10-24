use crate::security::Result;

/// Adds a main-frame secret because Linux webview capability checks alone cannot
/// distinguish an untrusted iframe from the containing application window.
pub struct NativeGate {
    token: String,
}
impl Default for NativeGate {
    fn default() -> Self {
        Self {
            token: hex::encode(rand::random::<[u8; 32]>()),
        }
    }
}
impl NativeGate {
    pub fn authorize(&self, token: &str) -> Result<()> {
        if token.len() != self.token.len()
            || !token
                .bytes()
                .zip(self.token.bytes())
                .fold(true, |same, (a, b)| same & (a == b))
        {
            return Err("Native access denied: application authentication required".into());
        }
        Ok(())
    }
    pub fn initialization_script(&self) -> String {
        format!("if(window===window.top && ((location.protocol==='tauri:' && location.hostname==='localhost') || ['http://tauri.localhost','https://tauri.localhost','http://127.0.0.1:1420'].includes(location.origin))){{Object.defineProperty(window,'__RENDERIFT_NATIVE_TOKEN__',{{value:{},writable:false,configurable:false}});}}",serde_json::to_string(&self.token).expect("string serialization"))
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_missing_and_forged_credentials() {
        let gate = NativeGate::default();
        assert!(gate.authorize("").is_err());
        assert!(gate.authorize(&"0".repeat(64)).is_err());
        assert!(gate.authorize(&gate.token).is_ok());
        let script = gate.initialization_script();
        assert!(script.contains("window===window.top"));
        assert!(script.contains("location.origin"));
    }
    #[test]
    fn secret_changes_each_launch() {
        assert_ne!(NativeGate::default().token, NativeGate::default().token);
    }
}
