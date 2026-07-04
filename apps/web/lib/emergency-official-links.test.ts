import { describe, expect, it } from "vitest";
import { officialLinksForEmergencyCandidate } from "./emergency-official-links";

describe("emergency official links", () => {
  it("returns official provider links for a manual emergency runbook", () => {
    const links = officialLinksForEmergencyCandidate({
      providerKey: "aws",
      setupLinks: [],
    }, {
      actionKey: "manual_runbook",
      kind: "manual_runbook",
    });

    expect(links.map((link) => link.label)).toEqual(expect.arrayContaining([
      "AWS Cost Explorer",
      "AWS Budgets",
    ]));
    expect(links.every((link) => link.href.startsWith("https://"))).toBe(true);
  });

  it("filters unsafe or sensitive setup links", () => {
    const links = officialLinksForEmergencyCandidate({
      providerKey: "openai",
      setupLinks: [
        {
          label: "Unsafe local link",
          href: "http://127.0.0.1:3000/secret",
          description: "Do not show local links.",
        },
        {
          label: "Sensitive project link",
          href: "https://example.com/project_fake_emergency_test",
          description: "Do not show redacted project identifiers.",
        },
      ],
    }, {
      actionKey: "credential_recovery",
      kind: "credential_recovery",
    });
    const serialized = JSON.stringify(links);

    expect(serialized).not.toContain("127.0.0.1");
    expect(serialized).not.toContain("project_fake_emergency_test");
    expect(links.map((link) => link.label)).toEqual(expect.arrayContaining([
      "OpenAI Admin API Keys",
      "OpenAI Admin API key docs",
    ]));
  });

  it("shows future-write official links without enabling provider execution", () => {
    const links = officialLinksForEmergencyCandidate({
      providerKey: "cloudflare",
      setupLinks: [],
    }, {
      actionKey: "future_write_requirements",
      kind: "planned_write_requirement",
    });

    expect(links.map((link) => link.label)).toEqual(expect.arrayContaining([
      "Cloudflare Workers & Pages",
      "Cloudflare API Tokens",
    ]));
    expect(JSON.stringify(links)).not.toContain("executeEnabled");
  });
});
