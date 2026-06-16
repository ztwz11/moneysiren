import { readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
const includeHistory = args.has("--history") || args.has("--all");
const maxGitOutputBytes = 64 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const SECRET_PATTERNS = [
  {
    name: "OpenAI-style API key",
    pattern: /(?:^|[^A-Za-z0-9])sk-[A-Za-z0-9_-]{8,}/g,
  },
  {
    name: "GitHub token",
    pattern: /(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{20,})/g,
  },
  {
    name: "Slack token",
    pattern: /xox[baprs]-[A-Za-z0-9-]{8,}/g,
  },
  {
    name: "Slack webhook URL",
    pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/g,
  },
  {
    name: "AWS access key id",
    pattern: /AKIA[0-9A-Z]{16}/g,
  },
  {
    name: "Google API key",
    pattern: /AIza[0-9A-Za-z_-]{35}/g,
  },
  {
    name: "Supabase access token",
    pattern: /sbp_[A-Za-z0-9._-]{20,}/g,
  },
  {
    name: "Private key block",
    pattern: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
  },
  {
    name: "OpenSSH private key block",
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g,
  },
];

const SENSITIVE_PATH_PATTERNS = [
  {
    name: "environment file",
    pattern: /(^|\/)\.env($|[./])/,
    allowed: /(^|\/)\.env\.example$/,
  },
  {
    name: "local StackSpend runtime data",
    pattern: /(^|\/)\.stackspend($|\/)|(^|\/)runtime\.json$/,
  },
  {
    name: "local database file",
    pattern: /\.(?:db|sqlite|sqlite3)$/,
  },
  {
    name: "local log file",
    pattern: /\.log$/,
  },
  {
    name: "private key or certificate material",
    pattern: /\.(?:pem|key|p12|pfx)$/,
  },
];

const SAFE_EXAMPLE_PATTERN = /fake|fixture|synthetic|example|do-not-use|dummy|test/i;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const gitSafeDirectory = repoRoot.replaceAll("\\", "/");
const files = listFiles();
const findings = [];
let historyChecked = false;

for (const file of files) {
  const sensitivePathType = findSensitivePathType(file);

  if (sensitivePathType) {
    findings.push({
      file,
      line: null,
      name: sensitivePathType,
      preview: file,
      source: "current tree",
    });
  }

  if (!TEXT_EXTENSIONS.has(extname(file).toLowerCase())) {
    continue;
  }

  const text = readFileSync(resolve(repoRoot, file), "utf8");
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    scanLineForSecrets({
      file,
      line: lines[index] ?? "",
      lineNumber: index + 1,
      source: "current tree",
    });
  }
}

if (includeHistory) {
  scanGitHistory();
}

if (findings.length > 0) {
  console.error("Potential committed secrets found:");

  for (const finding of findings) {
    const location = finding.line === null ? finding.file : `${finding.file}:${finding.line}`;
    console.error(`- ${location} [${finding.source}] ${finding.name}: ${finding.preview}`);
  }

  process.exit(1);
}

const historySuffix = historyChecked ? ", git history checked" : "";
console.log(`Secret scan passed (${files.length} files checked${historySuffix}).`);

function listFiles() {
  const result = spawnSync("git", [
    "-c",
    `safe.directory=${gitSafeDirectory}`,
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
  ], {
    encoding: "utf8",
    cwd: repoRoot,
  });

  if (result.status !== 0) {
    console.error(result.stderr.trim() || "git ls-files failed");
    process.exit(result.status ?? 1);
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !file.includes("/node_modules/"))
    .filter((file) => !file.includes("/dist/"))
    .filter((file) => !file.includes("/.next/"));
}

function scanGitHistory() {
  historyChecked = true;

  const historyFiles = spawnGit([
    "log",
    "--all",
    "--name-only",
    "--pretty=format:",
    "--",
    ".",
  ]).stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const file of historyFiles) {
    const sensitivePathType = findSensitivePathType(file);

    if (sensitivePathType) {
      findings.push({
        file,
        line: null,
        name: sensitivePathType,
        preview: file,
        source: "git history",
      });
    }
  }

  const historyDiff = spawnGit([
    "log",
    "--all",
    "-p",
    "--no-ext-diff",
    "--",
    ".",
  ]).stdout;
  let currentFile = "(unknown history file)";

  for (const rawLine of historyDiff.split(/\r?\n/)) {
    if (rawLine.startsWith("+++ b/") || rawLine.startsWith("--- a/")) {
      currentFile = rawLine.slice(6);
      continue;
    }

    if (rawLine.startsWith("+++") || rawLine.startsWith("---")) {
      continue;
    }

    if (!rawLine.startsWith("+") && !rawLine.startsWith("-")) {
      continue;
    }

    scanLineForSecrets({
      file: currentFile,
      line: rawLine.slice(1),
      lineNumber: null,
      source: "git history",
    });
  }
}

function scanLineForSecrets({ file, line, lineNumber, source }) {
  if (file === "tools/scripts/secret-scan.mjs" && line.includes("pattern: /")) {
    return;
  }

  for (const secretPattern of SECRET_PATTERNS) {
    for (const match of line.matchAll(secretPattern.pattern)) {
      const value = normalizeMatchedSecret(match[0]);

      if (SAFE_EXAMPLE_PATTERN.test(line) || SAFE_EXAMPLE_PATTERN.test(value)) {
        continue;
      }

      findings.push({
        file,
        line: lineNumber,
        name: secretPattern.name,
        preview: redactSecret(value),
        source,
      });
    }
  }
}

function spawnGit(args) {
  const result = spawnSync("git", [
    "-c",
    `safe.directory=${gitSafeDirectory}`,
    ...args,
  ], {
    encoding: "utf8",
    cwd: repoRoot,
    maxBuffer: maxGitOutputBytes,
  });

  if (result.status !== 0) {
    console.error(result.stderr.trim() || `git ${args.join(" ")} failed`);
    process.exit(result.status ?? 1);
  }

  return result;
}

function findSensitivePathType(file) {
  const normalized = file.replaceAll("\\", "/");

  for (const sensitivePathPattern of SENSITIVE_PATH_PATTERNS) {
    if (!sensitivePathPattern.pattern.test(normalized)) {
      continue;
    }

    if (sensitivePathPattern.allowed?.test(normalized)) {
      continue;
    }

    return sensitivePathPattern.name;
  }

  return null;
}

function normalizeMatchedSecret(value) {
  return value.replace(/^[^A-Za-z0-9-]+/, "").trim();
}

function redactSecret(value) {
  if (value.length <= 10) {
    return "[redacted]";
  }

  return `${value.slice(0, 4)}...[redacted]...${value.slice(-4)}`;
}
