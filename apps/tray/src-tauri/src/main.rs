use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent, Wry,
};
#[cfg(target_os = "windows")]
use windows::Win32::Globalization::GetUserDefaultLocaleName;

const DEFAULT_DASHBOARD_BASE_URL: &str = "http://127.0.0.1:3000";
const DESKTOP_MODE_ENV_KEY: &str = "MONEYSIREN_DESKTOP_MODE";
const WEB_URL_ENV_KEY: &str = "MONEYSIREN_WEB_URL";
const LOCALE_ENV_KEY: &str = "MONEYSIREN_LOCALE";
const HUD_WINDOW_STATE_FILE: &str = "hud-window-state.json";
const HUD_DEFAULT_WIDTH: f64 = 340.0;
const HUD_DEFAULT_HEIGHT: f64 = 360.0;
const HUD_MIN_WIDTH: u32 = 280;
const HUD_MIN_HEIGHT: u32 = 240;
const LOCALE_ENV_KEYS: [&str; 6] = [
    LOCALE_ENV_KEY,
    "LANGUAGE",
    "LC_ALL",
    "LC_MESSAGES",
    "LANG",
    "MONEYSIREN_LANGUAGE",
];
const TRAY_ACTIONS: [TrayAction; 6] = [
    TrayAction::new("show-hud", TrayRoute::Hud, false),
    TrayAction::new("open-dashboard", TrayRoute::DashboardOverview, false),
    TrayAction::new("open-today-live", TrayRoute::TodayLive, false),
    TrayAction::new("open-connections", TrayRoute::Connections, false),
    TrayAction::new(
        "open-notification-settings",
        TrayRoute::NotificationSettings,
        false,
    ),
    TrayAction::new("quit", TrayRoute::None, true),
];

const LOCAL_API_ENDPOINTS: [&str; 3] = [
    "/api/local/health",
    "/api/local/tray-menu",
    "/api/local/notification-digest",
];

#[derive(Clone, Copy)]
struct TrayAction {
    id: &'static str,
    route: TrayRoute,
    separator_before: bool,
}

impl TrayAction {
    const fn new(id: &'static str, route: TrayRoute, separator_before: bool) -> Self {
        Self {
            id,
            route,
            separator_before,
        }
    }
}

