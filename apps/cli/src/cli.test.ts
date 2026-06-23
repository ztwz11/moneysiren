import { createHash } from "node:crypto";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SlackReportTransportRequest } from "../../../packages/report/src/slack.js";
import { CLI_VERSION, runCli } from "./cli.js";
import type { CliDesktopRuntimeAdapter } from "./desktop-runtime.js";
import type { CliLocalRuntimeAdapter, LocalRuntime, StartRuntimeOptions } from "./runtime-adapter.js";

const FIXED_NOW = "2026-06-02T09:00:00.000Z";
const requireNodeModule = createRequire(import.meta.url);
const AWS_FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../tests/fixtures/providers/aws/cost-explorer-grouped-by-service.json",
);
const OPENAI_FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../tests/fixtures/providers/openai/usage-costs.json",
);
const SUPABASE_FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../tests/fixtures/providers/supabase/usage-health.json",
);
const CLOUDFLARE_FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../tests/fixtures/providers/cloudflare/billing-usage.json",
);
const CLI_PACKAGE_JSON_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../package.json");
const TEST_SLACK_WEBHOOK_URL = "fake-moneysiren-slack-webhook-secret";
const ANSI_PATTERN = /\x1B\[[0-9;]*m/;
const FORBIDDEN_PERSISTED_PROVIDER_DATA_PATTERN =
  /rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@|\b\d{12}\b|FAKE_CLOUDFLARE|fake-zone\.invalid|card_|payment_/i;

describe("MoneySiren CLI", () => {
  it("prints a no-arg slash home guide in CI without local side effects", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli([], testContext(cwd, {
      CI: "1",
    }));
    const stdout = result.stdout.join("\n");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toEqual([]);
    expect(stdout).toContain(`MoneySiren ${CLI_VERSION}`);
    expect(stdout).toContain("Slash commands");
    expect(stdout).toContain("/doctor");
    expect(stdout).toContain("/install");
    expect(stdout).toContain("/modes");
    expect(stdout).toContain("/sync mock");
    expect(stdout).toContain("msiren start");
    expect(stdout).toContain("msiren hud");
    expect(stdout).toContain("moneysiren install");
    expect(stdout).toContain("moneysiren modes");
    expect(stdout).toContain("moneysiren sync --provider mock");
    expect(stdout).toContain("Home/help does not call provider APIs");
    expect(stdout).not.toMatch(ANSI_PATTERN);
    expect(await fileExists(join(cwd, ".env"))).toBe(false);
    expect(await fileExists(join(cwd, ".moneysiren"))).toBe(false);
  });

  it("prints the short command alias in the help guide", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(["--help"], testContext(cwd));
    const stdout = result.stdout.join("\n");

    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("Short command:");
    expect(stdout).toContain("msiren start");
    expect(stdout).toContain("msiren hud");
    expect(stdout).toContain("msiren install --all");
  });

  it("renders home guide color when enabled and disables it for NO_COLOR or TERM=dumb", async () => {
    const coloredCwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const noColorCwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const dumbTermCwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));

    const colored = await runCli([], testContext(coloredCwd, {
      CI: "1",
      FORCE_COLOR: "1",
    }));
    const noColor = await runCli([], testContext(noColorCwd, {
      CI: "1",
      FORCE_COLOR: "1",
      NO_COLOR: "1",
    }));
    const dumbTerm = await runCli([], testContext(dumbTermCwd, {
      CI: "1",
      TERM: "dumb",
    }));

    expect(colored.stdout.join("\n")).toMatch(ANSI_PATTERN);
    expect(noColor.stdout.join("\n")).not.toMatch(ANSI_PATTERN);
    expect(dumbTerm.stdout.join("\n")).not.toMatch(ANSI_PATTERN);
  });

  it("previews bundled and file-based image reference CLI themes without secrets", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const themePath = join(cwd, "theme.json");
    await writeFile(themePath, JSON.stringify({
      version: 1,
      source: "fake-image-reference",
      ansi: {
        brand: "1;38;5;37",
        command: "38;5;42",
      },
    }), "utf8");

    const bundled = await runCli(["theme", "preview"], testContext(cwd, {
      CI: "1",
      FORCE_COLOR: "1",
      MONEYSIREN_CLI_THEME: "image2-dashboard",
    }));
    const fromFile = await runCli(["theme", "preview"], testContext(cwd, {
      CI: "1",
      FORCE_COLOR: "1",
      MONEYSIREN_CLI_THEME_FILE: "theme.json",
    }));
    const prompt = await runCli(["theme", "image-prompt"], testContext(cwd));

    expect(bundled.exitCode).toBe(0);
    expect(bundled.stdout.join("\n")).toContain("Source: image2-dashboard");
    expect(bundled.stdout.join("\n")).toContain("\x1b[1;38;5;30mMoneySiren\x1b[0m");
    expect(fromFile.exitCode).toBe(0);
    expect(fromFile.stdout.join("\n")).toContain("Source: fake-image-reference");
    expect(fromFile.stdout.join("\n")).toContain("\x1b[1;38;5;37mMoneySiren\x1b[0m");
    expect(prompt.exitCode).toBe(0);
    expect(prompt.stdout.join("\n")).toContain("Create a polished Image 2 reference");
    expect(prompt.stdout.join("\n")).toContain("MONEYSIREN_CLI_THEME_FILE");
    expect(prompt.stdout.join("\n")).not.toMatch(/sk-|hooks\.slack|FAKE_/i);
  });

  it("generates a CLI image reference and theme file with an explicit env-only API key", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const fetchRequests: Array<{ url: string; model: string | undefined; hasAuthorization: boolean }> = [];
    const result = await runCli(
      [
        "theme",
        "image-generate",
        "--out",
        ".moneysiren/themes/test-reference.png",
        "--theme-out",
        ".moneysiren/themes/test-theme.json",
        "--model",
        "gpt-image-1-mini",
      ],
      {
        ...testContext(cwd, {
          OPENAI_API_KEY: "sk-fake-image-key-for-tests",
        }),
        fetch: async (input, init) => {
          const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string; prompt?: string };
          fetchRequests.push({
            url: String(input),
            model: body.model,
            hasAuthorization: String((init?.headers as Record<string, string>).authorization ?? "").startsWith("Bearer "),
          });
          expect(body.prompt).toContain("MoneySiren CLI theme");

          return Response.json({
            data: [
              {
                b64_json: Buffer.from("fake png bytes").toString("base64"),
              },
            ],
          });
        },
      },
    );
    const image = await readFile(join(cwd, ".moneysiren", "themes", "test-reference.png"), "utf8");
    const theme = JSON.parse(await readFile(join(cwd, ".moneysiren", "themes", "test-theme.json"), "utf8")) as {
      source?: string;
      ansi?: Record<string, string>;
    };
    const allOutput = [...result.stdout, ...result.stderr].join("\n");

    expect(result.exitCode).toBe(0);
    expect(fetchRequests).toEqual([
      {
        url: "https://api.openai.com/v1/images/generations",
        model: "gpt-image-1-mini",
        hasAuthorization: true,
      },
    ]);
    expect(image).toBe("fake png bytes");
    expect(theme.source).toBe("image-generation:gpt-image-1-mini");
    expect(theme.ansi?.brand).toBe("1;38;5;30");
    expect(result.stdout.join("\n")).toContain("MONEYSIREN_CLI_THEME_FILE=.moneysiren/themes/test-theme.json");
    expect(allOutput).not.toContain("sk-fake-image-key-for-tests");
  });

  it("declares a public alpha npm package with a built JavaScript bin and scoped files", async () => {
    const packageJson = JSON.parse(await readFile(CLI_PACKAGE_JSON_PATH, "utf8")) as {
      version?: string;
      private?: boolean;
      license?: string;
      packageManager?: string;
      engines?: Record<string, string>;
      bin?: Record<string, string>;
      dependencies?: Record<string, string>;
      files?: string[];
      publishConfig?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const files = packageJson.files ?? [];

    expect(packageJson.private).toBe(false);
    expect(packageJson.version).toBe(CLI_VERSION);
    expect(packageJson.license).toBe("MIT");
    expect(packageJson.packageManager).toBe("pnpm@11.5.0");
    expect(packageJson.engines?.node).toBe(">=20.11.0");
    expect(packageJson.publishConfig?.access).toBe("public");
    expect(packageJson.dependencies?.["@aws-sdk/client-cost-explorer"]).toBe("^3.1061.0");
    expect(packageJson.bin?.moneysiren).toBe("dist/apps/cli/src/index.js");
    expect(packageJson.bin?.msiren).toBe("dist/apps/cli/src/index.js");
    expect(packageJson.bin?.moneysiren).not.toBe("src/index.ts");
    expect(packageJson.scripts?.build).toBe("node ../../tools/scripts/build-cli.mjs");
    expect(packageJson.scripts?.prepack).toBe("node ../../tools/scripts/build-cli.mjs");
    expect(packageJson.scripts?.postinstall).toBe("node scripts/postinstall.mjs");
    expect(files).toEqual(
      expect.arrayContaining([
        "dist/apps/cli/src/**/*.js",
        "dist/packages/**/*.js",
        "scripts/postinstall.mjs",
        "README.md",
        "LICENSE",
      ]),
    );
    expect(files.join("\n")).not.toMatch(/(^|\n)(src\/|test|tests\/|\*\*\/\*\.test\.)/i);
  });

  it("ignores a leading pnpm argument separator", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(["--", "doctor"], testContext(cwd));

    expect(result.exitCode).toBe(0);
    expect(result.stdout.join("\n")).toContain("MoneySiren doctor");
  });

  it("routes slash aliases to existing commands without exposing secret values", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));

    const version = await runCli(["/version"], testContext(cwd));
    expect(version.exitCode).toBe(0);
    expect(version.stdout.join("\n").trim()).toBe(CLI_VERSION);

    const doctor = await runCli(["/doctor"], testContext(cwd, {
      OPENAI_ADMIN_KEY: "sk-fake-openai-admin-key",
    }));
    const doctorOutput = doctor.stdout.join("\n");
    expect(doctor.exitCode).toBe(0);
    expect(doctorOutput).toContain("MoneySiren doctor");
    expect(doctorOutput).toContain("openai: configured");
    expect(doctorOutput).not.toContain("sk-fake-openai-admin-key");

    const modes = await runCli(["/modes"], testContext(cwd));
    expect(modes.exitCode).toBe(0);
    expect(modes.stdout.join("\n")).toContain("MoneySiren modes");
    expect(modes.stdout.join("\n")).toContain("Install profile: CLI, Web dashboard, HUD");

    const init = await runCli(["/init"], testContext(cwd));
    expect(init.exitCode).toBe(0);
    expect(init.stdout.join("\n")).toContain("Initialized MoneySiren local storage");
    expect(await fileExists(join(cwd, ".env"))).toBe(false);

    const sync = await runCli(["/sync", "mock"], testContext(cwd));
    expect(sync.exitCode).toBe(0);
    expect(sync.stdout.join("\n")).toContain("Synced mock provider snapshots");

    const report = await runCli(["/report", "ko"], testContext(cwd));
    expect(report.exitCode).toBe(0);
    expect(report.stdout.join("\n")).toContain("MoneySiren 일일 리포트");

    const dashboard = await runCli(["/dashboard"], {
      ...testContext(cwd),
      fetch: async () =>
        Response.json({
          generatedAt: FIXED_NOW,
          source: "sqlite",
          database: {
            available: true,
            reason: "ok",
          },
          summary: {
            providerCount: 1,
          },
        }),
    });
    expect(dashboard.exitCode).toBe(0);
    expect(dashboard.stdout.join("\n")).toContain("MoneySiren dashboard check");

    const dashboardCheck = await runCli(["/dashboard", "check"], {
      ...testContext(cwd),
      fetch: async () =>
        Response.json({
          generatedAt: FIXED_NOW,
          source: "sqlite",
          database: {
            available: true,
            reason: "ok",
          },
          summary: {
            providerCount: 1,
          },
        }),
    });
    expect(dashboardCheck.exitCode).toBe(0);
    expect(dashboardCheck.stdout.join("\n")).toContain("MoneySiren dashboard check");
  }, 30000);

  it("rejects unknown slash commands with slash usage guidance", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(["/unknown"], testContext(cwd));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toEqual([]);
    expect(result.stderr.join("\n")).toContain("Unknown slash command: /unknown");
    expect(result.stderr.join("\n")).toContain("moneysiren /help");
  });

  it("initializes local storage without creating .env or credentials", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(["init"], testContext(cwd));

    expect(result.exitCode).toBe(0);
    expect(result.stdout.join("\n")).toContain("Initialized MoneySiren local storage");
    expect(await fileExists(join(cwd, ".env"))).toBe(false);

    const dbPath = join(cwd, ".moneysiren", "moneysiren.sqlite");
    const migrations = querySqlite<{ id: string }>(dbPath, "SELECT id FROM schema_migrations ORDER BY id;");
    const persistedText = dumpPersistedProviderDataText(dbPath);

    expect(await fileExists(dbPath)).toBe(true);
    expect(migrations).toEqual([{ id: "0001_init" }, { id: "0002_read_model_indexes" }]);
    expect(persistedText).not.toContain("sqlite-placeholder-v1");
    expect(persistedText).not.toMatch(/sk-|hooks\.slack|@/i);
  });

  it("reports local readiness with doctor without exposing secret values", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(["doctor"], testContext(cwd, {
      OPENAI_ADMIN_KEY: "sk-fake-openai-admin-key",
    }));
    const stdout = result.stdout.join("\n");

    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("MoneySiren doctor");
    expect(stdout).toContain("DB path: .moneysiren/moneysiren.sqlite");
    expect(stdout).toContain("telemetry: disabled");
    expect(stdout).toContain("mock provider: available");
    expect(stdout).toContain("openai: configured");
    expect(stdout).not.toContain("sk-fake-openai-admin-key");
  });

  it("prints npm-installable three-mode guidance with macOS-safe runtime lock hints", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(["modes"], testContext(cwd, {
      HOME: join(cwd, "home"),
    }));
    const stdout = result.stdout.join("\n");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toEqual([]);
    expect(stdout).toContain("MoneySiren modes");
    expect(stdout).toContain("Install profile: CLI, Web dashboard, HUD");
    expect(stdout).toContain("npm install -g @moneysiren/cli@alpha");
    expect(stdout).toContain("Short command: msiren");
    expect(stdout).toContain("1. CLI automation");
    expect(stdout).toContain("2. Local web dashboard/runtime");
    expect(stdout).toContain("3. Desktop tray/notifier");
    expect(stdout).toContain("Windows/macOS target");
    expect(stdout).toContain("msiren doctor");
    expect(stdout).toContain("msiren start");
    expect(stdout).toContain("msiren hud");
    expect(stdout).toContain("msiren desktop status");

    if (process.platform === "darwin") {
      expect(stdout).toContain("Platform: macOS");
      expect(stdout).toContain("~/Library/Application Support/MoneySiren/runtime.json");
    }

    expect(stdout).not.toContain(cwd);
    expect(stdout).not.toContain("sk-");
    expect(stdout).not.toContain("hooks.slack");
  });

  it("writes and reports the npm install component profile without secrets", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const profilePath = join(cwd, "install-profile.json");
    const install = await runCli(["install", "--profile-only", "--cli", "--hud"], testContext(cwd, {
      MONEYSIREN_INSTALL_PROFILE_PATH: profilePath,
    }));
    const status = await runCli(["install", "--status"], testContext(cwd, {
      MONEYSIREN_INSTALL_PROFILE_PATH: profilePath,
    }));
    const profile = JSON.parse(await readFile(profilePath, "utf8")) as {
      selectedSurfaces?: string[];
      localOnly?: boolean;
      secretsReturned?: boolean;
    };
    const allOutput = [...install.stdout, ...install.stderr, ...status.stdout, ...status.stderr].join("\n");

    expect(install.exitCode).toBe(0);
    expect(status.exitCode).toBe(0);
    expect(profile.selectedSurfaces).toEqual(["cli", "hud"]);
    expect(profile.localOnly).toBe(true);
    expect(profile.secretsReturned).toBe(false);
    expect(install.stdout.join("\n")).toContain("Selected components: CLI, HUD");
    expect(install.stdout.join("\n")).toContain("Release assets: skipped (--profile-only).");
    expect(status.stdout.join("\n")).toContain("Recommended default: no");
    expect(allOutput).not.toMatch(/sk-|hooks\.slack|FAKE_/i);
  });

  it("prints the pinned install release default separately from the CLI package version", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(["install", "--help"], testContext(cwd));
    const stdout = result.stdout.join("\n");

    expect(result.exitCode).toBe(0);
    expect(CLI_VERSION).toBe("0.1.0-alpha.3");
    expect(stdout).toContain("Release default: ztwz11/moneysiren@v0.1.0-alpha.3.");
  });

  it("installs selected release assets from GitHub Releases without storing secrets", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const installDir = join(cwd, "release-install");
    const profilePath = join(cwd, "install-profile.json");
    const webAsset = "moneysiren-web-runtime-v0.1.0-alpha.3.tar.gz";
    const hudAsset = "MoneySiren.Tray-macos-ARM64.tar.gz";
    const webBytes = Buffer.from("fake web runtime");
    const hudBytes = Buffer.from("fake hud binary");
    const checksum = [
      `${testSha256(webBytes)}  ${webAsset}`,
      `${testSha256(hudBytes)}  ${hudAsset}`,
      "",
    ].join("\n");
    const result = await runCli(
      ["install", "--all", "--dir", installDir, "--tag", "v0.1.0-alpha.3"],
      {
        ...testContext(cwd, {
          MONEYSIREN_INSTALL_PROFILE_PATH: profilePath,
          MONEYSIREN_RELEASE_PLATFORM: "darwin",
        }),
        fetch: async (input) => {
          const url = String(input);

          if (url.endsWith("/repos/ztwz11/moneysiren/releases/tags/v0.1.0-alpha.3")) {
            return Response.json({
              html_url: "https://github.com/ztwz11/moneysiren/releases/tag/v0.1.0-alpha.3",
              assets: [
                {
                  name: webAsset,
                  browser_download_url: `https://github.com/ztwz11/moneysiren/releases/download/v0.1.0-alpha.3/${webAsset}`,
                },
                {
                  name: hudAsset,
                  browser_download_url: `https://github.com/ztwz11/moneysiren/releases/download/v0.1.0-alpha.3/${hudAsset}`,
                },
                {
                  name: "moneysiren-web-runtime-SHA256SUMS.txt",
                  browser_download_url: "https://github.com/ztwz11/moneysiren/releases/download/v0.1.0-alpha.3/moneysiren-web-runtime-SHA256SUMS.txt",
                },
              ],
            });
          }

          if (url.endsWith(webAsset)) {
            return new Response(webBytes);
          }

          if (url.endsWith(hudAsset)) {
            return new Response(hudBytes);
          }

          if (url.endsWith("SHA256SUMS.txt")) {
            return new Response(checksum);
          }

          return new Response("missing", {
            status: 404,
            statusText: "Not Found",
          });
        },
      },
    );
    const allOutput = [...result.stdout, ...result.stderr].join("\n");

    expect(result.exitCode).toBe(0);
    expect(result.stdout.join("\n")).toContain("Release: ztwz11/moneysiren@v0.1.0-alpha.3");
    expect(result.stdout.join("\n")).toContain(`Install directory: ${installDir}`);
    expect(result.stdout.join("\n")).toContain(`Downloaded web: ${webAsset}`);
    expect(result.stdout.join("\n")).toContain(`Downloaded hud: ${hudAsset}`);
    expect(await readFile(join(installDir, webAsset), "utf8")).toBe(webBytes.toString("utf8"));
    expect(await readFile(join(installDir, hudAsset), "utf8")).toBe(hudBytes.toString("utf8"));
    expect(await readFile(join(installDir, "install-manifest.json"), "utf8")).not.toMatch(/sk-|hooks\.slack|FAKE_/i);
    expect(allOutput).not.toMatch(/sk-|hooks\.slack|FAKE_/i);
  });

  it("does not persist the install profile when release asset installation fails", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const installDir = join(cwd, "release-install");
    const profilePath = join(cwd, "install-profile.json");
    const hudAsset = "MoneySiren.Tray_0.1.0-alpha.3_x64-setup.exe";
    const hudBytes = Buffer.from("fake hud binary");

    const result = await runCli(
      ["install", "--hud", "--dir", installDir, "--tag", "v0.1.0-alpha.3"],
      {
        ...testContext(cwd, {
          MONEYSIREN_INSTALL_PROFILE_PATH: profilePath,
          MONEYSIREN_RELEASE_PLATFORM: "win32",
        }),
        fetch: async (input) => {
          const url = String(input);

          if (url.endsWith("/repos/ztwz11/moneysiren/releases/tags/v0.1.0-alpha.3")) {
            return Response.json({
              html_url: "https://github.com/ztwz11/moneysiren/releases/tag/v0.1.0-alpha.3",
              assets: [
                {
                  name: hudAsset,
                  browser_download_url: `https://github.com/ztwz11/moneysiren/releases/download/v0.1.0-alpha.3/${hudAsset}`,
                },
                {
                  name: "moneysiren-tray-windows-SHA256SUMS.txt",
                  browser_download_url: "https://github.com/ztwz11/moneysiren/releases/download/v0.1.0-alpha.3/moneysiren-tray-windows-SHA256SUMS.txt",
                },
              ],
            });
          }

          if (url.endsWith(hudAsset)) {
            return new Response(hudBytes);
          }

          if (url.endsWith("SHA256SUMS.txt")) {
            return new Response(`${testSha256(hudBytes)}  other-installer.exe\n`);
          }

          return new Response("missing", {
            status: 404,
            statusText: "Not Found",
          });
        },
      },
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr.join("\n")).toContain(`Release asset installation failed: SHA256 checksum entry missing for ${hudAsset}.`);
    expect(result.stderr.join("\n")).toContain("The selected HUD desktop artifact must be present, checksummed, and signed before MoneySiren will install it.");
    expect(result.stderr.join("\n")).toContain("For now, use `moneysiren install --web` to install only the web runtime, or retry after a signed desktop release is published.");
    expect(result.stderr.join("\n")).toContain("Install profile was not changed.");
    await expect(readFile(profilePath, "utf8")).rejects.toThrow();
  });

  it("checks the default dashboard API and accepts the safe empty state", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const fetchRequests: string[] = [];
    const result = await runCli(["dashboard", "check"], {
      ...testContext(cwd),
      fetch: async (input, init) => {
        fetchRequests.push(String(input));
        expect(init?.method).toBe("GET");
        expect((init?.headers as Record<string, string> | undefined)?.Accept).toBe("application/json");

        return Response.json({
          generatedAt: FIXED_NOW,
          source: "empty",
          database: {
            available: false,
            reason: "missing",
          },
          summary: {
            providerCount: 0,
          },
        });
      },
    });
    const stdout = result.stdout.join("\n");

    expect(result.exitCode).toBe(0);
    expect(fetchRequests).toEqual(["http://localhost:3000/api/dashboard"]);
    expect(stdout).toContain("MoneySiren dashboard check");
    expect(stdout).toContain("Dashboard URL: http://localhost:3000");
    expect(stdout).toContain("API status: 200 OK");
    expect(stdout).toContain("DB path: .moneysiren/moneysiren.sqlite");
    expect(stdout).toContain("DB exists locally: no");
    expect(stdout).toContain("Payload source: empty");
    expect(stdout).toContain("Provider count: 0");
    expect(stdout).toContain(`Generated at: ${FIXED_NOW}`);
    expect(stdout).toContain("Dashboard state: safe empty state");
  });

  it("sanitizes dashboard URL path, query, and hash before probing or printing", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const fetchRequests: string[] = [];
    const result = await runCli(["dashboard", "check", "--url", "http://localhost:3001/page?token=secret#frag"], {
      ...testContext(cwd),
      fetch: async (input) => {
        fetchRequests.push(String(input));

        return Response.json({
          generatedAt: FIXED_NOW,
          source: "sqlite",
          database: {
            available: true,
            reason: "ok",
          },
          summary: {
            providerCount: 2,
          },
        });
      },
    });
    const allOutput = [...result.stdout, ...result.stderr].join("\n");

    expect(result.exitCode).toBe(0);
    expect(fetchRequests).toEqual(["http://localhost:3001/api/dashboard"]);
    expect(allOutput).toContain("Dashboard URL: http://localhost:3001");
    expect(allOutput).toContain("URL note: path, query, and hash were ignored for safety.");
    expect(allOutput).not.toContain("token=secret");
    expect(allOutput).not.toContain("frag");
  });

  it("rejects credential-bearing dashboard URLs without leaking credential text", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(
      ["dashboard", "check", "--url", "http://user:super-secret@localhost:3000"],
      testContext(cwd),
    );
    const allOutput = [...result.stdout, ...result.stderr].join("\n");

    expect(result.exitCode).toBe(1);
    expect(result.stderr.join("\n")).toContain("Dashboard URL must not include credentials.");
    expect(allOutput).not.toContain("super-secret");
    expect(allOutput).not.toContain("user:super-secret");
  });

  it("fails dashboard check on non-200 API responses with repo-local dev guidance", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(["dashboard", "check"], {
      ...testContext(cwd),
      fetch: async () => new Response("fake unavailable", { status: 503 }),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout.join("\n")).toContain("API status: 503");
    expect(result.stderr.join("\n")).toContain("pnpm --filter @moneysiren/web dev");
    expect(result.stderr.join("\n")).toContain("pnpm --filter moneysiren dev -- dashboard check");
  });

  it("prints sanitized summary JSON from local normalized data", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));

    const syncResult = await runCli(["sync", "--provider", "mock"], testContext(cwd));
    const result = await runCli(["summary", "--json"], testContext(cwd, {
      OPENAI_ADMIN_KEY: "sk-fake-openai-admin-key",
      SLACK_WEBHOOK_URL: TEST_SLACK_WEBHOOK_URL,
    }));
    const stdout = result.stdout.join("\n");
    const parsed = JSON.parse(stdout) as {
      database: { available: boolean; path: string };
      secretsReturned: boolean;
      providerCount: number;
      providers: Array<Record<string, unknown>>;
      totals: { estimatedAmountMinorByCurrency: Array<{ currency: string; amountMinor: number }> };
    };

    expect(syncResult.exitCode).toBe(0);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toEqual([]);
    expect(parsed.database).toEqual({
      available: true,
      path: ".moneysiren/moneysiren.sqlite",
    });
    expect(parsed.secretsReturned).toBe(false);
    expect(parsed.providerCount).toBe(1);
    expect(parsed.providers[0]).toMatchObject({
      key: "mock",
      displayName: "Mock Provider",
      usageSnapshotCount: 1,
      billingSnapshotCount: 1,
      healthSnapshotCount: 1,
      costEstimateCount: 1,
      alertCount: 0,
    });
    expect(parsed.providers[0]).not.toHaveProperty("id");
    expect(parsed.providers[0]).not.toHaveProperty("providerAccountRef");
    expect(parsed).not.toHaveProperty("rawProviderPayloadsReturned");
    expect(parsed.totals.estimatedAmountMinorByCurrency).toEqual([
      {
        currency: "USD",
        amountMinor: 1500,
      },
    ]);
    expect(stdout).not.toMatch(FORBIDDEN_PERSISTED_PROVIDER_DATA_PATTERN);
    expect(stdout).not.toContain("sk-fake-openai-admin-key");
    expect(stdout).not.toContain(TEST_SLACK_WEBHOOK_URL);
  });

  it("previews sanitized notification digest output without sending Slack", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));

    const syncResult = await runCli(["sync", "--provider", "mock"], testContext(cwd));
    const result = await runCli(["notify", "once", "--dry-run"], testContext(cwd, {
      SLACK_WEBHOOK_URL: TEST_SLACK_WEBHOOK_URL,
    }));
    const stdout = result.stdout.join("\n");

    expect(syncResult.exitCode).toBe(0);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toEqual([]);
    expect(stdout).toContain("MoneySiren notification dry run");
    expect(stdout).toContain("Secrets returned: false");
    expect(stdout).toContain("Providers: 1");
    expect(stdout).toContain("Estimated total USD: 15.00");
    expect(stdout).not.toMatch(FORBIDDEN_PERSISTED_PROVIDER_DATA_PATTERN);
    expect(stdout).not.toContain(TEST_SLACK_WEBHOOK_URL);
  });

  it("lists default notification preferences without local API secrets", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(["notify", "prefs", "list"], testContext(cwd, {
      SLACK_WEBHOOK_URL: TEST_SLACK_WEBHOOK_URL,
    }));
    const stdout = result.stdout.join("\n");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toEqual([]);
    expect(stdout).toContain("MoneySiren notification preferences");
    expect(stdout).toContain("Source: default preference template");
    expect(stdout).toContain("Secrets returned: false");
    expect(stdout).toContain("HUD font size: 95%");
    expect(stdout).toContain("HUD opacity: 94%");
    expect(stdout).toContain("HUD widgets:");
    expect(stdout).toContain("Quiet hours: 22:00-08:00");
    expect(stdout).toContain("- openai_today_tokens: enabled");
    expect(stdout).toContain("- claude_five_hour_percent: disabled");
    expect(stdout).toContain("- risk_high_count: gte 1 cooldown 60m");
    expect(stdout).not.toContain(TEST_SLACK_WEBHOOK_URL);
  });

  it("updates persisted notification preferences from CLI prefs commands", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const env = {
      MONEYSIREN_NOTIFICATION_PREFS_PATH: "prefs/notifications.json",
      SLACK_WEBHOOK_URL: TEST_SLACK_WEBHOOK_URL,
    };

    const enable = await runCli(["notify", "prefs", "enable", "claude_five_hour_percent"], testContext(cwd, env));
    const disable = await runCli(["notify", "prefs", "disable", "openai_today_tokens"], testContext(cwd, env));
    const hudEnable = await runCli(["notify", "prefs", "hud-enable", "codex_weekly_percent"], testContext(cwd, env));
    const hudDisable = await runCli(["notify", "prefs", "hud-disable", "month_forecast"], testContext(cwd, env));
    const threshold = await runCli(
      ["notify", "prefs", "threshold", "claude_five_hour_percent", "--gte", "80", "--cooldown", "60"],
      testContext(cwd, env),
    );
    const quietHours = await runCli(["notify", "prefs", "quiet-hours", "21:30", "07:15"], testContext(cwd, env));
    const list = await runCli(["notify", "prefs", "list"], testContext(cwd, env));
    const preferences = JSON.parse(await readFile(join(cwd, "prefs", "notifications.json"), "utf8")) as {
      hud: { selectedWidgets: string[] };
      quietHours: { start: string; end: string };
      selectedWidgets: string[];
      thresholdRules: Array<{
        widgetKey: string;
        operator: string;
        value: number;
        cooldownMinutes: number;
      }>;
    };
    const allOutput = [
      ...enable.stdout,
      ...disable.stdout,
      ...hudEnable.stdout,
      ...hudDisable.stdout,
      ...threshold.stdout,
      ...quietHours.stdout,
      ...list.stdout,
      ...enable.stderr,
      ...disable.stderr,
      ...hudEnable.stderr,
      ...hudDisable.stderr,
      ...threshold.stderr,
      ...quietHours.stderr,
      ...list.stderr,
    ].join("\n");

    expect(enable.exitCode).toBe(0);
    expect(disable.exitCode).toBe(0);
    expect(hudEnable.exitCode).toBe(0);
    expect(hudDisable.exitCode).toBe(0);
    expect(threshold.exitCode).toBe(0);
    expect(quietHours.exitCode).toBe(0);
    expect(list.exitCode).toBe(0);
    expect(preferences.selectedWidgets).toContain("claude_five_hour_percent");
    expect(preferences.selectedWidgets).not.toContain("openai_today_tokens");
    expect(preferences.hud.selectedWidgets).toContain("codex_weekly_percent");
    expect(preferences.hud.selectedWidgets).not.toContain("month_forecast");
    expect(preferences.quietHours).toEqual({
      start: "21:30",
      end: "07:15",
    });
    expect(preferences.thresholdRules).toContainEqual({
      widgetKey: "claude_five_hour_percent",
      operator: "gte",
      value: 80,
      cooldownMinutes: 60,
    });
    expect(list.stdout.join("\n")).toContain("Source: local preference file");
    expect(list.stdout.join("\n")).toContain("- claude_five_hour_percent: enabled");
    expect(list.stdout.join("\n")).toContain("- openai_today_tokens: disabled");
    expect(list.stdout.join("\n")).toContain("HUD widgets:");
    expect(list.stdout.join("\n")).toContain("- codex_weekly_percent: enabled");
    expect(list.stdout.join("\n")).toContain("- month_forecast: disabled");
    expect(list.stdout.join("\n")).toContain("- claude_five_hour_percent: gte 80 cooldown 60m");
    expect(allOutput).not.toContain(TEST_SLACK_WEBHOOK_URL);
  });

  it("sends a sanitized notification test through the injected Slack transport", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const slackRequests: SlackReportTransportRequest[] = [];
    const result = await runCli(["notify", "test"], {
      ...testContext(cwd, {
        SLACK_WEBHOOK_URL: TEST_SLACK_WEBHOOK_URL,
      }),
      slackTransport: async (request) => {
        slackRequests.push(request);
        return {
          ok: true,
          status: 200,
          body: "ok",
        };
      },
    });
    const stdout = result.stdout.join("\n");
    const allOutput = [...result.stdout, ...result.stderr].join("\n");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toEqual([]);
    expect(slackRequests).toHaveLength(1);
    expect(slackRequests[0]?.webhookUrl).toBe(TEST_SLACK_WEBHOOK_URL);
    expect(slackRequests[0]?.payload.text).toContain("MoneySiren test notification");
    expect(slackRequests[0]?.payload.text).toContain("Secrets returned: false");
    expect(stdout).toContain("MoneySiren test notification sent");
    expect(allOutput).not.toContain(TEST_SLACK_WEBHOOK_URL);
  });

  it("routes serve, open, and desktop status through the runtime adapter boundary", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const runtime: LocalRuntime = {
      pid: 12345,
      port: 47831,
      baseUrl: "http://127.0.0.1:47831",
      startedAt: FIXED_NOW,
      version: CLI_VERSION,
    };
    const serveStarts: StartRuntimeOptions[] = [];
    const openStarts: StartRuntimeOptions[] = [];
    const openedUrls: string[] = [];
    const serveRuntime: CliLocalRuntimeAdapter = {
      async findRuntime() {
        return null;
      },
      async assertRuntimeHealthy() {
        return true;
      },
      async startRuntime(options) {
        serveStarts.push(options);
        return {
          status: "started",
          runtime,
        };
      },
    };
    const openRuntime: CliLocalRuntimeAdapter = {
      async findRuntime() {
        return null;
      },
      async assertRuntimeHealthy() {
        return true;
      },
      async startRuntime(options) {
        openStarts.push(options);
        return {
          status: "started",
          runtime,
        };
      },
    };
    const statusRuntime: CliLocalRuntimeAdapter = {
      async findRuntime() {
        return runtime;
      },
      async assertRuntimeHealthy() {
        return true;
      },
      async startRuntime() {
        return {
          status: "running",
          runtime,
        };
      },
    };
    const missingRuntime: CliLocalRuntimeAdapter = {
      async findRuntime() {
        return null;
      },
      async assertRuntimeHealthy() {
        return false;
      },
      async startRuntime() {
        return {
          status: "running",
          runtime,
        };
      },
    };

    const serve = await runCli(["serve", "--port", "47831"], {
      ...testContext(cwd),
      localRuntime: serveRuntime,
    });
    const open = await runCli(["open"], {
      ...testContext(cwd),
      localRuntime: openRuntime,
      openUrl: (url) => {
        openedUrls.push(url);
      },
    });
    const status = await runCli(["desktop", "status"], {
      ...testContext(cwd),
      localRuntime: statusRuntime,
    });
    const missingStatus = await runCli(["desktop", "status"], {
      ...testContext(cwd),
      localRuntime: missingRuntime,
    });

    expect(serve.exitCode).toBe(0);
    expect(serveStarts).toEqual([
      {
        headless: false,
        port: 47831,
      },
    ]);
    expect(serve.stdout.join("\n")).toContain("Base URL: http://127.0.0.1:47831");
    expect(open.exitCode).toBe(0);
    expect(openStarts).toEqual([
      {
        headless: true,
      },
    ]);
    expect(openedUrls).toEqual([]);
    expect(open.stdout.join("\n")).toContain("MoneySiren local API runtime ready");
    expect(open.stdout.join("\n")).toContain("Local API URL: http://127.0.0.1:47831");
    expect(open.stdout.join("\n")).toContain("Dashboard UI: not opened because this runtime URL is a JSON API.");
    expect(open.stdout.join("\n")).not.toContain("MoneySiren dashboard opened");
    expect(open.stdout.join("\n")).not.toContain("Dashboard URL: http://127.0.0.1:47831");
    expect(status.exitCode).toBe(0);
    expect(status.stdout.join("\n")).toContain("Runtime: healthy");
    expect(status.stdout.join("\n")).toContain("Desktop shell: not detected by CLI");
    expect(missingStatus.exitCode).toBe(0);
    expect(missingStatus.stdout.join("\n")).toContain("Runtime: not running");
    expect(missingStatus.stdout.join("\n")).toContain("Runtime lock: not found");
    expect(missingStatus.stdout.join("\n")).toContain("run `moneysiren serve`");
    expect(missingStatus.stdout.join("\n")).not.toContain("pending packages/runtime integration");
  });

  it("routes deployed start and hud commands through the desktop runtime adapter", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const webStarts: Array<{ openBrowser: boolean; port?: number }> = [];
    const hudStarts: Array<{ port?: number }> = [];
    const openedUrls: string[] = [];
    const desktopRuntime: CliDesktopRuntimeAdapter = {
      async startWebRuntime(options) {
        webStarts.push(options);
        return {
          status: "started",
          dashboardUrl: `http://127.0.0.1:${options.port ?? 3000}/ko/dashboard/overview`,
          pid: 321,
          notes: ["test web runtime"],
        };
      },
      async startHud(options) {
        hudStarts.push(options);
        return {
          status: "started",
          executablePath: "C:\\fake\\MoneySiren Tray.exe",
          pid: 322,
          notes: ["test hud"],
        };
      },
    };

    const start = await runCli(["start", "--port", "3001"], {
      ...testContext(cwd),
      desktopRuntime,
      openUrl: (url) => {
        openedUrls.push(url);
      },
    });
    const startHud = await runCli(["start", "--no-open", "--hud"], {
      ...testContext(cwd),
      desktopRuntime,
      openUrl: (url) => {
        openedUrls.push(url);
      },
    });
    const hud = await runCli(["hud", "--port=3002"], {
      ...testContext(cwd),
      desktopRuntime,
    });

    expect(start.exitCode).toBe(0);
    expect(start.stdout.join("\n")).toContain("MoneySiren dashboard runtime");
    expect(start.stdout.join("\n")).toContain("Dashboard URL: http://127.0.0.1:3001/ko/dashboard/overview");
    expect(start.stdout.join("\n")).toContain("HUD: run `msiren hud`");
    expect(startHud.exitCode).toBe(0);
    expect(startHud.stdout.join("\n")).toContain("MoneySiren HUD");
    expect(hud.exitCode).toBe(0);
    expect(hud.stdout.join("\n")).toContain("Desktop shell: started");
    expect(webStarts).toEqual([
      {
        openBrowser: true,
        port: 3001,
      },
      {
        openBrowser: false,
      },
      {
        openBrowser: false,
        port: 3002,
      },
    ]);
    expect(hudStarts).toEqual([
      {},
      {
        port: 3002,
      },
    ]);
    expect(openedUrls).toEqual(["http://127.0.0.1:3001/ko/dashboard/overview"]);
  });

  it("syncs the mock provider and renders a Korean daily report from persisted normalized data", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));

    const syncResult = await runCli(["sync", "--provider", "mock"], testContext(cwd));
    expect(syncResult.exitCode).toBe(0);
    expect(syncResult.stdout.join("\n")).toContain("Synced mock provider snapshots");

    const reportResult = await runCli(["report", "daily", "--lang", "ko"], testContext(cwd));
    const reportText = reportResult.stdout.join("\n");

    expect(reportResult.exitCode).toBe(0);
    expect(reportText).toContain("MoneySiren 일일 리포트");
    expect(reportText).toContain("Mock Provider");
    expect(reportText).toContain("- 예상 비용 USD 15.00");
    expect(reportText).not.toContain("예상 비용: USD 15.00");

    const dbPath = join(cwd, ".moneysiren", "moneysiren.sqlite");
    const counts = querySqlite<{
      providers: number;
      usage_snapshots: number;
      billing_snapshots: number;
      service_health_snapshots: number;
      cost_estimates: number;
      alerts: number;
      report_runs: number;
    }>(
      dbPath,
      `
      SELECT
        (SELECT count(*) FROM providers) AS providers,
        (SELECT count(*) FROM usage_snapshots) AS usage_snapshots,
        (SELECT count(*) FROM billing_snapshots) AS billing_snapshots,
        (SELECT count(*) FROM service_health_snapshots) AS service_health_snapshots,
        (SELECT count(*) FROM cost_estimates) AS cost_estimates,
        (SELECT count(*) FROM alerts) AS alerts,
        (SELECT count(*) FROM report_runs) AS report_runs;
      `,
    )[0];
    const persistedText = dumpPersistedProviderDataText(dbPath);

    expect(counts).toEqual({
      providers: 1,
      usage_snapshots: 1,
      billing_snapshots: 1,
      service_health_snapshots: 1,
      cost_estimates: 1,
      alerts: 0,
      report_runs: 1,
    });
    expect(persistedText).not.toContain("sqlite-placeholder-v1");
    expect(persistedText).not.toMatch(/rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@/i);
  }, 15000);

  it("uses the Asia/Seoul calendar date for Korean daily reports", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(["report", "daily", "--lang", "ko"], {
      ...testContext(cwd),
      now: () => new Date("2026-06-01T15:30:00.000Z"),
    });
    const stdout = result.stdout.join("\n");

    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("2026-06-02");

    const dbPath = join(cwd, ".moneysiren", "moneysiren.sqlite");
    const reportRuns = querySqlite<{ report_date: string; created_at: string }>(
      dbPath,
      "SELECT report_date, created_at FROM report_runs ORDER BY created_at, id;",
    );

    expect(reportRuns).toEqual([
      {
        report_date: "2026-06-02",
        created_at: "2026-06-01T15:30:00.000Z",
      },
    ]);
  });

  it("sends the Korean daily report to Slack with an injected transport and records delivery status", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const slackRequests: SlackReportTransportRequest[] = [];

    const syncResult = await runCli(["sync", "--provider", "mock"], testContext(cwd));
    expect(syncResult.exitCode).toBe(0);

    const reportResult = await runCli(
      ["report", "daily", "--lang", "ko", "--send", "slack"],
      {
        ...testContext(cwd, {
          SLACK_WEBHOOK_URL: TEST_SLACK_WEBHOOK_URL,
        }),
        slackTransport: async (request) => {
          slackRequests.push(request);
          return {
            ok: true,
            status: 200,
            body: "ok",
          };
        },
      },
    );
    const stdout = reportResult.stdout.join("\n");

    expect(reportResult.exitCode).toBe(0);
    expect(stdout).toContain("Slack report sent");
    expect(stdout).not.toContain(TEST_SLACK_WEBHOOK_URL);
    expect(slackRequests).toHaveLength(1);
    expect(slackRequests[0]?.payload.text).toContain("*MoneySiren 일일 리포트*");
    expect(slackRequests[0]?.payload.text).toContain("---");
    expect(slackRequests[0]?.payload.text).toContain("- 예상 비용 USD 15.00");
    expect(slackRequests[0]?.payload.text).not.toContain("동기화 상태:");

    const dbPath = join(cwd, ".moneysiren", "moneysiren.sqlite");
    const reportRuns = querySqlite<{ delivery_target: string; status: string }>(
      dbPath,
      "SELECT delivery_target, status FROM report_runs ORDER BY created_at, id;",
    );
    const persistedText = dumpPersistedProviderDataText(dbPath);

    expect(reportRuns).toEqual([
      {
        delivery_target: "slack",
        status: "sent",
      },
    ]);
    expect(persistedText).not.toContain(TEST_SLACK_WEBHOOK_URL);
    expect(persistedText).not.toMatch(/hooks\.slack|sk-|@/i);
  });

  it("fails Slack report delivery gracefully without SLACK_WEBHOOK_URL and records error status", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));

    const reportResult = await runCli(["report", "daily", "--lang", "ko", "--send", "slack"], testContext(cwd));
    const stderr = reportResult.stderr.join("\n");

    expect(reportResult.exitCode).toBe(1);
    expect(stderr).toContain("SLACK_WEBHOOK_URL");
    expect(stderr).not.toMatch(/https?:\/\//i);

    const dbPath = join(cwd, ".moneysiren", "moneysiren.sqlite");
    const reportRuns = querySqlite<{ delivery_target: string; status: string }>(
      dbPath,
      "SELECT delivery_target, status FROM report_runs ORDER BY created_at, id;",
    );
    const persistedText = dumpPersistedProviderDataText(dbPath);

    expect(reportRuns).toEqual([
      {
        delivery_target: "slack",
        status: "error",
      },
    ]);
    expect(persistedText).not.toMatch(/hooks\.slack|fake-moneysiren-slack-webhook-secret|sk-|@/i);
  });

  it("fails AWS sync gracefully without credentials or fixture mode", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(["sync", "--provider", "aws"], testContext(cwd));

    expect(result.exitCode).toBe(1);
    expect(result.stderr.join("\n")).toContain("AWS_PROFILE");
    expect(result.stderr.join("\n")).toContain("--profile <profile>");
    expect(result.stderr.join("\n")).toContain("MONEYSIREN_AWS_COST_EXPLORER_FIXTURE");
    expect(await fileExists(join(cwd, ".env"))).toBe(false);
    expect(await fileExists(join(cwd, ".moneysiren", "moneysiren.sqlite"))).toBe(false);
  });

  it("syncs AWS with an explicit profile flag without requiring AWS_PROFILE in the shell", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const awsFixture = JSON.parse(await readFile(AWS_FIXTURE_PATH, "utf8"));
    const sentCommands: string[] = [];
    const result = await runCli(["sync", "--provider", "aws", "--profile", "fake-moneysiren-live-profile"], {
      ...testContext(cwd),
      liveClients: {
        awsCostExplorer: {
          async send(command) {
            sentCommands.push(command.name);
            return awsFixture;
          },
        },
      },
    });

    const dbPath = join(cwd, ".moneysiren", "moneysiren.sqlite");
    const counts = querySqlite<{ providers: number; usage_snapshots: number; cost_estimates: number }>(
      dbPath,
      `
      SELECT
        (SELECT count(*) FROM providers) AS providers,
        (SELECT count(*) FROM usage_snapshots) AS usage_snapshots,
        (SELECT count(*) FROM cost_estimates) AS cost_estimates;
      `,
    )[0];

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toEqual([]);
    expect(sentCommands).toEqual(["GetCostAndUsage"]);
    expect(counts).toEqual({
      providers: 1,
      usage_snapshots: 4,
      cost_estimates: 1,
    });
  });

  it("records sanitized AWS Cost Explorer failures and exits non-zero", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const fakeAccessKeyId = "AKIA" + "ABCDEFGHIJKLMNOP";
    const result = await runCli(["sync", "--provider", "aws"], {
      ...testContext(cwd, {
        AWS_PROFILE: "fake-moneysiren-live-profile",
      }),
      liveClients: {
        awsCostExplorer: {
          async send() {
            throw new Error(
              `Token is expired for arn:aws:iam::123456789012:role/Admin using ${fakeAccessKeyId}`,
            );
          },
        },
      },
    });
    const dbPath = join(cwd, ".moneysiren", "moneysiren.sqlite");
    const alerts = querySqlite<{ severity: string; title: string; message: string }>(
      dbPath,
      "SELECT severity, title, message FROM alerts;",
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout.join("\n")).toContain("Synced AWS Cost Explorer snapshots");
    expect(result.stderr.join("\n")).toContain("Token is expired");
    expect(result.stderr.join("\n")).not.toContain(fakeAccessKeyId);
    expect(result.stderr.join("\n")).not.toMatch(/arn:aws|\b\d{12}\b/i);
    expect(alerts).toEqual([
      {
        severity: "warning",
        title: "AWS Cost Explorer sync failed",
        message: expect.stringContaining("Token is expired"),
      },
    ]);
    expect(JSON.stringify(alerts)).not.toContain(fakeAccessKeyId);
    expect(JSON.stringify(alerts)).not.toMatch(/arn:aws|\b\d{12}\b/i);
  });

  it("fails OpenAI sync gracefully without admin key or fixture mode", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(["sync", "--provider", "openai"], testContext(cwd));

    expect(result.exitCode).toBe(1);
    expect(result.stderr.join("\n")).toContain("OPENAI_ADMIN_KEY");
    expect(result.stderr.join("\n")).toContain("MONEYSIREN_OPENAI_USAGE_FIXTURE");
    expect(result.stderr.join("\n")).toContain("MONEYSIREN_OPENAI_COSTS_FIXTURE");
    expect(await fileExists(join(cwd, ".env"))).toBe(false);
    expect(await fileExists(join(cwd, ".moneysiren", "moneysiren.sqlite"))).toBe(false);
  });

  it("fails Supabase sync gracefully without access token or fixture mode", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(["sync", "--provider", "supabase"], testContext(cwd));

    expect(result.exitCode).toBe(1);
    expect(result.stderr.join("\n")).toContain("SUPABASE_ACCESS_TOKEN");
    expect(result.stderr.join("\n")).toContain("MONEYSIREN_SUPABASE_FIXTURE");
    expect(await fileExists(join(cwd, ".env"))).toBe(false);
    expect(await fileExists(join(cwd, ".moneysiren", "moneysiren.sqlite"))).toBe(false);
  });

  it("fails Cloudflare sync gracefully without API token or fixture mode", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(["sync", "--provider", "cloudflare"], testContext(cwd));

    expect(result.exitCode).toBe(1);
    expect(result.stderr.join("\n")).toContain("CLOUDFLARE_API_TOKEN");
    expect(result.stderr.join("\n")).toContain("CLOUDFLARE_ACCOUNT_IDS");
    expect(result.stderr.join("\n")).toContain("MONEYSIREN_CLOUDFLARE_FIXTURE");
    expect(await fileExists(join(cwd, ".env"))).toBe(false);
    expect(await fileExists(join(cwd, ".moneysiren", "moneysiren.sqlite"))).toBe(false);
  });

  it("syncs live read-only client paths without fixture env or persisted credentials", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const awsFixture = JSON.parse(await readFile(AWS_FIXTURE_PATH, "utf8"));
    const openAiFixture = JSON.parse(await readFile(OPENAI_FIXTURE_PATH, "utf8"));
    const supabaseFixture = JSON.parse(await readFile(SUPABASE_FIXTURE_PATH, "utf8"));
    const cloudflareFixture = JSON.parse(await readFile(CLOUDFLARE_FIXTURE_PATH, "utf8"));
    const awsCommands: string[] = [];

    const aws = await runCli(["sync", "--provider", "aws"], {
      ...testContext(cwd, {
        AWS_PROFILE: "fake-moneysiren-live-profile",
      }),
      liveClients: {
        awsCostExplorer: {
          async send(command) {
            awsCommands.push(command.name);
            return awsFixture;
          },
        },
      },
    });
    const openai = await runCli(["sync", "--provider", "openai"], {
      ...testContext(cwd, {
        OPENAI_ADMIN_KEY: "sk-fake-openai-admin-key",
      }),
      liveClients: {
        openaiUsageCosts: {
          async fetchUsageCosts() {
            return openAiFixture;
          },
        },
      },
    });
    const supabase = await runCli(["sync", "--provider", "supabase"], {
      ...testContext(cwd, {
        SUPABASE_ACCESS_TOKEN: "sbp_fake_supabase_token",
      }),
      liveClients: {
        supabaseUsageHealth: {
          async fetchUsageHealth() {
            return supabaseFixture;
          },
        },
      },
    });
    const cloudflare = await runCli(["sync", "--provider", "cloudflare"], {
      ...testContext(cwd, {
        CLOUDFLARE_API_TOKEN: "fake-cloudflare-token",
        CLOUDFLARE_ACCOUNT_IDS: "fake-cloudflare-account-alpha",
      }),
      liveClients: {
        cloudflareBillingUsage: {
          async fetchBillingUsage() {
            return cloudflareFixture;
          },
        },
      },
    });

    expect(aws.exitCode).toBe(0);
    expect(openai.exitCode).toBe(0);
    expect(supabase.exitCode).toBe(0);
    expect(cloudflare.exitCode).toBe(0);
    expect(awsCommands).toEqual(["GetCostAndUsage"]);

    const dbPath = join(cwd, ".moneysiren", "moneysiren.sqlite");
    const providers = querySqlite<{ provider_key: string }>(
      dbPath,
      "SELECT provider_key FROM providers ORDER BY provider_key;",
    );
    const persistedProviderDataText = dumpPersistedProviderDataText(dbPath);

    expect(providers.map((provider) => provider.provider_key)).toEqual([
      "aws",
      "cloudflare",
      "openai",
      "supabase",
    ]);
    expect(persistedProviderDataText).not.toContain("fake-moneysiren-live-profile");
    expect(persistedProviderDataText).not.toContain("sk-fake-openai-admin-key");
    expect(persistedProviderDataText).not.toContain("sbp_fake_supabase_token");
    expect(persistedProviderDataText).not.toContain("fake-cloudflare-token");
    expect(persistedProviderDataText).not.toContain("fake-cloudflare-account-alpha");
    expect(persistedProviderDataText).not.toMatch(FORBIDDEN_PERSISTED_PROVIDER_DATA_PATTERN);
  });

  it("syncs AWS Cost Explorer from fixture mode without credentials or raw AWS persistence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(
      ["sync", "--provider", "aws"],
      testContext(cwd, {
        MONEYSIREN_AWS_COST_EXPLORER_FIXTURE: AWS_FIXTURE_PATH,
      }),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.join("\n")).toContain("Synced AWS Cost Explorer snapshots");

    const dbPath = join(cwd, ".moneysiren", "moneysiren.sqlite");
    const counts = querySqlite<{
      providers: number;
      usage_snapshots: number;
      billing_snapshots: number;
      service_health_snapshots: number;
      cost_estimates: number;
      alerts: number;
    }>(
      dbPath,
      `
      SELECT
        (SELECT count(*) FROM providers) AS providers,
        (SELECT count(*) FROM usage_snapshots) AS usage_snapshots,
        (SELECT count(*) FROM billing_snapshots) AS billing_snapshots,
        (SELECT count(*) FROM service_health_snapshots) AS service_health_snapshots,
        (SELECT count(*) FROM cost_estimates) AS cost_estimates,
        (SELECT count(*) FROM alerts) AS alerts;
      `,
    )[0];
    const serviceCosts = querySqlite<{ service: string; metric: string; unit: string; value: number }>(
      dbPath,
      `
      SELECT service, metric, unit, value
      FROM usage_snapshots
      ORDER BY value DESC, service;
      `,
    );
    const persistedProviderDataText = dumpPersistedProviderDataText(dbPath);

    expect(counts).toEqual({
      providers: 1,
      usage_snapshots: 4,
      billing_snapshots: 1,
      service_health_snapshots: 0,
      cost_estimates: 1,
      alerts: 0,
    });
    expect(serviceCosts).toEqual([
      {
        service: "Amazon Elastic Compute Cloud - Compute",
        metric: "unblended_cost",
        unit: "USD",
        value: 7.12,
      },
      {
        service: "Amazon Simple Storage Service",
        metric: "unblended_cost",
        unit: "USD",
        value: 3.34,
      },
      {
        service: "AWS Lambda",
        metric: "unblended_cost",
        unit: "USD",
        value: 1,
      },
      {
        service: "Amazon CloudWatch",
        metric: "unblended_cost",
        unit: "USD",
        value: 0.88,
      },
    ]);
    expect(persistedProviderDataText).not.toMatch(FORBIDDEN_PERSISTED_PROVIDER_DATA_PATTERN);
  });

  it("syncs OpenAI usage and costs from fixture mode without credentials or raw OpenAI persistence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(
      ["sync", "--provider", "openai"],
      testContext(cwd, {
        MONEYSIREN_OPENAI_USAGE_FIXTURE: OPENAI_FIXTURE_PATH,
        MONEYSIREN_OPENAI_COSTS_FIXTURE: OPENAI_FIXTURE_PATH,
      }),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.join("\n")).toContain("Synced OpenAI usage and costs snapshots");

    const dbPath = join(cwd, ".moneysiren", "moneysiren.sqlite");
    const counts = querySqlite<{
      providers: number;
      usage_snapshots: number;
      billing_snapshots: number;
      service_health_snapshots: number;
      cost_estimates: number;
      alerts: number;
    }>(
      dbPath,
      `
      SELECT
        (SELECT count(*) FROM providers) AS providers,
        (SELECT count(*) FROM usage_snapshots) AS usage_snapshots,
        (SELECT count(*) FROM billing_snapshots) AS billing_snapshots,
        (SELECT count(*) FROM service_health_snapshots) AS service_health_snapshots,
        (SELECT count(*) FROM cost_estimates) AS cost_estimates,
        (SELECT count(*) FROM alerts) AS alerts;
      `,
    )[0];
    const usage = querySqlite<{ service: string; metric: string; unit: string; value: number }>(
      dbPath,
      `
      SELECT service, metric, unit, value
      FROM usage_snapshots
      ORDER BY service, metric;
      `,
    );
    const billing = querySqlite<{ amount_minor: number; currency: string; status: string }>(
      dbPath,
      `
      SELECT amount_minor, currency, status
      FROM billing_snapshots;
      `,
    );
    const persistedProviderDataText = dumpPersistedProviderDataText(dbPath);

    expect(counts).toEqual({
      providers: 1,
      usage_snapshots: 5,
      billing_snapshots: 1,
      service_health_snapshots: 0,
      cost_estimates: 1,
      alerts: 0,
    });
    expect(usage).toEqual([
      {
        service: "completions:gpt-4.1-mini",
        metric: "input_tokens",
        unit: "tokens",
        value: 2000000,
      },
      {
        service: "completions:gpt-4.1-mini",
        metric: "model_requests",
        unit: "requests",
        value: 420,
      },
      {
        service: "completions:gpt-4.1-mini",
        metric: "output_tokens",
        unit: "tokens",
        value: 150000,
      },
      {
        service: "embeddings:text-embedding-3-small",
        metric: "input_tokens",
        unit: "tokens",
        value: 500000,
      },
      {
        service: "embeddings:text-embedding-3-small",
        metric: "model_requests",
        unit: "requests",
        value: 80,
      },
    ]);
    expect(billing).toEqual([
      {
        amount_minor: 1300,
        currency: "USD",
        status: "estimated",
      },
    ]);
    expect(persistedProviderDataText).not.toMatch(FORBIDDEN_PERSISTED_PROVIDER_DATA_PATTERN);
  });

  it("syncs Supabase usage and health from fixture mode without credentials or raw Supabase persistence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(
      ["sync", "--provider", "supabase"],
      testContext(cwd, {
        MONEYSIREN_SUPABASE_FIXTURE: SUPABASE_FIXTURE_PATH,
      }),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.join("\n")).toContain("Synced Supabase usage and health snapshots");

    const dbPath = join(cwd, ".moneysiren", "moneysiren.sqlite");
    const counts = querySqlite<{
      providers: number;
      provider_accounts: number;
      usage_snapshots: number;
      billing_snapshots: number;
      service_health_snapshots: number;
      cost_estimates: number;
      alerts: number;
    }>(
      dbPath,
      `
      SELECT
        (SELECT count(*) FROM providers) AS providers,
        (SELECT count(*) FROM provider_accounts) AS provider_accounts,
        (SELECT count(*) FROM usage_snapshots) AS usage_snapshots,
        (SELECT count(*) FROM billing_snapshots) AS billing_snapshots,
        (SELECT count(*) FROM service_health_snapshots) AS service_health_snapshots,
        (SELECT count(*) FROM cost_estimates) AS cost_estimates,
        (SELECT count(*) FROM alerts) AS alerts;
      `,
    )[0];
    const usage = querySqlite<{ service: string; metric: string; unit: string; value: number }>(
      dbPath,
      `
      SELECT service, metric, unit, value
      FROM usage_snapshots
      ORDER BY value DESC, metric;
      `,
    );
    const health = querySqlite<{ service: string; region: string | null; status: string; message: string | null }>(
      dbPath,
      `
      SELECT service, region, status, message
      FROM service_health_snapshots
      ORDER BY service, status;
      `,
    );
    const persistedProviderDataText = dumpPersistedProviderDataText(dbPath);

    expect(counts).toEqual({
      providers: 1,
      provider_accounts: 2,
      usage_snapshots: 8,
      billing_snapshots: 0,
      service_health_snapshots: 5,
      cost_estimates: 0,
      alerts: 1,
    });
    expect(usage.map(({ metric, unit, value }) => ({ metric, unit, value }))).toEqual([
      {
        metric: "api_requests",
        unit: "requests",
        value: 5082,
      },
      {
        metric: "rest_requests",
        unit: "requests",
        value: 3400,
      },
      {
        metric: "auth_requests",
        unit: "requests",
        value: 1200,
      },
      {
        metric: "storage_requests",
        unit: "requests",
        value: 450,
      },
      {
        metric: "realtime_requests",
        unit: "requests",
        value: 32,
      },
      {
        metric: "api_requests",
        unit: "requests",
        value: 11,
      },
      {
        metric: "rest_requests",
        unit: "requests",
        value: 10,
      },
      {
        metric: "storage_requests",
        unit: "requests",
        value: 1,
      },
    ]);
    expect(health.map(({ region, status, message }) => ({ region, status, message }))).toEqual(
      expect.arrayContaining([
        {
          region: "ap-northeast-2",
          status: "degraded",
          message: "FAKE degraded fixture message",
        },
        {
          region: "ap-northeast-2",
          status: "ok",
          message: null,
        },
        {
          region: "us-east-1",
          status: "degraded",
          message: "Project is paused.",
        },
      ]),
    );
    expect(persistedProviderDataText).not.toMatch(FORBIDDEN_PERSISTED_PROVIDER_DATA_PATTERN);
    expect(persistedProviderDataText).not.toMatch(/fake-supabase-ref|fake-supabase-org|FAKE MoneySiren/i);
  });

  it("syncs Cloudflare billing and usage from fixture mode without credentials or raw Cloudflare persistence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-cli-"));
    const result = await runCli(
      ["sync", "--provider", "cloudflare"],
      testContext(cwd, {
        MONEYSIREN_CLOUDFLARE_FIXTURE: CLOUDFLARE_FIXTURE_PATH,
      }),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.join("\n")).toContain("Synced Cloudflare billing and usage snapshots");

    const dbPath = join(cwd, ".moneysiren", "moneysiren.sqlite");
    const counts = querySqlite<{
      providers: number;
      provider_accounts: number;
      usage_snapshots: number;
      billing_snapshots: number;
      service_health_snapshots: number;
      cost_estimates: number;
      alerts: number;
    }>(
      dbPath,
      `
      SELECT
        (SELECT count(*) FROM providers) AS providers,
        (SELECT count(*) FROM provider_accounts) AS provider_accounts,
        (SELECT count(*) FROM usage_snapshots) AS usage_snapshots,
        (SELECT count(*) FROM billing_snapshots) AS billing_snapshots,
        (SELECT count(*) FROM service_health_snapshots) AS service_health_snapshots,
        (SELECT count(*) FROM cost_estimates) AS cost_estimates,
        (SELECT count(*) FROM alerts) AS alerts;
      `,
    )[0];
    const usage = querySqlite<{ service: string; metric: string; unit: string; value: number }>(
      dbPath,
      `
      SELECT service, metric, unit, value
      FROM usage_snapshots
      ORDER BY service, metric;
      `,
    );
    const billing = querySqlite<{ amount_minor: number; currency: string; status: string }>(
      dbPath,
      `
      SELECT amount_minor, currency, status
      FROM billing_snapshots;
      `,
    );
    const health = querySqlite<{ service: string; status: string; message: string | null }>(
      dbPath,
      `
      SELECT service, status, message
      FROM service_health_snapshots
      ORDER BY service;
      `,
    );
    const alerts = querySqlite<{ severity: string; title: string; message: string }>(
      dbPath,
      `
      SELECT severity, title, message
      FROM alerts;
      `,
    );
    const persistedProviderDataText = dumpPersistedProviderDataText(dbPath);

    expect(counts).toEqual({
      providers: 1,
      provider_accounts: 1,
      usage_snapshots: 2,
      billing_snapshots: 1,
      service_health_snapshots: 2,
      cost_estimates: 1,
      alerts: 1,
    });
    expect(usage.map(({ metric, unit, value }) => ({ metric, unit, value }))).toEqual([
      {
        metric: "billable_quantity",
        unit: "GB",
        value: 128.5,
      },
      {
        metric: "billable_quantity",
        unit: "requests",
        value: 2500,
      },
    ]);
    expect(billing).toEqual([
      {
        amount_minor: 1236,
        currency: "USD",
        status: "estimated",
      },
    ]);
    expect(health.map(({ status, message }) => ({ status, message }))).toEqual([
      {
        status: "degraded",
        message: "Cloudflare billing usage API unavailable for this account.",
      },
      {
        status: "ok",
        message: "Cloudflare billing usage API available.",
      },
    ]);
    expect(alerts).toEqual([
      {
        severity: "warning",
        title: "Cloudflare billable usage surface unavailable",
        message: "Cloudflare billable usage API was restricted or unavailable; normalized sync continued with available data.",
      },
    ]);
    expect(persistedProviderDataText).not.toMatch(FORBIDDEN_PERSISTED_PROVIDER_DATA_PATTERN);
    expect(persistedProviderDataText).not.toMatch(/FAKE MoneySiren|FAKE Restricted|FAKE Subscription/i);
  });
});

