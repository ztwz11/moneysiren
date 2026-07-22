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
  "src-tauri/capabilities/default.json",
  "src-tauri/assets/index.html",
  "src-tauri/icons/tray.png",
  "src-tauri/icons/tray.ico",
  "src-tauri/icons/tray-template.svg",
  "src-tauri/icons/app-icon.png",
  "src-tauri/icons/app-icon.ico",
];
const actionIds = [
  "show-hud",
  "open-dashboard",
  "open-today-live",
  "open-connections",
  "open-notification-settings",
  "quit",
];
const allowedEndpoints = [
  "/api/local/desktop-runtime",
  "/api/local/health",
  "/api/local/open-external",
  "/api/local/tray-menu",
  "/api/local/notification-digest",
];

for (const file of expectedFiles) {
  assert(existsSync(resolve(trayRoot, file)), `Missing tray native file: ${file}`);
}

assertPngDimensions("src-tauri/icons/app-icon.png", 512, 512);
assertPngDimensions("src-tauri/icons/tray.png", 64, 64);
assertIcoSizes("src-tauri/icons/app-icon.ico", [16, 20, 24, 32, 48, 64, 128, 256]);
assertIcoSizes("src-tauri/icons/tray.ico", [64]);

const trayTemplate = read("src-tauri/icons/tray-template.svg");
for (const brandColor of ["#005A6D", "#42C7D9", "#F2A000", "#FBFAF7"]) {
  assert(trayTemplate.includes(brandColor), `Tray SVG must include brand color ${brandColor}.`);
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
assert(JSON.stringify(config.bundle?.icon ?? []).includes("icons/app-icon.ico"), "Windows app .ico icon must be configured.");
assert(JSON.stringify(config.bundle?.icon ?? []).includes("icons/app-icon.png"), "PNG app icon must be configured.");

const capability = JSON.parse(read("src-tauri/capabilities/default.json"));
assert(capability.windows?.includes("main"), "Tauri capability must include the main window.");
assert(capability.windows?.includes("moneysiren-hud"), "Tauri capability must include the HUD window.");
assert(capability.remote?.urls?.includes("http://127.0.0.1:3000/*"), "Tauri capability must allow the local dev web URL.");
assert(capability.remote?.urls?.includes("http://localhost:3000/*"), "Tauri capability must allow the localhost web URL.");
for (const permission of [
  "core:window:allow-close",
  "core:window:allow-hide",
  "core:window:allow-is-always-on-top",
  "core:window:allow-minimize",
  "core:window:allow-outer-position",
  "core:window:allow-outer-size",
  "core:window:allow-set-always-on-top",
  "core:window:allow-set-focus",
  "core:window:allow-set-position",
  "core:window:allow-set-size",
  "core:window:allow-start-dragging",
]) {
  assert(capability.permissions?.includes(permission), `Tauri capability is missing permission: ${permission}.`);
}

const cargoToml = read("src-tauri/Cargo.toml");
for (const feature of ["image-ico", "image-png", "macos-private-api", "tray-icon"]) {
  assert(cargoToml.includes(`"${feature}"`), `Cargo.toml must enable Tauri feature: ${feature}.`);
}

const mainRs = read("src-tauri/src/main.rs");
assert(mainRs.includes("TrayIconBuilder"), "Rust entrypoint must build a tray icon.");
assert(mainRs.includes("show_menu_on_left_click(true)"), "Tray menu should open from the tray icon.");
assert(mainRs.includes("get_webview_window(\"main\")"), "Tray menu actions must target the main Tauri GUI window.");
assert(mainRs.includes("WebviewWindowBuilder"), "Rust entrypoint must build a HUD webview window.");
assert(mainRs.includes('TrayAction::new("show-hud", TrayRoute::Hud'), "Rust HUD action must open the local HUD surface.");
assert(mainRs.includes("MONEYSIREN_DESKTOP_MODE"), "Rust entrypoint must support HUD-only desktop mode.");
assert(mainRs.includes("MONEYSIREN_LOCALE"), "Rust entrypoint must support localized tray menus.");
assert(mainRs.includes("DesktopMode::Hud"), "Rust entrypoint must branch into HUD-only desktop mode.");
assert(mainRs.includes(".skip_taskbar(false)"), "HUD window must appear in the taskbar.");
assert(mainRs.includes(".shadow(false)"), "HUD window shadow must be disabled for borderless transparency.");
assert(!mainRs.includes(".min_inner_size("), "HUD window must not enforce a native minimum size.");
assert(mainRs.includes("get_webview_window(\"moneysiren-hud\")"), "HUD window controls must target the HUD window label.");
assert(mainRs.includes("open_dashboard_url_external"), "HUD links must support opening the current loopback URL externally.");
assert(mainRs.includes("show_hud_window"), "Web UI actions must be able to ask the desktop shell to show the native HUD window.");
assert(mainRs.includes("sanitize_loopback_dashboard_url"), "HUD external URL opening must validate loopback URLs.");
assert(mainRs.includes("explorer.exe"), "Windows external dashboard routes should use explorer.exe before shell fallback.");
assert(mainRs.includes("secrets_returned: false"), "Native status must declare secretsReturned=false.");
assert(mainRs.includes("tray_action_label"), "Rust tray menu labels must be localized.");
assert(mainRs.includes("tray_action_url_path"), "Rust tray menu routes must be generated from the selected locale.");
for (const actionId of actionIds) {
  assert(mainRs.includes(actionId), `Rust tray menu is missing action: ${actionId}`);
}
for (const endpoint of allowedEndpoints) {
  assert(mainRs.includes(endpoint), `Rust native contract is missing allowed endpoint: ${endpoint}`);
}
for (const forbidden of ["provider credential", "raw SQLite", "OPENAI_ADMIN_KEY", "CLOUDFLARE_API_TOKEN"]) {
  assert(!mainRs.includes(forbidden), `Rust tray entrypoint must not include ${forbidden}.`);
}

const runWebWithTray = readFileSync(resolve(repoRoot, "tools/scripts/run-web-with-tray.mjs"), "utf8");
assert(runWebWithTray.includes("moneysiren-tray.exe"), "Built tray launcher must support the Windows executable.");
assert(runWebWithTray.includes("MoneySiren Tray.app/Contents/MacOS/MoneySiren Tray"), "Built tray launcher must support the macOS .app executable.");
assert(runWebWithTray.includes("MONEYSIREN_DESKTOP_MODE"), "Runtime launcher must pass the desktop mode to Tauri.");
assert(runWebWithTray.includes("MONEYSIREN_LOCALE"), "Runtime launcher must pass the locale to Tauri.");
assert(runWebWithTray.includes("--desktop-mode <tray|hud>"), "Runtime launcher usage must document HUD-only mode.");

console.log("Tray native scaffold check passed.");

function read(relativePath) {
  return readFileSync(resolve(trayRoot, relativePath), "utf8");
}

function assertPngDimensions(relativePath, expectedWidth, expectedHeight) {
  const image = readFileSync(resolve(trayRoot, relativePath));
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  assert(image.subarray(0, 8).equals(pngSignature), `${relativePath} must be a PNG image.`);
  assert(image.readUInt32BE(16) === expectedWidth, `${relativePath} must be ${expectedWidth}px wide.`);
  assert(image.readUInt32BE(20) === expectedHeight, `${relativePath} must be ${expectedHeight}px high.`);
}

function assertIcoSizes(relativePath, expectedSizes) {
  const image = readFileSync(resolve(trayRoot, relativePath));

  assert(image.readUInt16LE(0) === 0 && image.readUInt16LE(2) === 1, `${relativePath} must be an ICO image.`);
  assert(image.readUInt16LE(4) === expectedSizes.length, `${relativePath} must contain ${expectedSizes.length} images.`);

  expectedSizes.forEach((expectedSize, index) => {
    const entryOffset = 6 + index * 16;
    const width = image[entryOffset] === 0 ? 256 : image[entryOffset];
    const height = image[entryOffset + 1] === 0 ? 256 : image[entryOffset + 1];

    assert(width === expectedSize, `${relativePath} entry ${index + 1} must be ${expectedSize}px wide.`);
    assert(height === expectedSize, `${relativePath} entry ${index + 1} must be ${expectedSize}px high.`);
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}
