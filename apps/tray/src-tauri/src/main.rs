use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent, Wry,
};

const DEFAULT_DASHBOARD_BASE_URL: &str = "http://127.0.0.1:3000";
const DESKTOP_MODE_ENV_KEY: &str = "MONEYSIREN_DESKTOP_MODE";
const WEB_URL_ENV_KEY: &str = "MONEYSIREN_WEB_URL";
const HUD_WINDOW_STATE_FILE: &str = "hud-window-state.json";
const HUD_DEFAULT_WIDTH: f64 = 340.0;
const HUD_DEFAULT_HEIGHT: f64 = 360.0;
const HUD_MIN_WIDTH: u32 = 280;
const HUD_MIN_HEIGHT: u32 = 240;
const TRAY_ACTIONS: [TrayAction; 12] = [
    TrayAction::new("show-hud", "Show HUD", "/hud"),
    TrayAction::new("open-dashboard", "Open Dashboard", "/"),
    TrayAction::new("open-today-live", "Open Today Live", "/ko/dashboard/today"),
    TrayAction::new(
        "open-connections",
        "Open Connections",
        "/ko/settings/connections",
    ),
    TrayAction::new(
        "open-notification-settings",
        "Notification Settings",
        "/ko/settings/notifications",
    ),
    TrayAction::new("refresh-now", "Refresh Now", ""),
    TrayAction::new("pause-30m", "Pause Notifications 30m", ""),
    TrayAction::new("pause-1h", "Pause Notifications 1h", ""),
    TrayAction::new("pause-until-tomorrow", "Pause Until Tomorrow", ""),
    TrayAction::new("start-at-login-toggle", "Start at Login", ""),
    TrayAction::new("run-doctor", "Run Doctor", ""),
    TrayAction::new("quit", "Quit MoneySiren", ""),
];

const LOCAL_API_ENDPOINTS: [&str; 3] = [
    "/api/local/health",
    "/api/local/tray-menu",
    "/api/local/notification-digest",
];

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
struct TrayAction {
    id: &'static str,
    label: &'static str,
    url_path: &'static str,
}

impl TrayAction {
    const fn new(id: &'static str, label: &'static str, url_path: &'static str) -> Self {
        Self {
            id,
            label,
            url_path,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TrayNativeStatus {
    local_only: bool,
    secrets_returned: bool,
    dashboard_base_url: String,
    hud_available: bool,
    notifications_available: bool,
    actions: &'static [TrayAction],
    allowed_local_api_endpoints: &'static [&'static str],
}

#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct HudWindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            let menu = build_tray_menu(app.handle())?;
            let icon = Image::from_bytes(include_bytes!("../icons/tray.png"))?;
            let desktop_mode = desktop_mode();

            TrayIconBuilder::with_id("moneysiren-tray")
                .icon(icon)
                .tooltip(if desktop_mode == DesktopMode::Hud {
                    "MoneySiren HUD"
                } else {
                    "MoneySiren"
                })
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(move |app_handle, event| {
                    handle_tray_action(app_handle, event.id().as_ref());
                })
                .build(&handle)?;

            if desktop_mode == DesktopMode::Hud {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
                open_hud_window(app.handle());
            } else {
                navigate_dashboard_route(app.handle(), "/");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_dashboard_route,
            open_dashboard_route_external,
            tray_native_status
        ])
        .run(tauri::generate_context!())
        .expect("failed to run MoneySiren tray");
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum DesktopMode {
    Tray,
    Hud,
}

fn desktop_mode() -> DesktopMode {
    match std::env::var(DESKTOP_MODE_ENV_KEY) {
        Ok(value) if value.trim().eq_ignore_ascii_case("hud") => DesktopMode::Hud,
        _ => DesktopMode::Tray,
    }
}

fn build_tray_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let menu = Menu::new(app)?;

    for action in TRAY_ACTIONS {
        if action.id == "quit" {
            menu.append(&PredefinedMenuItem::separator(app)?)?;
        }

        let item = MenuItem::with_id(app, action.id, action.label, true, None::<&str>)?;
        menu.append(&item)?;
    }

    Ok(menu)
}

fn handle_tray_action(app: &AppHandle, action_id: &str) {
    if action_id == "quit" {
        app.exit(0);
        return;
    }

    if action_id == "show-hud" {
        open_hud_window(app);
        let _ = app.emit("moneysiren://tray-action", action_id);
        return;
    }

    if let Some(action) = TRAY_ACTIONS.iter().find(|action| action.id == action_id) {
        if !action.url_path.is_empty() {
            navigate_dashboard_route(app, action.url_path);
            return;
        }
    }

    let _ = app.emit("moneysiren://tray-action", action_id);
}

fn navigate_dashboard_route(app: &AppHandle, url_path: &str) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let url = format!("{}{}", dashboard_base_url(), url_path);
    let Ok(serialized_url) = serde_json::to_string(&url) else {
        return;
    };

    let _ = window.eval(&format!("window.location.href = {};", serialized_url));
    let _ = window.show();
    let _ = window.set_focus();
}