type SqliteValueRow = Record<string, string | number | null>;

function querySqlite<T>(dbPath: string, sql: string): T[] {
  const nodeSqlite = requireNodeModule("node:sqlite") as {
    DatabaseSync: new (path: string) => NodeSqliteDatabase;
  };
  const database = new nodeSqlite.DatabaseSync(dbPath);

  try {
    return database.prepare(sql).all() as T[];
  } finally {
    database.close();
  }
}

function dumpPersistedProviderDataText(dbPath: string): string {
  const rows: SqliteValueRow[] = [
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT provider_key, display_name, connector_version FROM providers ORDER BY provider_key;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT account_label, account_ref FROM provider_accounts ORDER BY account_label, account_ref;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT service, metric, unit, metadata_json FROM usage_snapshots ORDER BY service, metric, unit;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT currency, status, metadata_json FROM billing_snapshots ORDER BY currency, status;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT service, region, status, message, metadata_json FROM service_health_snapshots ORDER BY service, status;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT currency, confidence, metadata_json FROM cost_estimates ORDER BY currency, confidence;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT severity, category, title, message, metadata_json FROM alerts ORDER BY severity, category, title;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT language, delivery_target, status, metadata_json FROM report_runs ORDER BY language, delivery_target, status;",
    ),
  ];

  return rows
    .flatMap((row) => Object.values(row).filter((value): value is string => typeof value === "string"))
    .join("\n");
}

function testContext(cwd: string, env: Record<string, string | undefined> = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    cwd,
    env,
    now: () => new Date(FIXED_NOW),
    stdout: (line: string) => stdout.push(line),
    stderr: (line: string) => stderr.push(line),
    stdoutBuffer: stdout,
    stderrBuffer: stderr,
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function testSha256(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

interface NodeSqliteDatabase {
  prepare(sql: string): {
    all(): unknown[];
  };
  close(): void;
}
