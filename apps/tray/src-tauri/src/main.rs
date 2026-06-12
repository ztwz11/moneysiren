use serde::Serialize;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, Wry,
};

const DASHBOARD_BASE_URL: &str = "http://127.0.0.1:3000";
const DESKTOP_MODE_ENV_KEY: &str = "STACKSPEND_DESKTOP_MODE";
const TRAY_ACTIONS: [TrayAction; 12] = [
    TrayAction::new("show-hud", "Show HUD", "/hud?locale=ko"),
    TrayAction::new("open-dashboard", "Open Dashboard", "/ko/dashboard/overview"),
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
    TrayAction::new("quit", "Quit StackSpend", ""),
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
    dashboard_base_url: &'static str,
    hud_available: bool,
    notifications_available: bool,
    actions: &'static [TrayAction],
    allowed_local_api_endpoints: &'static [&'static str],
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            let menu = build_tray_menu(app.handle())?;
            let icon = Image::from_bytes(include_bytes!("../icons/tray.png"))?;
            let desktop_mode = desktop_mode();

            TrayIconBuilder::with_id("stackspend-tray")
                .icon(icon)
                .tooltip(if desktop_mode == DesktopMode::Hud {
                    "StackSpend HUD"
                } else {
                    "StackSpend"
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
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            tray_native_status,
            hud_window_action
        ])
        .run(tauri::generate_context!())
        .expect("failed to run StackSpend tray");
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
        let _ = app.emit("stackspend://tray-action", action_id);
        return;
    }

    if let Some(action) = TRAY_ACTIONS.iter().find(|action| action.id == action_id) {
        if !action.url_path.is_empty() {
            open_dashboard_route(app, action.url_path);
            return;
        }
    }

    let _ = app.emit("stackspend://tray-action", action_id);
}

fn open_dashboard_route(app: &AppHandle, url_path: &str) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let url = format!("{}{}", DASHBOARD_BASE_URL, url_path);
    let Ok(serialized_url) = serde_json::to_string(&url) else {
        return;
    };

    let _ = window.eval(&format!("window.location.href = {};", serialized_url));
    let _ = window.show();
    let _ = window.set_focus();
}

fn open_hud_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("stackspend-hud") {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    let url = format!("{}/hud?locale=ko", DASHBOARD_BASE_URL);
    let Ok(parsed_url) = url.parse() else {
        return;
    };
    let Ok(window) =
        WebviewWindowBuilder::new(app, "stackspend-hud", WebviewUrl::External(parsed_url))
            .title("StackSpend HUD")
            .inner_size(340.0, 360.0)
            .min_inner_size(280.0, 240.0)
            .resizable(true)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .visible(true)
            .build()
    else {
        return;
    };

    let _ = window.set_focus();
}

#[tauri::command]
fn tray_native_status() -> TrayNativeStatus {
    TrayNativeStatus {
        local_only: true,
        secrets_returned: false,
        dashboard_base_url: DASHBOARD_BASE_URL,
        hud_available: true,
        notifications_available: true,
        actions: &TRAY_ACTIONS,
        allowed_local_api_endpoints: &LOCAL_API_ENDPOINTS,
    }
}

#[tauri::command]
fn hud_window_action(app: AppHandle, action: String) -> Result<(), String> {
    let Some(window) = app.get_webview_window("stackspend-hud") else {
        return Err("StackSpend HUD window is not available.".to_string());
    };

    match action.as_str() {
        "close" => window.close().map_err(|error| error.to_string()),
        "minimize" => window.minimize().map_err(|error| error.to_string()),
        _ => Err("Unsupported StackSpend HUD window action.".to_string()),
    }
}