#[tauri::command]
fn open_dashboard_route(app: AppHandle, url_path: String) -> Result<(), String> {
    let Some(route_path) = sanitize_dashboard_route_path(&url_path) else {
        return Err("Invalid dashboard route path.".to_string());
    };

    navigate_dashboard_route(&app, route_path);
    Ok(())
}

#[tauri::command]
fn open_dashboard_route_external(url_path: String) -> Result<(), String> {
    let Some(route_path) = sanitize_dashboard_route_path(&url_path) else {
        return Err("Invalid dashboard route path.".to_string());
    };

    open_external_url(&format!("{}{}", dashboard_base_url(), route_path))
}

fn sanitize_dashboard_route_path(url_path: &str) -> Option<&str> {
    if !url_path.starts_with('/') || url_path.starts_with("//") {
        return None;
    }

    if url_path.chars().any(|character| character.is_control()) {
        return None;
    }

    Some(url_path)
}

fn open_external_url(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("cmd")
        .args(["/C", "start", "", url])
        .spawn();

    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg(url).spawn();

    #[cfg(all(unix, not(target_os = "macos")))]
    let result = std::process::Command::new("xdg-open").arg(url).spawn();

    result
        .map(|_| ())
        .map_err(|error| format!("Failed to open dashboard route in browser: {error}"))
}

fn open_hud_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("moneysiren-hud") {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    let url = format!("{}/hud", dashboard_base_url());
    let Ok(parsed_url) = url.parse() else {
        return;
    };

    let saved_state = read_hud_window_state(app);
    let mut builder =
        WebviewWindowBuilder::new(app, "moneysiren-hud", WebviewUrl::External(parsed_url))
            .title("MoneySiren HUD")
            .inner_size(
                saved_state.map_or(HUD_DEFAULT_WIDTH, |state| state.width as f64),
                saved_state.map_or(HUD_DEFAULT_HEIGHT, |state| state.height as f64),
            )
            .min_inner_size(HUD_MIN_WIDTH as f64, HUD_MIN_HEIGHT as f64)
            .resizable(true)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .visible(true);

    if let Some(state) = saved_state {
        builder = builder.position(state.x as f64, state.y as f64);
    }

    let Ok(window) = builder.build() else {
        return;
    };

    attach_hud_window_state_listener(app, &window);
    let _ = window.set_focus();
}

fn attach_hud_window_state_listener(app: &AppHandle, window: &WebviewWindow) {
    let app = app.clone();
    let observed_window = window.clone();
    let state_window = window.clone();

    observed_window.on_window_event(move |event| {
        if matches!(event, WindowEvent::Moved(_) | WindowEvent::Resized(_)) {
            save_hud_window_state(&app, &state_window);
        }
    });
}

fn read_hud_window_state(app: &AppHandle) -> Option<HudWindowState> {
    let path = hud_window_state_path(app)?;
    let raw = fs::read_to_string(path).ok()?;
    let state = serde_json::from_str::<HudWindowState>(&raw).ok()?;

    normalize_hud_window_state(state)
}

fn save_hud_window_state(app: &AppHandle, window: &WebviewWindow) {
    let Ok(position) = window.outer_position() else {
        return;
    };
    let Ok(size) = window.outer_size() else {
        return;
    };
    let Some(state) = normalize_hud_window_state(HudWindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    }) else {
        return;
    };
    let Some(path) = hud_window_state_path(app) else {
        return;
    };
    let Some(parent) = path.parent() else {
        return;
    };

    if fs::create_dir_all(parent).is_err() {
        return;
    }

    if let Ok(raw) = serde_json::to_string_pretty(&state) {
        let _ = fs::write(path, raw);
    }
}

fn hud_window_state_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|directory| directory.join(HUD_WINDOW_STATE_FILE))
}

fn normalize_hud_window_state(state: HudWindowState) -> Option<HudWindowState> {
    if state.width < HUD_MIN_WIDTH || state.height < HUD_MIN_HEIGHT {
        return None;
    }

    if state.width > 4096 || state.height > 4096 {
        return None;
    }

    Some(state)
}

#[tauri::command]
fn tray_native_status() -> TrayNativeStatus {
    TrayNativeStatus {
        local_only: true,
        secrets_returned: false,
        dashboard_base_url: dashboard_base_url(),
        hud_available: true,
        notifications_available: true,
        actions: &TRAY_ACTIONS,
        allowed_local_api_endpoints: &LOCAL_API_ENDPOINTS,
    }
}

fn dashboard_base_url() -> String {
    std::env::var(WEB_URL_ENV_KEY)
        .ok()
        .and_then(|value| normalize_loopback_base_url(&value))
        .unwrap_or_else(|| DEFAULT_DASHBOARD_BASE_URL.to_string())
}

fn normalize_loopback_base_url(value: &str) -> Option<String> {
    let trimmed = value.trim().trim_end_matches('/');

    for prefix in ["http://127.0.0.1:", "http://localhost:"] {
        let Some(rest) = trimmed.strip_prefix(prefix) else {
            continue;
        };

        if rest.is_empty() || !rest.chars().all(|character| character.is_ascii_digit()) {
            return None;
        }

        let Ok(port) = rest.parse::<u16>() else {
            return None;
        };

        return Some(format!("{prefix}{port}"));
    }

    None
}
