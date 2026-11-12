//! Week-0 stub sidecar — emulates the real Python sidecar's contract
//! (DESKTOP_PACKAGING_SPEC.md §4) without Python:
//!   * prints one line on stdout:  AUTOJOB_READY {"port":..,"token":..,"pid":..,"version":..}
//!   * port 8000 → the shell's UI can talk to a real dev backend on :8000 if
//!     one is running (Gemini's M0); otherwise API calls fail gracefully.
//!   * sleeps forever; killed by the shell on exit.
//!
//! D1 replaces this with the real PyInstaller `autojob-core.exe`, which
//! generates a fresh random token per launch and accepts --port 0.

use std::io::Write;
use std::thread;
use std::time::Duration;

fn main() {
    let handshake = format!(
        "AUTOJOB_READY {{\"port\":8000,\"token\":\"stub-token-week0-not-a-secret\",\"pid\":{},\"version\":\"0.1.0-stub\"}}",
        std::process::id()
    );
    println!("{handshake}");
    let _ = std::io::stdout().flush();

    loop {
        thread::sleep(Duration::from_secs(60));
    }
}
