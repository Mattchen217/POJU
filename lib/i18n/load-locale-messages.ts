import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { AbstractIntlMessages } from "next-intl";

const LOCALE_MODULES = ["disclaimer", "refund", "terms", "cookies"] as const;

function readLocaleModule(locale: string, mod: (typeof LOCALE_MODULES)[number]): Record<string, unknown> | null {
  const filePath = path.join(process.cwd(), "messages", locale, `${mod}.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

export async function loadLocaleMessages(locale: string): Promise<AbstractIntlMessages> {
  const base = (await import(`../../messages/${locale}.json`)).default as AbstractIntlMessages;
  const merged: Record<string, unknown> = { ...(base as Record<string, unknown>) };

  for (const mod of LOCALE_MODULES) {
    const localized = readLocaleModule(locale, mod) ?? (locale !== "en" ? readLocaleModule("en", mod) : null);
    if (localized) merged[mod] = localized;
  }

  return merged as AbstractIntlMessages;
}
