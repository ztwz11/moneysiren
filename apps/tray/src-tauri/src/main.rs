use serde::Serialize;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, Wry,
};

const TRAY_ACTIONS: [TrayAction; 10] = [
    TrayAction::new("open-dashboard", "Open Dashboard", "/ko/dashboard/overview"),
    TrayAction::new("open-today-live", "Open Today Live", "/ko/dashboard/today"),
    TrayAction::new("open-connections", "Open Connections", "/ko/settings/connections"),
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
        Self { id, label, url_path }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TrayNativeStatus {
    local_only: bool,
    secrets_returned: bool,
    actions: &'static [TrayAction],
    allowed_local_api_endpoints: &'static [&'static str],
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            let menu = build_tray_menu(app.handle())?;
            let icon = Image::from_bytes(include_bytes!("../icons/tray.png"))?;

            TrayIconBuilder::with_id("stackspend-tray")
                .icon(icon)
                .tooltip("StackSpend")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(move |app_handle, event| {
                    handle_tray_action(app_handle, event.id().as_ref());
                })
                .build(&handle)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![tray_native_status])
        .run(tauri::generate_context!())
        .expect("failed to run StackSpend tray");
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

    let _ = app.emit("stackspend://tray-action", action_id);
}

#[tauri::command]
fn tray_native_status() -> TrayNativeStatus {
    TrayNativeStatus {
        local_only: true,
        secrets_returned: false,
        actions: &TRAY_ACTIONS,
        allowed_local_api_endpoints: &LOCAL_API_ENDPOINTS,
    }
}
