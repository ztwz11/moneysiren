import { describe, expect, it } from "vitest";
import {
  maybeRenderStartupIntro,
  renderStartupLogo,
  shouldRenderStartupIntro,
} from "./startup-intro.js";
import { CLI_VERSION } from "./version.js";

const ANSI_PATTERN = /\x1B\[[0-9;]*m/;

describe("MoneySiren startup intro", () => {
  it("renders for interactive command windows", () => {
    expect(shouldRenderStartupIntro(["start"], {}, true)).toBe(true);
    expect(shouldRenderStartupIntro(["hud"], {}, true)).toBe(true);
    expect(shouldRenderStartupIntro([], {}, true)).toBe(true);
  });

  it("does not render where it would pollute automation or machine-readable output", () => {
    expect(shouldRenderStartupIntro(["start"], {}, false)).toBe(false);
    expect(shouldRenderStartupIntro(["start"], { CI: "1" }, true)).toBe(false);
    expect(shouldRenderStartupIntro(["start"], { MONEYSIREN_NO_INTRO: "1" }, true)).toBe(false);
    expect(shouldRenderStartupIntro(["start"], { MONEYSIREN_CLI_INTRO: "0" }, true)).toBe(false);
    expect(shouldRenderStartupIntro(["--help"], {}, true)).toBe(false);
    expect(shouldRenderStartupIntro(["--version"], {}, true)).toBe(false);
    expect(shouldRenderStartupIntro(["--", "--version"], {}, true)).toBe(false);
    expect(shouldRenderStartupIntro(["summary", "--json"], {}, true)).toBe(false);
  });

  it("renders a short ASCII logo with version information", () => {
    const logo = renderStartupLogo(false);

    expect(logo).toContain("local spend radar");
    expect(logo).toContain("CLI . Web . HUD");
    expect(logo).toContain(CLI_VERSION);
    expect(logo).not.toMatch(ANSI_PATTERN);
  });

  it("writes the animated prelude and final logo to the provided output stream", async () => {
    let output = "";

    await maybeRenderStartupIntro({
      args: ["start"],
      env: {
        FORCE_COLOR: "0",
      },
      stdoutIsTTY: true,
      output: {
        write(chunk: string | Uint8Array) {
          output += String(chunk);
          return true;
        },
      },
      delayMs: 0,
    });

    expect(output).toContain("warming local radar");
    expect(output).toContain("checking CLI, Web, HUD");
    expect(output).toContain("ready to watch spend");
    expect(output).toContain("local spend radar");
    expect(output).not.toMatch(ANSI_PATTERN);
  });
});
