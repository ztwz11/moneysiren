export const QUICKSTART_BEGIN = "<!-- moneysiren-quickstart:start -->";
export const QUICKSTART_END = "<!-- moneysiren-quickstart:end -->";
export const QUICKSTART_COMMANDS = [
  "npm install -g @moneysiren/app",
  "msiren demo",
];
export const CANONICAL_QUICKSTART = [
  QUICKSTART_BEGIN,
  "```bash",
  ...QUICKSTART_COMMANDS,
  "```",
  QUICKSTART_END,
].join("\n");

export const MATURITY_LABELS = [
  "Stable",
  "Local estimate",
  "Experimental",
  "Fixture-only",
  "Planned",
];

export function extractQuickstart(document) {
  const begin = document.indexOf(QUICKSTART_BEGIN);
  const end = document.indexOf(QUICKSTART_END);

  if (begin < 0 || end < 0 || end < begin) {
    return null;
  }

  const afterEnd = end + QUICKSTART_END.length;
  return document.slice(begin, afterEnd);
}

export function validateQuickstartDocument(path, document) {
  const issues = [];
  const extracted = extractQuickstart(document);

  if (extracted === null) {
    issues.push(`${path}: canonical quickstart markers are missing`);
  } else if (extracted !== CANONICAL_QUICKSTART) {
    issues.push(`${path}: quickstart differs from the canonical command block`);
  }

  const beginCount = document.split(QUICKSTART_BEGIN).length - 1;
  const endCount = document.split(QUICKSTART_END).length - 1;

  if (beginCount !== 1 || endCount !== 1) {
    issues.push(`${path}: expected exactly one canonical quickstart block`);
  }

  return issues;
}

export function validateReadme(document) {
  const issues = [];
  const lineCount = document.trimEnd().split(/\r?\n/).length;

  if (lineCount < 150 || lineCount > 220) {
    issues.push(`README.md: expected 150-220 lines, found ${lineCount}`);
  }

  for (const label of [...MATURITY_LABELS, "Preview"]) {
    if (!document.includes(label)) {
      issues.push(`README.md: missing maturity label ${label}`);
    }
  }

  if (!document.includes("docs/assets/hero/moneysiren-hero.svg")) {
    issues.push("README.md: hero asset is not referenced");
  }

  return issues;
}

export function validateProviderClaims(readme, matrix) {
  const issues = [];
  const requiredRows = [
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
  ];

  for (const row of requiredRows) {
    if (!readme.includes(row)) {
      issues.push(`README.md: missing maturity row ${row}`);
    }

    if (!matrix.includes(row)) {
      issues.push(`docs/provider-support-matrix.md: missing maturity row ${row}`);
    }
  }

  return issues;
}
