import { mkdir, mkdtemp, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildWindowsLocalToolPath,
  readAwsLocalSetupStatus,
  readGcpLocalSetupStatus,
  readLocalAiCliStatus,
  setAwsProfileGlobally,
  type LocalCommandRunner,
} from "./local-tools";

describe("local tool status", () => {
  it("adds common Windows CLI shim locations without duplicating PATH entries", () => {
    const path = buildWindowsLocalToolPath("C:\\Windows\\System32;C:\\nvm4w\\nodejs\\", {
      APPDATA: "C:\\Users\\developer\\AppData\\Roaming",
      LOCALAPPDATA: "C:\\Users\\developer\\AppData\\Local",
      NVM_HOME: "C:\\Users\\developer\\AppData\\Local\\nvm",
      NVM_SYMLINK: "C:\\nvm4w\\nodejs",
      VOLTA_HOME: "C:\\Users\\developer\\AppData\\Local\\Volta",
      SCOOP: "C:\\Users\\developer\\scoop",
      ChocolateyInstall: "C:\\ProgramData\\chocolatey",
      ProgramData: "C:\\ProgramData",
      ProgramFiles: "C:\\Program Files",
      "ProgramFiles(x86)": "C:\\Program Files (x86)",
      USERPROFILE: "C:\\Users\\developer",
    }, "C:\\nvm4w\\nodejs\\node.exe");
    const segments = path.split(";");

    expect(segments.filter((segment) => segment.toLowerCase().replace(/[\\/]+$/, "") === "c:\\nvm4w\\nodejs")).toHaveLength(1);
    expect(segments).toContain("C:\\Users\\developer\\AppData\\Roaming\\npm");
    expect(segments).toContain("C:\\Users\\developer\\AppData\\Local\\pnpm");
    expect(segments).toContain("C:\\Users\\developer\\AppData\\Local\\Volta\\bin");
    expect(segments).toContain("C:\\Users\\developer\\scoop\\shims");
    expect(segments).toContain("C:\\ProgramData\\chocolatey\\bin");
    expect(segments).toContain("C:\\Users\\developer\\.bun\\bin");
    expect(segments).toContain("C:\\Users\\developer\\AppData\\Local\\Microsoft\\WindowsApps");
    expect(segments).toContain("C:\\Program Files\\Amazon\\AWSCLIV2");
    expect(segments).toContain("C:\\Program Files\\Google\\Cloud SDK\\google-cloud-sdk\\bin");
  });

  it("detects an installed AWS CLI without returning secrets", async () => {
    const status = await readAwsLocalSetupStatus({
      env: {
        AWS_PROFILE: "stackspend-readonly",
      },
      now: () => new Date("2026-06-09T00:00:00.000Z"),
      runCommand: async (_file, _args, options) => {
        expect(options.timeout).toBe(10_000);

        return {
          stdout: "aws-cli/2.27.41 Python/3.11.6 Windows/10 exe/AMD64 prompt/off",
        };
      },
    });

    expect(status).toMatchObject({
      generatedAt: "2026-06-09T00:00:00.000Z",
      localOnly: true,
      secretsReturned: false,
      awsCli: {
        state: "installed",
        version: "2.27.41",
      },
      credentialChain: {
        state: "configured",
        source: "AWS_PROFILE",
        profileName: "stackspend-readonly",
      },
    });
    expect(JSON.stringify(status)).not.toContain("AWS_SECRET_ACCESS_KEY");
  });

  it("reports missing AWS CLI and keeps credential material out of the payload", async () => {
    const missingRunner: LocalCommandRunner = async () => {
      const error = new Error("spawn aws ENOENT") as Error & { code: string };
      error.code = "ENOENT";
      throw error;
    };

    const status = await readAwsLocalSetupStatus({
      env: {
        AWS_ACCESS_KEY_ID: "FAKE_ACCESS_KEY_FOR_TESTS",
        AWS_SECRET_ACCESS_KEY: "FAKE_SECRET_KEY_FOR_TESTS",
      },
      runCommand: missingRunner,
    });

    expect(status.awsCli).toMatchObject({
      state: "missing",
      version: null,
    });
    expect(status.credentialChain).toMatchObject({
      state: "configured",
      source: "access_key_env",
      profileName: null,
    });
    expect(JSON.stringify(status)).not.toContain("FAKE_ACCESS_KEY_FOR_TESTS");
    expect(JSON.stringify(status)).not.toContain("FAKE_SECRET_KEY_FOR_TESTS");
  });

  it("persists AWS_PROFILE to the Windows user environment without exposing secrets", async () => {
    const env: Record<string, string | undefined> = {
      SystemRoot: "C:\\Windows",
    };
    const calls: Array<{ file: string; args: readonly string[]; direct: boolean | undefined; timeout: number }> = [];
    const result = await setAwsProfileGlobally("stackspend-readonly", {
      env,
      platform: "win32",
      now: () => new Date("2026-06-09T00:00:00.000Z"),
      runCommand: async (file, args, options) => {
        calls.push({
          file,
          args,
          direct: options.direct,
          timeout: options.timeout,
        });

        return {
          stdout: "SUCCESS: Specified value was saved.",
        };
      },
    });

    expect(result).toMatchObject({
      generatedAt: "2026-06-09T00:00:00.000Z",
      localOnly: true,
      secretsReturned: false,
      profileName: "stackspend-readonly",
      target: "windows_user_environment",
      activeForCurrentProcess: true,
    });
    expect(calls).toEqual([
      {
        file: "C:\\Windows\\System32\\setx.exe",
        args: ["AWS_PROFILE", "stackspend-readonly"],
        direct: true,
        timeout: 10_000,
      },
    ]);
    expect(env.AWS_PROFILE).toBe("stackspend-readonly");
    expect(JSON.stringify(result)).not.toContain("AWS_SECRET_ACCESS_KEY");
  });

  it("rejects unsafe AWS profile names before running setx", async () => {
    let commandRan = false;

    await expect(setAwsProfileGlobally("prod & delete", {
      platform: "win32",
      runCommand: async () => {
        commandRan = true;

        return {};
      },
    })).rejects.toThrow("AWS profile name");

    expect(commandRan).toBe(false);
  });

  it("detects Google Cloud CLI setup without returning account or credential secrets", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "stackspend-gcp-local-tools-"));
    const cloudSdkConfig = join(homeDir, "gcloud-config");
    await mkdir(cloudSdkConfig, { recursive: true });
    await writeFile(join(cloudSdkConfig, "application_default_credentials.json"), JSON.stringify({
      client_id: "FAKE_CLIENT_ID_FOR_TESTS",
      client_secret: "FAKE_CLIENT_SECRET_FOR_TESTS",
      refresh_token: "FAKE_REFRESH_TOKEN_FOR_TESTS",
    }), "utf8");
    const calls: Array<{ file: string; args: readonly string[]; timeout: number }> = [];
    const status = await readGcpLocalSetupStatus({
      env: {
        CLOUDSDK_CONFIG: cloudSdkConfig,
      },
      homeDir,
      now: () => new Date("2026-06-09T00:00:00.000Z"),
      platform: "win32",
      runCommand: async (file, args, options) => {
        calls.push({
          file,
          args,
          timeout: options.timeout,
        });

        if (args[0] === "--version") {
          return {
            stdout: "Google Cloud SDK 548.0.0\nbq 2.1.24",
          };
        }

        if (args.includes("--format=value(account)")) {
          return {
            stdout: "developer@example.com",
          };
        }

        return {
          stdout: "stackspend-project",
        };
      },
    });

    expect(status).toMatchObject({
      generatedAt: "2026-06-09T00:00:00.000Z",
      localOnly: true,
      secretsReturned: false,
      gcloudCli: {
        state: "installed",
        version: "548.0.0",
      },
      account: {
        state: "configured",
        activeAccountHint: "d***@e***.com",
      },
      project: {
        state: "configured",
        projectIdHint: "sta***ct",
      },
      adc: {
        state: "configured",
        source: "application_default_credentials",
        envConfigured: false,
        fileDetected: true,
      },
    });
    expect(calls.map((call) => call.file)).toEqual(["gcloud", "gcloud", "gcloud"]);
    expect(calls.every((call) => call.timeout === 10_000)).toBe(true);
    expect(JSON.stringify(status)).not.toContain("developer@example.com");
    expect(JSON.stringify(status)).not.toContain("stackspend-project");
    expect(JSON.stringify(status)).not.toContain("FAKE_CLIENT_SECRET_FOR_TESTS");
    expect(JSON.stringify(status)).not.toContain("FAKE_REFRESH_TOKEN_FOR_TESTS");
  });

  it("reports missing Google Cloud CLI while still detecting env project and credential path", async () => {
    const missingRunner: LocalCommandRunner = async () => {
      const error = new Error("'gcloud' is not recognized as an internal or external command.") as Error & { stderr: string };
      error.stderr = "'gcloud' is not recognized as an internal or external command.";
      throw error;
    };
    const status = await readGcpLocalSetupStatus({
      env: {
        GOOGLE_APPLICATION_CREDENTIALS: "C:\\fake\\service-account.json",
        GOOGLE_CLOUD_PROJECT: "stackspend-env-project",
      },
      runCommand: missingRunner,
    });

    expect(status.gcloudCli).toMatchObject({
      state: "missing",
      version: null,
    });
    expect(status.project).toMatchObject({
      state: "configured",
      projectIdHint: "sta***ct",
    });
    expect(status.adc).toMatchObject({
      state: "configured",
      source: "GOOGLE_APPLICATION_CREDENTIALS",
      envConfigured: true,
    });
    expect(JSON.stringify(status)).not.toContain("service-account.json");
    expect(JSON.stringify(status)).not.toContain("stackspend-env-project");
  });

  it("summarizes local Codex and Claude CLI usage without exposing prompt text", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "stackspend-local-tools-"));
    const codexSessionDir = join(homeDir, ".codex", "sessions", "2026", "06", "09");
    const claudeProjectDir = join(homeDir, ".claude", "projects", "fake-project");
    await mkdir(codexSessionDir, { recursive: true });
    await mkdir(claudeProjectDir, { recursive: true });
    await writeFile(join(codexSessionDir, "rollout-fake.jsonl"), [
      JSON.stringify({
        type: "turn_context",
        timestamp: "2026-06-08T23:00:00.000Z",
        turn_id: "turn_codex_1",
        payload: {
          model: "gpt-5",
          info: {
            model_context_window: 200000,
            last_token_usage: {
              input_tokens: 50000,
              cached_input_tokens: 30000,
              output_tokens: 1200,
              reasoning_output_tokens: 300,
              total_tokens: 51200,
            },
            total_token_usage: {
              input_tokens: 100000,
              cached_input_tokens: 60000,
              output_tokens: 2500,
              reasoning_output_tokens: 700,
              total_tokens: 102500,
            },
          },
        },
      }),
      JSON.stringify({
        type: "response_item",
        timestamp: "2026-06-08T23:30:00.000Z",
        payload: {
          type: "function_call",
          name: "shell_command",
          call_id: "call_codex_1",
          usage: {
            input_tokens: 100,
            output_tokens: 25,
          },
          content: "FAKE_SECRET_PROMPT_TEXT",
        },
      }),
    ].join("\n"), "utf8");
    await writeFile(join(claudeProjectDir, "session-fake.jsonl"), [
      JSON.stringify({
        timestamp: "2026-06-08T23:10:00.000Z",
        context_window: {
          current_usage: {
            input_tokens: 42000,
            cache_read_input_tokens: 9000,
            output_tokens: 600,
          },
          max_tokens: 200000,
        },
        rate_limits: {
          five_hour: {
            used_tokens: 42000,
            limit_tokens: 100000,
            used_percentage: 42,
            resets_at: "2026-06-09T04:00:00.000Z",
          },
          seven_day: {
            used_tokens: 180000,
            limit_tokens: 300000,
            used_percentage: 60,
            resets_at: "2026-06-16T00:00:00.000Z",
          },
        },
      }),
      JSON.stringify({
        type: "assistant",
        timestamp: "2026-06-08T23:40:00.000Z",
        sessionId: "claude_session_1",
        message: {
          model: "claude-sonnet-4-5",
          usage: {
            input_tokens: 80,
            output_tokens: 20,
            cache_read_input_tokens: 30,
          },
          content: [
            {
              type: "tool_use",
              name: "Bash",
              input: "FAKE_CLAUDE_PROMPT_TEXT",
            },
          ],
        },
      }),
    ].join("\n"), "utf8");

    const status = await readLocalAiCliStatus({
      env: {
        STACKSPEND_CODEX_FIVE_HOUR_TOKEN_LIMIT: "200000",
        STACKSPEND_CODEX_WEEKLY_TOKEN_LIMIT: "500000",
        STACKSPEND_CLAUDE_FIVE_HOUR_TOKEN_LIMIT: "100000",
        STACKSPEND_CLAUDE_WEEKLY_TOKEN_LIMIT: "300000",
      },
      homeDir,
      now: () => new Date("2026-06-09T00:00:00.000Z"),
      runCommand: async (file) => ({
        stdout: `${file} 1.2.3`,
      }),
    });
    const codex = status.providers.find((provider) => provider.providerKey === "codex-cli");
    const claude = status.providers.find((provider) => provider.providerKey === "claude-cli");

    expect(codex).toMatchObject({
      cli: {
        state: "installed",
      },
      usage: {
        sessionCount: 1,
        turnCount: 1,
        toolCallCount: 1,
        parsedUsageRecordCount: 2,
        searchedPathHint: expect.stringMatching(/^~[\\/]\.codex[\\/]sessions$/),
        inputTokens: 100,
        outputTokens: 25,
        totalTokens: 125,
        statusLine: {
          contextWindowTokens: 50000,
          contextWindowLimit: 200000,
          contextWindowPercent: 25,
          fiveHourUsedTokens: 51325,
          fiveHourLimitTokens: 200000,
          fiveHourLimitPercent: 25.66,
          fiveHourRemainingTokens: 148675,
          weeklyUsedTokens: 51325,
          weeklyLimitTokens: 500000,
          weeklyLimitPercent: 10.27,
          weeklyRemainingTokens: 448675,
          lastInputTokens: 50000,
          lastOutputTokens: 1200,
          lastCacheTokens: 30000,
          lastReasoningTokens: 300,
          lastTotalTokens: 51200,
          totalInputTokens: 100000,
          totalOutputTokens: 2500,
          totalCacheTokens: 60000,
          totalReasoningTokens: 700,
          totalTokens: 102500,
        },
      },
    });
    expect(claude).toMatchObject({
      cli: {
        state: "installed",
      },
      usage: {
        sessionCount: 1,
        turnCount: 1,
        toolCallCount: 1,
        parsedUsageRecordCount: 2,
        searchedPathHint: expect.stringMatching(/^~[\\/]\.claude[\\/]projects$/),
        inputTokens: 80,
        outputTokens: 20,
        cacheTokens: 30,
        statusLine: {
          contextWindowTokens: 51000,
          contextWindowLimit: 200000,
          contextWindowPercent: 25.5,
          fiveHourUsedTokens: 42130,
          fiveHourLimitTokens: 100000,
          fiveHourLimitPercent: 42,
          fiveHourRemainingTokens: 57870,
          weeklyUsedTokens: 180130,
          weeklyLimitTokens: 300000,
          weeklyLimitPercent: 60,
          weeklyRemainingTokens: 119870,
          fiveHourResetAt: "2026-06-09T04:00:00.000Z",
          weeklyResetAt: "2026-06-16T00:00:00.000Z",
          lastInputTokens: 80,
          lastOutputTokens: 20,
          lastCacheTokens: 30,
          totalInputTokens: 80,
          totalOutputTokens: 20,
          totalCacheTokens: 30,
        },
      },
    });
    expect(JSON.stringify(status)).not.toContain("FAKE_SECRET_PROMPT_TEXT");
    expect(JSON.stringify(status)).not.toContain("FAKE_CLAUDE_PROMPT_TEXT");
  });

  it("maps Codex primary and secondary rate limit windows to five-hour and weekly status line metrics", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "stackspend-codex-rate-limits-"));
    const codexSessionDir = join(homeDir, ".codex", "sessions", "2026", "06", "10");
    await mkdir(codexSessionDir, { recursive: true });
    await writeFile(join(codexSessionDir, "rollout-rate-limits.jsonl"), JSON.stringify({
      timestamp: "2026-06-10T01:00:00.000Z",
      type: "turn_context",
      turn_id: "turn_codex_rate_limits",
      payload: {
        model: "gpt-5",
        rate_limits: {
          primary: {
            used_percent: 12.5,
            window_minutes: 300,
            resets_at: "2026-06-10T05:00:00.000Z",
          },
          secondary: {
            used_percent: 34.25,
            window_minutes: 10080,
            resets_at: "2026-06-17T00:00:00.000Z",
          },
        },
        info: {
          model_context_window: 200000,
          last_token_usage: {
            input_tokens: 1200,
            output_tokens: 100,
            total_tokens: 1300,
          },
        },
      },
    }), "utf8");

    const status = await readLocalAiCliStatus({
      homeDir,
      now: () => new Date("2026-06-10T01:30:00.000Z"),
      providerKeys: ["codex-cli"],
      runCommand: async (file) => ({
        stdout: `${file} 1.2.3`,
      }),
    });
    const codex = status.providers.find((provider) => provider.providerKey === "codex-cli");

    expect(codex?.usage.statusLine).toMatchObject({
      fiveHourLimitPercent: 12.5,
      fiveHourResetAt: "2026-06-10T05:00:00.000Z",
      weeklyLimitPercent: 34.25,
      weeklyResetAt: "2026-06-17T00:00:00.000Z",
      fiveHourLimitTokens: null,
      fiveHourRemainingTokens: null,
      weeklyLimitTokens: null,
      weeklyRemainingTokens: null,
      contextWindowTokens: 1200,
      contextWindowLimit: 200000,
      contextWindowPercent: 0.6,
    });
  });

  it("uses the latest Codex rate limit snapshot instead of the highest historical percent", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "stackspend-codex-latest-rate-limit-"));
    const codexSessionDir = join(homeDir, ".codex", "sessions", "2026", "06", "10");
    await mkdir(codexSessionDir, { recursive: true });
    await writeFile(join(codexSessionDir, "rollout-rate-limit-history.jsonl"), [
      JSON.stringify({
        timestamp: "2026-06-10T01:00:00.000Z",
        type: "turn_context",
        payload: {
          rate_limits: {
            primary: {
              used_percent: 100,
              window_minutes: 300,
              resets_at: "2026-06-10T02:00:00.000Z",
            },
            secondary: {
              used_percent: 64,
              window_minutes: 10080,
              resets_at: "2026-06-17T00:00:00.000Z",
            },
          },
        },
      }),
      JSON.stringify({
        timestamp: "2026-06-10T03:00:00.000Z",
        type: "turn_context",
        payload: {
          rate_limits: {
            primary: {
              used_percent: 0,
              window_minutes: 300,
              resets_at: "2026-06-10T08:00:00.000Z",
            },
            secondary: {
              used_percent: 13,
              window_minutes: 10080,
              resets_at: "2026-06-17T00:00:00.000Z",
            },
          },
        },
      }),
    ].join("\n"), "utf8");

    const status = await readLocalAiCliStatus({
      homeDir,
      now: () => new Date("2026-06-10T03:30:00.000Z"),
      providerKeys: ["codex-cli"],
      runCommand: async (file) => ({
        stdout: `${file} 1.2.3`,
      }),
    });
    const codex = status.providers.find((provider) => provider.providerKey === "codex-cli");

    expect(codex?.usage.statusLine).toMatchObject({
      fiveHourLimitPercent: 0,
      fiveHourResetAt: "2026-06-10T08:00:00.000Z",
      weeklyLimitPercent: 13,
      weeklyResetAt: "2026-06-17T00:00:00.000Z",
    });
  });

  it("does not skip current Codex logs when parent directory mtime is older than the month window", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "stackspend-stale-codex-dir-"));
    const yearDir = join(homeDir, ".codex", "sessions", "2026");
    const codexSessionDir = join(yearDir, "06", "10");
    await mkdir(codexSessionDir, { recursive: true });
    await writeFile(join(codexSessionDir, "rollout-fake.jsonl"), JSON.stringify({
      timestamp: "2026-06-10T01:00:00.000Z",
      type: "turn_context",
      turn_id: "turn_codex_stale_parent",
      payload: {
        model: "gpt-5",
        info: {
          model_context_window: 200000,
          last_token_usage: {
            input_tokens: 1200,
            output_tokens: 100,
            total_tokens: 1300,
          },
        },
      },
    }), "utf8");
    await utimes(yearDir, new Date("2026-05-31T23:59:00.000Z"), new Date("2026-05-31T23:59:00.000Z"));

    const status = await readLocalAiCliStatus({
      homeDir,
      now: () => new Date("2026-06-10T05:00:00.000Z"),
      providerKeys: ["codex-cli"],
      runCommand: async (file) => ({
        stdout: `${file} 1.2.3`,
      }),
    });
    const codex = status.providers.find((provider) => provider.providerKey === "codex-cli");

    expect(codex?.usage).toMatchObject({
      logFileCount: 1,
      parsedUsageRecordCount: 1,
      searchedPathHint: expect.stringMatching(/^~[\\/]\.codex[\\/]sessions$/),
      turnCount: 1,
      statusLine: {
        contextWindowTokens: 1200,
        contextWindowLimit: 200000,
        contextWindowPercent: 0.6,
        lastInputTokens: 1200,
        lastOutputTokens: 100,
        lastTotalTokens: 1300,
      },
    });
  });

  it("uses STACKSPEND_CODEX_SESSIONS_DIR before CODEX_HOME for Codex usage logs", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "stackspend-custom-codex-dir-"));
    const codexSessionsDir = join(homeDir, "custom-codex-sessions");
    const codexSessionDayDir = join(codexSessionsDir, "2026", "06", "10");
    await mkdir(codexSessionDayDir, { recursive: true });
    await writeFile(join(codexSessionDayDir, "rollout-fake.jsonl"), JSON.stringify({
      timestamp: "2026-06-10T01:00:00.000Z",
      type: "response_item",
      payload: {
        type: "function_call",
        name: "shell_command",
        call_id: "call_custom_codex",
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
        content: "FAKE_CUSTOM_CODEX_PROMPT",
      },
    }), "utf8");

    const status = await readLocalAiCliStatus({
      env: {
        CODEX_HOME: join(homeDir, "empty-codex-home"),
        STACKSPEND_CODEX_SESSIONS_DIR: codexSessionsDir,
      },
      homeDir,
      now: () => new Date("2026-06-10T05:00:00.000Z"),
      providerKeys: ["codex-cli"],
      runCommand: async (file) => ({
        stdout: `${file} 1.2.3`,
      }),
    });
    const codex = status.providers.find((provider) => provider.providerKey === "codex-cli");

    expect(codex?.usage).toMatchObject({
      logFileCount: 1,
      parsedUsageRecordCount: 1,
      searchedPathHint: expect.stringMatching(/^~[\\/]custom-codex-sessions$/),
      toolCallCount: 1,
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    });
    expect(JSON.stringify(status)).not.toContain("FAKE_CUSTOM_CODEX_PROMPT");
  });
});
