import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const trayRoot = resolve(repoRoot, "apps/tray");
const expectedFiles = [
  "src-tauri/Cargo.toml",
  "src-tauri/build.rs",
  "src-tauri/src/main.rs",
  "src-tauri/tauri.conf.json",
  "src-tauri/assets/index.html",
  "src-tauri/icons/tray.png",
  "src-tauri/icons/tray.ico",
  "src-tauri/icons/tray-template.svg",
];
const actionIds = [
  "show-hud",
  "open-dashboard",
  "open-today-live",
  "open-connections",
  "open-notification-settings",
  "refresh-now",
  "pause-30m",
  "pause-1h",
  "pause-until-tomorrow",
  "start-at-login-toggle",
  "run-doctor",
  "quit",
];
const allowedEndpoints = [
  "/api/local/health",
  "/api/local/tray-menu",
  "/api/local/notification-digest",
];

for (const file of expectedFiles) {
  assert(existsSync(resolve(trayRoot, file)), `Missing tray native file: ${file}`);
}

const packageJson = JSON.parse(read("package.json"));
for (const scriptName of ["native:check", "icons:generate", "tauri:dev", "tauri:build", "tauri:build:unsigned"]) {
  assert(typeof packageJson.scripts?.[scriptName] === "string", `Missing tray package script: ${scriptName}`);
}

const config = JSON.parse(read("src-tauri/tauri.conf.json"));
assert(config.bundle?.active === true, "Tauri bundle.active must be true for packaging.");
const bundleTargets = config.bundle?.targets ?? [];
assert(Array.isArray(bundleTargets), "Tauri bundle.targets must be a target list.");
for (const target of ["app", "nsis"]) {
  assert(bundleTargets.includes(target), `Tauri bundle.targets must include ${target}.`);
}
assert(Array.isArray(config.app?.windows) && config.app.windows.length === 1, "Tauri GUI must create one main window.");
assert(config.app.windows[0]?.label === "main", "Tauri GUI window label must be main.");
assert(config.app.windows[0]?.url === "http://127.0.0.1:3000/ko/dashboard/overview", "Tauri GUI window must open the local dashboard.");
assert(config.app.windows[0]?.visible === true, "Tauri GUI window must be visible by default.");
assert(JSON.stringify(config.bundle?.icon ?? []).includes("icons/tray.ico"), "Windows .ico icon must be configured.");
assert(JSON.stringify(config.bundle?.icon ?? []).includes("icons/tray.png"), "PNG tray icon must be configured.");

const cargoToml = read("src-tauri/Cargo.toml");
assert(cargoToml.includes('features = ["image-ico", "image-png", "tray-icon"]'), "Cargo.toml must enable Tauri tray/icon features.");

const mainRs = read("src-tauri/src/main.rs");
assert(mainRs.includes("TrayIconBuilder"), "Rust entrypoint must build a tray icon.");
assert(mainRs.includes("show_menu_on_left_click(true)"), "Tray menu should open from the tray icon.");
assert(mainRs.includes("get_webview_window(\"main\")"), "Tray menu actions must target the main Tauri GUI window.");
assert(mainRs.includes("WebviewWindowBuilder"), "Rust entrypoint must build a HUD webview window.");
assert(mainRs.includes("/hud?locale=ko"), "Rust HUD action must open the local HUD surface.");
assert(mainRs.includes("secrets_returned: false"), "Native status must declare secretsReturned=false.");
for (const actionId of actionIds) {
  assert(mainRs.includes(actionId), `Rust tray menu is missing action: ${actionId}`);
}
for (const endpoint of allowedEndpoints) {
  assert(mainRs.includes(endpoint), `Rust native contract is missing allowed endpoint: ${endpoint}`);
}
for (const forbidden of ["provider credential", "raw SQLite", "OPENAI_ADMIN_KEY", "CLOUDFLARE_API_TOKEN"]) {
  assert(!mainRs.includes(forbidden), `Rust tray entrypoint must not include ${forbidden}.`);
}

console.log("Tray native scaffold check passed.");

function read(relativePath) {
  return readFileSync(resolve(trayRoot, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}
