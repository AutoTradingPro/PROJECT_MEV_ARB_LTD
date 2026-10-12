use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Manager};

const CORE_HOST: &str = "127.0.0.1";
const CORE_PORT: u16 = 4100;
const LIVE_PORT: u16 = 4101;

fn is_local_app_url(url: &str) -> bool {
    let value = url.trim().to_ascii_lowercase();
    value.starts_with("http://localhost:")
        || value.starts_with("http://127.0.0.1:")
        || value.starts_with("http://[::1]:")
}

fn core_http_url() -> String {
    if let Ok(url) = std::env::var("MEV_CORE_URL") {
        let trimmed = url.trim();
        if is_local_app_url(trimmed) {
            return trimmed.to_string();
        }
        spawn_log(&format!("abaikan MEV_CORE_URL non-lokal: {trimmed}"));
    }
    format!("http://localhost:{CORE_PORT}/engine")
}

fn port_is_up(port: u16) -> bool {
    let Ok(addr) = format!("{CORE_HOST}:{port}").parse::<SocketAddr>() else {
        return false;
    };
    TcpStream::connect_timeout(&addr, Duration::from_millis(400)).is_ok()
}

fn win_node_path(path: PathBuf) -> PathBuf {
    let raw = path.to_string_lossy();
    let stripped = raw
        .strip_prefix(r"\\?\UNC\")
        .map(|rest| format!(r"\\{rest}"))
        .or_else(|| raw.strip_prefix(r"\\?\").map(str::to_string))
        .unwrap_or_else(|| raw.into_owned());
    PathBuf::from(stripped)
}

fn project_root() -> PathBuf {
    std::env::var("MEV_CORE_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(".."))
}

fn apply_hidden(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let _ = cmd;
}

fn node_bin(app: &AppHandle) -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let sidecar = dir.join("node.exe");
            if sidecar.exists() {
                return sidecar;
            }
        }
    }
    if let Ok(dir) = app.path().resource_dir() {
        let sidecar = dir.join("node.exe");
        if sidecar.exists() {
            return sidecar;
        }
    }
    PathBuf::from("node")
}

fn looks_like_core(dir: &Path) -> bool {
    dir.join("core-runtime.mjs").is_file() || dir.join("server.js").is_file()
}

fn core_root(app: &AppHandle) -> PathBuf {
    if let Ok(from_env) = std::env::var("MEV_CORE_ROOT") {
        return PathBuf::from(from_env);
    }
    let mut candidates = Vec::new();
    if let Ok(dir) = app.path().resource_dir() {
        candidates.push(dir.join("core"));
        candidates.push(dir.join("resources").join("core"));
        candidates.push(dir.clone());
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("core"));
            candidates.push(dir.join("resources").join("core"));
        }
    }
    candidates.push(project_root());
    candidates
        .into_iter()
        .find(|dir| looks_like_core(dir))
        .unwrap_or_else(project_root)
}

fn spawn_log(message: &str) {
    let path = std::env::temp_dir().join("mev-core-spawn.log");
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        use std::io::Write;
        let _ = writeln!(file, "{} {message}", chrono_like_now());
    }
}

fn chrono_like_now() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_default()
}

fn spawn_core(app: &AppHandle) -> Option<Child> {
    let root = win_node_path(core_root(app));
    let runtime = win_node_path(if root.join("core-runtime.mjs").is_file() {
        root.join("core-runtime.mjs")
    } else {
        project_root().join("scripts").join("core-standalone.mjs")
    });
    let node = win_node_path(node_bin(app));
    spawn_log(&format!(
        "node={} exists={} runtime={} exists={} cwd={} exists={}",
        node.display(),
        node.exists(),
        runtime.display(),
        runtime.exists(),
        root.display(),
        root.exists()
    ));
    let _ = std::fs::create_dir_all(root.join("data"));
    let stdio_path = root.join("data").join("spawn-stdio.log");
    let stdio = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&stdio_path)
        .ok();
    let mut cmd = Command::new(&node);
    cmd.arg(&runtime)
        .current_dir(&root)
        .env("CORE_PORT", CORE_PORT.to_string())
        .env("MEV_LIVE_PORT", LIVE_PORT.to_string())
        .env("MEV_CORE_ROOT", &root)
        .env("MEV_DESKTOP_CORE", "1")
        .env("HOSTNAME", CORE_HOST)
        .env("PORT", CORE_PORT.to_string())
        .env("NODE_ENV", "production")
        .stdin(Stdio::null());
    if let Some(file) = stdio {
        if let Ok(err) = file.try_clone() {
            cmd.stdout(Stdio::from(file)).stderr(Stdio::from(err));
        }
    } else {
        cmd.stdout(Stdio::null()).stderr(Stdio::null());
    }
    apply_hidden(&mut cmd);
    match cmd.spawn() {
        Ok(child) => {
            spawn_log(&format!("spawn ok pid={}", child.id()));
            Some(child)
        }
        Err(error) => {
            spawn_log(&format!("spawn error: {error}"));
            None
        }
    }
}

