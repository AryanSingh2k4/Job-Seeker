//! JobSeeker — Tauri 2 desktop shell (Week 0 / D0 scaffold).
//!
//! Boot sequence per DESKTOP_PACKAGING_SPEC.md §3.1:
//!   1. splash window is visible immediately (tauri.conf.json),
//!   2. spawn the sidecar (stub in D0; real `autojob-core.exe` from D1),
//!   3. read the one-line `AUTOJOB_READY {json}` stdout handshake,
//!   4. show the main window (loads the Next.js export), close the splash,
//!   5. the frontend fetches port+token via the `get_bootstrap` IPC command.
//!
//! D1 hardening (tracked in docs/STATUS.md): async spawn with the 20 s
//! timeout + retry screen, supervision/restart, parent-pid watchdog,
//! single-instance guard, locked CSP (dynamic-port decision), crash dialogs.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
struct Bootstrap {
    port: u16,
    token: String,
    pid: u32,
    version: String,
}

struct SidecarState {
    bootstrap: Mutex<Option<Bootstrap>>,
}

/// The spawned sidecar process, kept in a global so the RunEvent::Exit hook
/// can kill it (no orphaned backends — DESKTOP_PACKAGING_SPEC.md §3.3).
static SIDECAR_CHILD: Mutex<Option<Child>> = Mutex::new(None);

#[tauri::command]
fn get_bootstrap(state: tauri::State<SidecarState>) -> Result<Bootstrap, String> {
    state
        .bootstrap
        .lock()
        .expect("sidecar state poisoned")
        .clone()
        .ok_or_else(|| "sidecar not ready".to_string())
}

fn kill_sidecar() {
    if let Ok(mut guard) = SIDECAR_CHILD.lock() {
        if let Some(child) = guard.as_mut() {
            let _ = child.kill();
            let _ = child.wait();
        }
        *guard = None;
    }
}

/// Resolve the sidecar binary: `JOBSEEKER_SIDECAR_PATH` env override first,
/// then the sibling `autojob-core-stub(.exe)` built alongside this app.
fn sidecar_path() -> Option<std::path::PathBuf> {
    if let Ok(p) = std::env::var("JOBSEEKER_SIDECAR_PATH") {
        let path = std::path::PathBuf::from(p);
        if path.exists() {
            return Some(path);
        }
    }
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    let name = if cfg!(windows) { "autojob-core-stub.exe" } else { "autojob-core-stub" };
    let path = dir.join(name);
    path.exists().then_some(path)
}

/// Spawn the sidecar and read the `AUTOJOB_READY {json}` handshake line.
/// D0 note: blocking read is acceptable for the stub; the real sidecar gets
/// an async spawn with the 20 s timeout + retry screen (D1).
fn spawn_sidecar() -> Result<Bootstrap, String> {
    let path = sidecar_path().ok_or("sidecar binary not found (build the workspace: cargo build)")?;
    let mut child = Command::new(&path)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("failed to spawn {}: {e}", path.display()))?;

    let stdout = child.stdout.take().ok_or("sidecar stdout unavailable")?;
    let mut reader = BufReader::new(stdout);
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .map_err(|e| format!("sidecar handshake read failed: {e}"))?;

    let payload = line
        .trim()
        .strip_prefix("AUTOJOB_READY ")
        .ok_or_else(|| format!("unexpected sidecar handshake: {line:.80}"))?;
    let bootstrap: Bootstrap =
        serde_json::from_str(payload).map_err(|e| format!("handshake JSON invalid: {e}"))?;

    *SIDECAR_CHILD.lock().expect("sidecar child poisoned") = Some(child);
    Ok(bootstrap)
}

fn main() {
    let sidecar = spawn_sidecar();
    let boot_value = sidecar.clone().ok();

    let app = tauri::Builder::default()
        .manage(SidecarState {
            bootstrap: Mutex::new(boot_value),
        })
        .setup(move |app| {
            if sidecar.is_err() {
                eprintln!(
                    "[jobseeker] sidecar failed: {:?} — showing main window anyway (D1 adds the retry screen)",
                    sidecar.as_ref().err()
                );
            }
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.show();
                let _ = main.set_focus();
            }
            if let Some(splash) = app.get_webview_window("splash") {
                let _ = splash.close();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_bootstrap])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            kill_sidecar();
        }
    });
}
