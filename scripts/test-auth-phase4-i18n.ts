/**
 * Phase 4 smoke: auth.json key parity across locales.
 * Run: pnpm exec tsx scripts/test-auth-phase4-i18n.ts
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) {
    return prefix ? [prefix] : [];
  }
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flattenKeys(v, next));
    } else {
      out.push(next);
    }
  }
  return out;
}

function loadAuth(locale: string): Record<string, unknown> {
  const rel = path.join("messages", locale, "auth.json");
  assert(existsSync(path.join(process.cwd(), rel)), `missing ${rel}`);
  return JSON.parse(readFileSync(path.join(process.cwd(), rel), "utf8")) as Record<string, unknown>;
}

function main() {
  const locales = ["en", "es", "de", "fr", "zh"] as const;
  const en = loadAuth("en");
  const enKeys = flattenKeys(en).sort();
  assert(enKeys.includes("verify.subtitle"), "en verify.subtitle");
  assert(enKeys.includes("errors.invalid_credentials"), "en errors.invalid_credentials");

  for (const locale of locales) {
    const data = loadAuth(locale);
    const keys = flattenKeys(data).sort();
    assert(
      keys.length === enKeys.length && keys.every((k, i) => k === enKeys[i]),
      `${locale} auth.json key mismatch vs en`,
    );

    const verify = data.verify as { subtitle?: string };
    assert(
      typeof verify.subtitle === "string" && verify.subtitle.includes("{email}"),
      `${locale} verify.subtitle must keep {email}`,
    );

    const brand = data.brand as { name?: string };
    assert(brand.name === "Eastern OS", `${locale} brand.name must stay Eastern OS`);
  }

  console.log("test-auth-phase4-i18n: ok");
}

main();
