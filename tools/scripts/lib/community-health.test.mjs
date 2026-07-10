import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import test from "node:test";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const bugReportPath = resolve(
  repositoryRoot,
  ".github",
  "ISSUE_TEMPLATE",
  "bug_report.yml",
);

function readBugForm() {
  return readFileSync(bugReportPath, "utf8").replaceAll("\r\n", "\n");
}

function fieldBlock(source, id) {
  const matches = [
    ...source.matchAll(new RegExp(`^    id: ${id}$`, "gm")),
  ];

  assert.equal(
    matches.length,
    1,
    `bug_report.yml must contain exactly one field with id "${id}"`,
  );

  const idIndex = matches[0].index;
  const start = source.lastIndexOf("  - type:", idIndex);
  const next = source.indexOf("\n  - type:", idIndex);

  assert.notEqual(start, -1, `field "${id}" has no issue-form type`);
  return source.slice(start, next === -1 ? source.length : next);
}

function assertRequiredField(source, { id, type, label }) {
  const block = fieldBlock(source, id);

  assert.match(block, new RegExp(`^  - type: ${type}$`, "m"));
  assert.ok(
    block.includes(`      label: ${label}`),
    `field "${id}" must use label "${label}"`,
  );
  assert.match(block, /^    validations:\n      required: true$/m);

  return block;
}

test("bug reports require complete triage context", () => {
  const source = readBugForm();

  for (const field of [
    { id: "version", type: "input", label: "MoneySiren version" },
    { id: "os", type: "input", label: "Operating system" },
    { id: "node", type: "input", label: "Node.js version" },
    { id: "provider", type: "dropdown", label: "Affected provider" },
    {
      id: "command",
      type: "input",
      label: "MoneySiren command or UI route",
    },
    { id: "actual", type: "textarea", label: "Actual behavior" },
    { id: "expected", type: "textarea", label: "Expected behavior" },
  ]) {
    assertRequiredField(source, field);
  }

  assert.match(
    fieldBlock(source, "actual"),
    /short sanitized error code or message/i,
  );
});

test("provider and command fields remain safe and actionable", () => {
  const source = readBugForm();
  const provider = fieldBlock(source, "provider");
  const command = fieldBlock(source, "command");

  for (const option of [
    "Not provider-specific",
    "Mock or synthetic provider",
    "Codex App or CLI",
    "OpenAI Platform",
    "AWS Cost Explorer",
    "Supabase",
    "Cloudflare",
    "Other",
  ]) {
    assert.ok(
      provider.includes(`        - ${option}`),
      `provider field must include "${option}"`,
    );
  }

  assert.match(
    command,
    /Name only the MoneySiren subcommand or local UI route\./,
  );
  assert.match(
    command,
    /Remove arguments containing credentials, tokens, identifiers, paths, or other sensitive values\./,
  );
});

test("bug reports retain both required safety confirmations", () => {
  const safety = fieldBlock(readBugForm(), "safety");
  const confirmations = safety.match(/^          required: true$/gm) ?? [];

  assert.equal(confirmations.length, 2);
  assert.match(safety, /I removed credentials, tokens,/);
  assert.match(safety, /I used mock, fixture, or synthetic data/);
});
