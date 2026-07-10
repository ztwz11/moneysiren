import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_QUICKSTART,
  extractQuickstart,
  validateProviderClaims,
  validateQuickstartDocument,
  validateReadme,
} from "./docs-contract.mjs";

test("accepts the one canonical quickstart block", () => {
  const document = `Before\n\n${CANONICAL_QUICKSTART}\n\nAfter\n`;

  assert.equal(extractQuickstart(document), CANONICAL_QUICKSTART);
  assert.deepEqual(validateQuickstartDocument("example.md", document), []);
});

test("rejects drift, missing markers, and duplicate blocks", () => {
  assert.match(
    validateQuickstartDocument("missing.md", "npm install -g @moneysiren/app")[0],
    /markers are missing/,
  );
  assert.match(
    validateQuickstartDocument(
      "drift.md",
      CANONICAL_QUICKSTART.replace("msiren demo", "msiren start"),
    )[0],
    /differs/,
  );
  assert.match(
    validateQuickstartDocument("duplicate.md", `${CANONICAL_QUICKSTART}\n${CANONICAL_QUICKSTART}`).at(-1),
    /exactly one/,
  );
});

test("enforces README length and exact shared maturity rows", () => {
  assert.match(validateReadme("short")[0], /150-220 lines/);

  const rows = [
    "| CLI + local web | Stable |",
    "| Mock data | Stable |",
    "| OpenAI Usage/Costs | Stable |",
    "| AWS Cost Explorer | Stable |",
    "| Codex App/CLI | Local estimate |",
    "| Claude CLI | Local estimate |",
    "| Supabase | Experimental |",
    "| Cloudflare | Experimental |",
    "| Synthetic provider fixtures | Fixture-only |",
    "| GCP and catalog-only providers | Planned |",
    "| Unsigned desktop HUD | Preview |",
  ].join("\n");

  assert.deepEqual(validateProviderClaims(rows, rows), []);
  assert.equal(validateProviderClaims(rows, "")[0].startsWith("docs/provider-support-matrix.md"), true);
});
