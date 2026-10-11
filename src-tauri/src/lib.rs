use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::Manager;

const CORE_ADDR: &str = "127.0.0.1:4100";
const LIVE_CORE_URL: &str = "https://mevarbtech.netlify.app/engine";

fn core_url() -> String {
    if let Ok(url) = std::env::var("MEV_CORE_URL") {
        return url;
    }
    if cfg!(debug_assertions) {
        format!("http://{CORE_ADDR}/")
    } else {
        LIVE_CORE_URL.to_string()
    }
}

fn uses_local_core() -> bool {
    let url = core_url();
    url.contains("127.0.0.1") || url.contains("localhost")
}

fn project_root() -> PathBuf {
    std::env::var("MEV_CORE_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(".."))
}

fn core_is_up() -> bool {
    let Ok(addr) = CORE_ADDR.parse::<SocketAddr>() else {
        return false;
    };
    TcpStream::connect_timeout(&addr, Duration::from_millis(400)).is_ok()
}

fn spawn_core() -> Option<Child> {
    let root = project_root();
    Command::new("node")
        .arg(root.join("scripts").join("core-standalone.mjs"))
        .current_dir(&root)
        .env("CORE_PORT", "4100")
        .env(
            "MAIN_APP_URL",
            std::env::var("MAIN_APP_URL").unwrap_or_else(|_| "http://127.0.0.1:3000".to_string()),
        )
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .ok()
}

fn ensure_core() -> Option<Child> {
    // `tauri dev` sudah menjalankan desktop:serve. Installer rilis membuka webapp live,
    // bukan Node lokal — tanpa itu jendela hanya menampilkan "Webapp utama belum berjalan di port 3000."
    if cfg!(debug_assertions) || !uses_local_core() || core_is_up() {
        return None;
    }
    let child = spawn_core();
    for _ in 0..60 {
        if core_is_up() {
            break;
        }
        std::thread::sleep(Duration::from_millis(500));
    }
    child
}

fn stop_core(core: &Arc<Mutex<Option<Child>>>) {
    if let Ok(mut guard) = core.lock() {
        if let Some(child) = guard.as_mut() {
            let _ = child.kill();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let core = Arc::new(Mutex::new(ensure_core()));
    let core_for_exit = Arc::clone(&core);

    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(url) = core_url().parse() {
                    let _ = window.navigate(url);
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("MEV Core Engine window failed to start")
        .run(move |_app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                stop_core(&core_for_exit);
            }
        });
}