fn wait_for_port(port: u16, attempts: u32, step: Duration) {
    for _ in 0..attempts {
        if port_is_up(port) {
            return;
        }
        std::thread::sleep(step);
    }
}

fn spawn_logged(app: &AppHandle, label: &str, args: &[PathBuf], cwd: &Path) -> Option<Child> {
    let node = win_node_path(node_bin(app));
    let root = win_node_path(cwd.to_path_buf());
    spawn_log(&format!(
        "{label} node={} exists={} cwd={} exists={}",
        node.display(),
        node.exists(),
        root.display(),
        root.exists()
    ));
    let _ = std::fs::create_dir_all(root.join("data"));
    let stdio_path = root.join("data").join("spawn-stdio.log");
    let stdio = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&stdio_path)
        .ok();
    let mut cmd = Command::new(&node);
    cmd.args(args.iter().map(|arg| win_node_path(arg.clone())))
        .current_dir(&root)
        .env("CORE_PORT", CORE_PORT.to_string())
        .env("MEV_LIVE_PORT", LIVE_PORT.to_string())
        .env("MEV_CORE_ROOT", &root)
        .env("MEV_DESKTOP_CORE", "1")
        .env("HOSTNAME", CORE_HOST)
        .env("PORT", CORE_PORT.to_string())
        .env("NODE_ENV", "production")
        .stdin(Stdio::null());
    if let Some(file) = stdio {
        if let Ok(err) = file.try_clone() {
            cmd.stdout(Stdio::from(file)).stderr(Stdio::from(err));
        }
    } else {
        cmd.stdout(Stdio::null()).stderr(Stdio::null());
    }
    apply_hidden(&mut cmd);
    match cmd.spawn() {
        Ok(child) => {
            spawn_log(&format!("{label} spawn ok pid={}", child.id()));
            Some(child)
        }
        Err(error) => {
            spawn_log(&format!("{label} spawn error: {error}"));
            None
        }
    }
}

fn spawn_live_hub(app: &AppHandle) -> Option<Child> {
    let root = win_node_path(core_root(app));
    let bundled = root.join("searcher.cjs");
    if bundled.is_file() {
        return spawn_logged(app, "live-hub", &[bundled], &root);
    }
    let project = project_root();
    let tsx = project.join("node_modules").join("tsx").join("dist").join("cli.mjs");
    let entry = project.join("searcher").join("index.ts");
    if tsx.is_file() && entry.is_file() {
        return spawn_logged(app, "live-hub", &[tsx, entry], &project);
    }
    spawn_log("live hub: searcher.cjs dan searcher/index.ts tidak ditemukan");
    None
}

fn ensure_services(app: &AppHandle) -> Vec<Child> {
    let mut children = Vec::new();
    if !port_is_up(CORE_PORT) {
        if let Some(child) = spawn_core(app) {
            children.push(child);
        }
        wait_for_port(CORE_PORT, 90, Duration::from_millis(500));
    }
    if !port_is_up(LIVE_PORT) && !children.is_empty() {
        wait_for_port(LIVE_PORT, 40, Duration::from_millis(250));
    }
    if !port_is_up(LIVE_PORT) {
        if let Some(child) = spawn_live_hub(app) {
            children.push(child);
        }
        wait_for_port(LIVE_PORT, 40, Duration::from_millis(250));
    }
    if !port_is_up(LIVE_PORT) {
        spawn_log("WebSocket hub 4101 belum menjawab setelah aplikasi desktop dibuka");
    }
    children
}

fn stop_cores(cores: &Arc<Mutex<Vec<Child>>>) {
    if let Ok(mut guard) = cores.lock() {
        for mut child in guard.drain(..) {
            let pid = child.id();
            #[cfg(windows)]
            {
                let mut kill = Command::new("taskkill");
                kill.args(["/PID", &pid.to_string(), "/T", "/F"]);
                apply_hidden(&mut kill);
                let _ = kill.status();
            }
            let _ = child.kill();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cores = Arc::new(Mutex::new(Vec::<Child>::new()));
    let cores_for_setup = Arc::clone(&cores);
    let cores_for_exit = Arc::clone(&cores);

    tauri::Builder::default()
        .setup(move |app| {
            let children = ensure_services(app.handle());
            if let Ok(mut guard) = cores_for_setup.lock() {
                *guard = children;
            }
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(url) = core_http_url().parse() {
                    let _ = window.navigate(url);
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("MEV Core Engine window failed to start")
        .run(move |_app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                stop_cores(&cores_for_exit);
            }
        });
}
