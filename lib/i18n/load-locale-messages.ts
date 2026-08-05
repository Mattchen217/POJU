import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { AbstractIntlMessages } from "next-intl";

const LOCALE_MODULES = ["contact", "auth"] as const;

function readLocaleModule(locale: string, mod: (typeof LOCALE_MODULES)[number]): Record<string, unknown> | null {
  const filePath = path.join(process.cwd(), "messages", locale, `${mod}.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

/** Deep-merge `overlay` onto `base` — locale wins; English fills gaps. */
function deepMergeMessages(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const prev = out[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      prev &&
      typeof prev === "object" &&
      !Array.isArray(prev)
    ) {
      out[key] = deepMergeMessages(
        prev as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

export async function loadLocaleMessages(locale: string): Promise<AbstractIntlMessages> {
  const localized = (await import(`../../messages/${locale}.json`)).default as unknown as Record<
    string,
    unknown
  >;

  let merged: Record<string, unknown> = { ...localized };

  // Fill any missing keys from English so es/de/fr never show raw message ids.
  if (locale !== "en") {
    const en = (await import(`../../messages/en.json`)).default as unknown as Record<
      string,
      unknown
    >;
    merged = deepMergeMessages(en, merged);
  }

  for (const mod of LOCALE_MODULES) {
    const modMessages =
      readLocaleModule(locale, mod) ?? (locale !== "en" ? readLocaleModule("en", mod) : null);
    if (modMessages) merged[mod] = modMessages;
  }

  return merged as unknown as AbstractIntlMessages;
}
