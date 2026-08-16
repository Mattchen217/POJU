import type { AbstractIntlMessages } from "next-intl";

import enAuth from "../../messages/en/auth.json";
import enContact from "../../messages/en/contact.json";
import deAuth from "../../messages/de/auth.json";
import deContact from "../../messages/de/contact.json";
import esAuth from "../../messages/es/auth.json";
import esContact from "../../messages/es/contact.json";
import frAuth from "../../messages/fr/auth.json";
import frContact from "../../messages/fr/contact.json";
import zhAuth from "../../messages/zh/auth.json";
import zhContact from "../../messages/zh/contact.json";

/** Bundled locale modules — must be static imports (Vercel has no cwd JSON for readFileSync). */
const LOCALE_MODULES = {
  en: { contact: enContact, auth: enAuth },
  zh: { contact: zhContact, auth: zhAuth },
  es: { contact: esContact, auth: esAuth },
  fr: { contact: frContact, auth: frAuth },
  de: { contact: deContact, auth: deAuth },
} as const;

type LocaleModuleName = "contact" | "auth";

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

function resolveModuleMessages(
  locale: string,
  mod: LocaleModuleName,
): Record<string, unknown> {
  const enMod = LOCALE_MODULES.en[mod] as Record<string, unknown>;
  const locBundle = LOCALE_MODULES[locale as keyof typeof LOCALE_MODULES];
  const locMod = (locBundle?.[mod] ?? null) as Record<string, unknown> | null;
  if (!locMod || locale === "en") return { ...enMod };
  // English fills gaps; locale overlays — never leave contact/auth as the thin stub from *.json.
  return deepMergeMessages(enMod, locMod);
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

  for (const mod of ["contact", "auth"] as const) {
    merged[mod] = resolveModuleMessages(locale, mod);
  }

  return merged as unknown as AbstractIntlMessages;
}
