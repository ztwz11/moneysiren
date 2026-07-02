import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  LOCALE_OPTIONS,
  LOCALES,
  detectLocale,
  getMessages,
  replaceLocale,
  type Locale,
} from "./i18n";

describe("web i18n", () => {
  it("detects supported locales from Accept-Language", () => {
    expect(detectLocale("ko-KR,ko;q=0.9,en;q=0.8")).toBe("ko");
    expect(detectLocale("ja-JP,ja;q=0.9,en;q=0.8")).toBe("ja");
    expect(detectLocale("fr-FR,fr;q=0.9")).toBe("fr");
    expect(detectLocale("de-DE,de;q=0.9")).toBe("de");
    expect(detectLocale("es-ES,es;q=0.9")).toBe("es");
    expect(detectLocale("zh-CN,zh;q=0.9")).toBe("zh");
    expect(detectLocale(null)).toBe("en");
  });

  it("keeps locale switcher options aligned with supported locales", () => {
    expect(LOCALE_OPTIONS.map((option) => option.locale)).toEqual([...LOCALES]);

    for (const option of LOCALE_OPTIONS) {
      expect(option.iconSrc).toMatch(/^\/flags\/[a-z]{2}\.svg$/);
      expect(option.label.length).toBeGreaterThan(0);
      expect(existsSync(join(process.cwd(), "public", option.iconSrc.slice(1)))).toBe(true);
    }
  });

  it("keeps message keys aligned across locales", () => {
    const reference = flattenKeys(getMessages("en"));

    for (const locale of LOCALES) {
      expect(flattenKeys(getMessages(locale))).toEqual(reference);
    }
  });

  it("replaces an existing locale path segment", () => {
    expect(replaceLocale("/ko/dashboard/overview", "ja")).toBe("/ja/dashboard/overview");
    expect(replaceLocale("/fr/dashboard/overview", "de")).toBe("/de/dashboard/overview");
    expect(replaceLocale("/dashboard/overview", "ko")).toBe("/ko/dashboard/overview");
  });
});

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix];
  }

  return Object.entries(value)
    .flatMap(([key, nested]) => flattenKeys(nested, prefix.length === 0 ? key : `${prefix}.${key}`))
    .sort();
}
