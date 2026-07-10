import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { describe, expect, it } from "vitest";
import webPackage from "../../../package.json";
import rateLimitsFixture from "../../../../../tests/fixtures/local-ai/codex/app-server-rate-limits.json";
import accountUsageFixture from "../../../../../tests/fixtures/local-ai/codex/app-server-usage.json";
import {
  CODEX_APP_SERVER_STDIO_ARGS,
  CodexAppServerJsonlDecoder,
  CodexAppServerSession,
  buildCodexAppServerChildEnv,
  readCodexAppServerOfficialMeasurements,
  type CodexAppServerSpawnOptions,
} from "./app-server-transport";

const FETCHED_AT = "2030-01-03T00:00:00.000Z";

describe("Codex App Server process lifecycle", () => {
  it("uses the documented stdio listener and cleans up after success", async () => {
    const child = new FakeCodexProcess();
    const stdinLines: string[] = [];
    let command = "";
    let args: readonly string[] = [];
    let spawnOptions: CodexAppServerSpawnOptions | undefined;
    const sourceEnv: Record<string, string | undefined> = {
      Path: "FAKE_WINDOWS_PATH",
      NODE_ENV: "test",
      SystemRoot: "FAKE_WINDOWS_ROOT",
      UserProfile: "FAKE_USER_PROFILE",
      codex_home: "FAKE_CODEX_HOME",
      lang: "ko_KR.UTF-8",
      https_proxy: "http://127.0.0.1:8080",
      node_extra_ca_certs: "FAKE_CA_FILE",
      OPENAI_API_KEY: "FAKE_OPENAI_API_KEY",
      CODEX_API_KEY: "FAKE_CODEX_API_KEY",
      AWS_ACCESS_KEY_ID: "FAKE_AWS_ACCESS_KEY",
      AWS_SECRET_ACCESS_KEY: "FAKE_AWS_SECRET",
      AWS_SESSION_TOKEN: "FAKE_AWS_SESSION",
      AWS_PROFILE: "FAKE_AWS_PROFILE",
      SUPABASE_ACCESS_TOKEN: "FAKE_SUPABASE_TOKEN",
      CLOUDFLARE_API_TOKEN: "FAKE_CLOUDFLARE_TOKEN",
      GOOGLE_APPLICATION_CREDENTIALS: "FAKE_GOOGLE_CREDENTIAL_FILE",
      SLACK_WEBHOOK_URL: "FAKE_SLACK_WEBHOOK",
      TELEGRAM_BOT_TOKEN: "FAKE_TELEGRAM_TOKEN",
      RESET_CREDIT_API_KEY: "FAKE_RESET_KEY",
      CRON_SECRET: "FAKE_CRON_SECRET",
      OAUTH_TOKEN: "FAKE_OAUTH_TOKEN",
      VAULT_TOKEN: "FAKE_VAULT_TOKEN",
      MONEYSIREN_DB_PATH: "FAKE_DB_PATH",
      MONEYSIREN_FUTURE_SECRET: "FAKE_FUTURE_SECRET",
      NODE_OPTIONS: "--require FAKE_MODULE",
      DEBUG: "*",
      RUST_LOG: "trace",
      SSH_AUTH_SOCK: "FAKE_SSH_SOCKET",
      TEMP: undefined,
    };

    child.stdin.on("data", (chunk: Buffer) => {
      stdinLines.push(...chunk.toString("utf8").trim().split("\n"));
    });

    const pending = readCodexAppServerOfficialMeasurements({
      now: () => new Date(FETCHED_AT),
      timeoutMs: 2_000,
      env: sourceEnv,
      platform: "win32",
      spawnProcess: (nextCommand, nextArgs, nextOptions) => {
        command = nextCommand;
        args = [...nextArgs];
        spawnOptions = nextOptions;
        return child.asChildProcess();
      },
    });

    expect(command).toBe("codex");
    expect(CODEX_APP_SERVER_STDIO_ARGS).toEqual([
      "app-server",
      "--listen",
      "stdio://",
    ]);
    expect(args).toEqual(CODEX_APP_SERVER_STDIO_ARGS);
    expect(spawnOptions).toEqual({
      env: {
        PATH: "FAKE_WINDOWS_PATH",
        NODE_ENV: "test",
        SYSTEMROOT: "FAKE_WINDOWS_ROOT",
        USERPROFILE: "FAKE_USER_PROFILE",
        CODEX_HOME: "FAKE_CODEX_HOME",
        LANG: "ko_KR.UTF-8",
        HTTPS_PROXY: "http://127.0.0.1:8080",
        NODE_EXTRA_CA_CERTS: "FAKE_CA_FILE",
      },
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    expect(stdinLines.map(parseLine)[0]).toMatchObject({
      method: "initialize",
      id: 0,
    });

    child.stderr.write("Bearer FAKE_PRIVATE_VALUE");
    child.stdout.write(`${JSON.stringify({ id: 0, result: {} })}\n`);
    child.stdout.write(`${JSON.stringify({
      id: 2,
      result: accountUsageFixture.result,
    })}\n`);
    child.stdout.write(`${JSON.stringify({
      id: 1,
      result: rateLimitsFixture.result,
    })}\n`);

    const result = await pending;

    expect(child.killed).toBe(true);
    expect(result.rateLimits.availability).toBe("available");
    expect(result.accountUsage.availability).toBe("available");
    expect(stdinLines.map(parseLine)).toEqual([
      expect.objectContaining({ method: "initialize", id: 0 }),
      { method: "initialized", params: {} },
      { method: "account/rateLimits/read", id: 1 },
      { method: "account/usage/read", id: 2 },
    ]);
    expect(JSON.stringify(result)).not.toContain("FAKE_PRIVATE_VALUE");
  });

  it("times out with sanitized unavailable states and kills the child", async () => {
    const child = new FakeCodexProcess();

    const result = await readCodexAppServerOfficialMeasurements({
      now: () => new Date(FETCHED_AT),
      timeoutMs: 250,
      spawnProcess: () => child.asChildProcess(),
    });

    expect(child.killed).toBe(true);
    expect(result.rateLimits).toMatchObject({
      availability: "unavailable",
      reason: "timeout",
    });
    expect(result.accountUsage).toMatchObject({
      availability: "unavailable",
      reason: "timeout",
    });
  });

  it("rejects an oversized unterminated line and kills the child", async () => {
    const child = new FakeCodexProcess();

    const pending = readCodexAppServerOfficialMeasurements({
      now: () => new Date(FETCHED_AT),
      timeoutMs: 2_000,
      maxLineBytes: 1_024,
      spawnProcess: () => child.asChildProcess(),
    });

    child.stdout.write("x".repeat(1_025));
    const result = await pending;

    expect(child.killed).toBe(true);
    expect(result.rateLimits).toMatchObject({
      availability: "unavailable",
      reason: "oversized-response",
    });
    expect(result.accountUsage).toMatchObject({
      availability: "unavailable",
      reason: "oversized-response",
    });
  });
});


describe("Codex App Server least-privilege child environment", () => {
  it("matches POSIX keys exactly and does not wildcard locale variables", () => {
    const childEnv = buildCodexAppServerChildEnv({
      PATH: "FAKE_POSIX_PATH",
      NODE_ENV: "test",
      Path: "FAKE_WRONG_CASE_PATH",
      HOME: "FAKE_HOME",
      CODEX_HOME: "FAKE_CODEX_HOME",
      codex_home: "FAKE_WRONG_CASE_CODEX_HOME",
      LC_ALL: "C.UTF-8",
      LC_TIME: "FAKE_UNALLOWLISTED_LOCALE",
      https_proxy: "http://127.0.0.1:8080",
      SSL_CERT_FILE: "FAKE_CA_FILE",
      OPENAI_API_KEY: "FAKE_OPENAI_API_KEY",
      MONEYSIREN_DB_PATH: "FAKE_DB_PATH",
      TEMP: undefined,
    }, "linux");

    expect(childEnv).toEqual({
      PATH: "FAKE_POSIX_PATH",
      NODE_ENV: "test",
      HOME: "FAKE_HOME",
      CODEX_HOME: "FAKE_CODEX_HOME",
      LC_ALL: "C.UTF-8",
      https_proxy: "http://127.0.0.1:8080",
      SSL_CERT_FILE: "FAKE_CA_FILE",
    });
    expect(Object.values(childEnv).every(
      (value) => typeof value === "string",
    )).toBe(true);
    expect(childEnv).not.toHaveProperty("LC_TIME");
    expect(childEnv).not.toHaveProperty("OPENAI_API_KEY");
    expect(childEnv).not.toHaveProperty("MONEYSIREN_DB_PATH");
  });
});
describe("Codex App Server bounded JSONL framing", () => {
  it("reassembles split chunks and discards blank protocol lines", () => {
    const decoder = new CodexAppServerJsonlDecoder(1_024);

    expect(decoder.push('{"id":0')).toEqual({
      lines: [],
      oversized: false,
    });
    expect(decoder.push(',"result":{}}\r\n\n{"id":1')).toEqual({
      lines: ['{"id":0,"result":{}}'],
      oversized: false,
    });
    expect(decoder.push(',"result":{}}\n')).toEqual({
      lines: ['{"id":1,"result":{}}'],
      oversized: false,
    });
  });

  it("preserves a UTF-8 code point split across Buffer chunks", () => {
    const decoder = new CodexAppServerJsonlDecoder(1_024);
    const line = '{"value":"한"}\n';
    const encoded = Buffer.from(line, "utf8");
    const characterStart = encoded.indexOf(Buffer.from("한", "utf8"));
    const splitAt = characterStart + 1;

    expect(decoder.push(encoded.subarray(0, splitAt))).toEqual({
      lines: [],
      oversized: false,
    });
    expect(decoder.push(encoded.subarray(splitAt))).toEqual({
      lines: ['{"value":"한"}'],
      oversized: false,
    });
  });

  it("fails an unterminated or completed line above the byte limit", () => {
    const decoder = new CodexAppServerJsonlDecoder(8);

    expect(decoder.push("123456789")).toEqual({
      lines: [],
      oversized: true,
    });

    const completedLineDecoder = new CodexAppServerJsonlDecoder(8);
    expect(completedLineDecoder.push("123456789\n")).toEqual({
      lines: [],
      oversized: true,
    });
  });
});

describe("Codex App Server stdio JSON-RPC session", () => {
  it("uses the documented initialize handshake and only the two read methods", () => {
    const session = new CodexAppServerSession(FETCHED_AT);
    const initialize = parseLine(session.initialRequestLine());

    expect(initialize).toEqual({
      method: "initialize",
      id: 0,
      params: {
        clientInfo: {
          name: "moneysiren",
          title: "MoneySiren",
          version: webPackage.version,
        },
      },
    });

    const initialized = session.acceptLine(JSON.stringify({
      id: 0,
      result: {
        userAgent: "synthetic-app-server",
      },
    }));

    expect(initialized.result).toBeNull();
    expect(initialized.outbound.map(parseLine)).toEqual([
      { method: "initialized", params: {} },
      { method: "account/rateLimits/read", id: 1 },
      { method: "account/usage/read", id: 2 },
    ]);

    const outboundText = [
      session.initialRequestLine(),
      ...initialized.outbound,
    ].join("\n");

    expect(outboundText).not.toMatch(
      /auth|authorization|token|password|cwd|prompt|content|chatgpt\.com/i,
    );
  });

  it("normalizes both fixture-backed responses before completing", () => {
    const session = initializedSession();

    const rateLimits = session.acceptLine(JSON.stringify({
      id: 1,
      result: rateLimitsFixture.result,
    }));

    expect(rateLimits.result).toBeNull();

    const accountUsage = session.acceptLine(JSON.stringify({
      id: 2,
      result: accountUsageFixture.result,
    }));

    expect(accountUsage.result?.rateLimits).toMatchObject({
      availability: "available",
      source: "codex-app-server-rate-limits",
      accuracy: "official",
    });
    expect(accountUsage.result?.accountUsage).toMatchObject({
      availability: "available",
      source: "codex-app-server-account-usage",
      accuracy: "official",
    });

    const output = JSON.stringify(accountUsage.result);
    expect(output).not.toContain("RateLimitResetCredit_FAKE");
    expect(output).not.toContain('"id"');
  });

  it("keeps a successful domain when the other official method is unsupported", () => {
    const session = initializedSession();

    session.acceptLine(JSON.stringify({
      id: 1,
      result: rateLimitsFixture.result,
    }));
    const completed = session.acceptLine(JSON.stringify({
      id: 2,
      error: {
        code: -32601,
        message: "Method not found: account/usage/read",
        data: {
          raw: "Bearer FAKE_PRIVATE_VALUE",
        },
      },
    }));

    expect(completed.result?.rateLimits.availability).toBe("available");
    expect(completed.result?.accountUsage).toMatchObject({
      availability: "unavailable",
      reason: "unsupported-method",
      data: null,
    });
    expect(JSON.stringify(completed.result)).not.toContain("FAKE_PRIVATE_VALUE");
    expect(JSON.stringify(completed.result)).not.toContain("Method not found");
  });

  it("maps unsupported authentication errors without echoing upstream text", () => {
    const session = initializedSession();

    session.acceptLine(JSON.stringify({
      id: 1,
      result: rateLimitsFixture.result,
    }));
    const completed = session.acceptLine(JSON.stringify({
      id: 2,
      error: {
        code: -32000,
        message: "Bedrock API key mode cannot read FAKE_ACCOUNT@example.test",
      },
    }));

    expect(completed.result?.accountUsage).toMatchObject({
      availability: "unavailable",
      reason: "unsupported-auth-mode",
    });
    expect(JSON.stringify(completed.result)).not.toContain("example.test");
    expect(JSON.stringify(completed.result)).not.toContain("Bedrock API key mode");
  });

  it("preserves a completed official read when the other request times out", () => {
    const session = initializedSession();

    session.acceptLine(JSON.stringify({
      id: 1,
      result: rateLimitsFixture.result,
    }));
    const completed = session.finishPending("timeout");

    expect(completed.rateLimits.availability).toBe("available");
    expect(completed.accountUsage).toMatchObject({
      availability: "unavailable",
      reason: "timeout",
    });
  });

  it("fails closed with fixed messages for malformed stdout", () => {
    const session = new CodexAppServerSession(FETCHED_AT);
    const completed = session.acceptLine(
      '{"id":0,"result":"Bearer FAKE_PRIVATE_VALUE"',
    );

    expect(completed.result?.rateLimits).toMatchObject({
      availability: "unavailable",
      reason: "malformed-response",
    });
    expect(completed.result?.accountUsage).toMatchObject({
      availability: "unavailable",
      reason: "malformed-response",
    });
    expect(JSON.stringify(completed.result)).not.toContain("FAKE_PRIVATE_VALUE");
  });

  it("ignores unrelated server notifications without retaining them", () => {
    const session = initializedSession();
    const advance = session.acceptLine(JSON.stringify({
      method: "item/agentMessage/delta",
      params: {
        delta: "Bearer FAKE_PRIVATE_VALUE",
      },
    }));

    expect(advance).toEqual({
      outbound: [],
      result: null,
    });

    const completed = session.finishPending("no-data");
    expect(JSON.stringify(completed)).not.toContain("FAKE_PRIVATE_VALUE");
  });
});

function initializedSession(): CodexAppServerSession {
  const session = new CodexAppServerSession(FETCHED_AT);
  const initialized = session.acceptLine(JSON.stringify({
    id: 0,
    result: {},
  }));

  expect(initialized.outbound).toHaveLength(3);
  return session;
}

function parseLine(line: string): Record<string, unknown> {
  return JSON.parse(line) as Record<string, unknown>;
}


class FakeCodexProcess extends EventEmitter {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  killed = false;

  kill(): boolean {
    this.killed = true;
    return true;
  }

  asChildProcess(): ChildProcessWithoutNullStreams {
    return this as unknown as ChildProcessWithoutNullStreams;
  }
}