#[derive(Clone, Copy)]
enum TrayRoute {
    Hud,
    DashboardOverview,
    TodayLive,
    Connections,
    NotificationSettings,
    None,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TrayNativeAction {
    id: &'static str,
    label: &'static str,
    url_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TrayNativeStatus {
    local_only: bool,
    secrets_returned: bool,
    dashboard_base_url: String,
    hud_available: bool,
    notifications_available: bool,
    locale: &'static str,
    actions: Vec<TrayNativeAction>,
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
                let locale = current_locale();
                navigate_dashboard_route(
                    app.handle(),
                    &format!("/{}/dashboard/overview", locale.code()),
                );
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

#[derive(Clone, Copy, PartialEq, Eq)]
enum Locale {
    En,
    Ko,
    Ja,
}

impl Locale {
    const fn code(self) -> &'static str {
        match self {
            Self::En => "en",
            Self::Ko => "ko",
            Self::Ja => "ja",
        }
    }
}

fn desktop_mode() -> DesktopMode {
    match std::env::var(DESKTOP_MODE_ENV_KEY) {
        Ok(value) if value.trim().eq_ignore_ascii_case("hud") => DesktopMode::Hud,
        _ => DesktopMode::Tray,
    }
}

fn current_locale() -> Locale {
    for key in LOCALE_ENV_KEYS {
        if let Ok(value) = std::env::var(key) {
            if let Some(locale) = parse_locale_hint(&value) {
                return locale;
            }
        }
    }

    if let Some(value) = system_locale_hint() {
        if let Some(locale) = parse_locale_hint(&value) {
            return locale;
        }
    }

    Locale::En
}

#[cfg(target_os = "windows")]
fn system_locale_hint() -> Option<String> {
    let mut buffer = [0u16; 85];
    let length = unsafe { GetUserDefaultLocaleName(&mut buffer) };

    if length <= 1 {
        return None;
    }

    String::from_utf16(&buffer[..length as usize - 1]).ok()
}

#[cfg(not(target_os = "windows"))]
fn system_locale_hint() -> Option<String> {
    None
}

fn parse_locale_hint(value: &str) -> Option<Locale> {
    for part in value.split(',') {
        let normalized = part
            .trim()
            .split(';')
            .next()
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase()
            .replace('_', "-");

        if normalized.is_empty() {
            continue;
        }

        let primary = normalized.split('-').next().unwrap_or_default();

        match primary {
            "ko" => return Some(Locale::Ko),
            "ja" => return Some(Locale::Ja),
            "en" => return Some(Locale::En),
            _ => {}
        }
    }

    None
}

fn tray_action_label(action_id: &str, locale: Locale) -> &'static str {
    match locale {
        Locale::Ko => match action_id {
            "show-hud" => "HUD 열기",
            "open-dashboard" => "대시보드 열기",
            "open-today-live" => "오늘 실시간",
            "open-connections" => "연결 설정",
            "open-notification-settings" => "알림 설정",
            "quit" => "MoneySiren 종료",
            _ => "MoneySiren",
        },
        Locale::Ja => match action_id {
            "show-hud" => "HUDを開く",
            "open-dashboard" => "ダッシュボードを開く",
            "open-today-live" => "今日のライブ",
            "open-connections" => "接続設定",
            "open-notification-settings" => "通知設定",
            "quit" => "MoneySirenを終了",
            _ => "MoneySiren",
        },
        Locale::En => match action_id {
            "show-hud" => "Open HUD",
            "open-dashboard" => "Open Dashboard",
            "open-today-live" => "Today Live",
            "open-connections" => "Connections",
            "open-notification-settings" => "Notification Settings",
            "quit" => "Quit MoneySiren",
            _ => "MoneySiren",
        },
    }
}

fn tray_action_url_path(action: TrayAction, locale: Locale) -> Option<String> {
    match action.route {
        TrayRoute::Hud => Some(format!("/hud?locale={}", locale.code())),
        TrayRoute::DashboardOverview => Some(format!("/{}/dashboard/overview", locale.code())),
        TrayRoute::TodayLive => Some(format!("/{}/dashboard/today", locale.code())),
        TrayRoute::Connections => Some(format!("/{}/settings/connections", locale.code())),
        TrayRoute::NotificationSettings => {
            Some(format!("/{}/settings/notifications", locale.code()))
        }
        TrayRoute::None => None,
    }
}

fn localized_tray_actions(locale: Locale) -> Vec<TrayNativeAction> {
    TRAY_ACTIONS
        .iter()
        .map(|action| TrayNativeAction {
            id: action.id,
            label: tray_action_label(action.id, locale),
            url_path: tray_action_url_path(*action, locale).unwrap_or_default(),
        })
        .collect()
}

fn build_tray_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let menu = Menu::new(app)?;
    let locale = current_locale();

    for action in TRAY_ACTIONS {
        if action.separator_before {
            menu.append(&PredefinedMenuItem::separator(app)?)?;
        }

        let item = MenuItem::with_id(
            app,
            action.id,
            tray_action_label(action.id, locale),
            true,
            None::<&str>,
        )?;
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
        if let Some(url_path) = tray_action_url_path(*action, current_locale()) {
            navigate_dashboard_route(app, &url_path);
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
    let result = std::process::Command::new("explorer.exe")
        .arg(url)
        .spawn()
        .or_else(|_| {
            std::process::Command::new("cmd")
                .args(["/C", "start", "", url])
                .spawn()
        });

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

    let url = format!(
        "{}/hud?locale={}",
        dashboard_base_url(),
        current_locale().code()
    );
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
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(false)
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
    let locale = current_locale();

    TrayNativeStatus {
        local_only: true,
        secrets_returned: false,
        dashboard_base_url: dashboard_base_url(),
        hud_available: true,
        notifications_available: true,
        locale: locale.code(),
        actions: localized_tray_actions(locale),
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
