import de from "../../messages/de.json";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import fr from "../../messages/fr.json";
import zh from "../../messages/zh.json";

export type MatrixLocale = "en" | "zh" | "es" | "de" | "fr";

type PojuMatrixMsgs = (typeof en)["poju_matrix"];

const BY_LOCALE: Record<MatrixLocale, PojuMatrixMsgs> = {
  en: en.poju_matrix,
  zh: zh.poju_matrix,
  es: es.poju_matrix,
  de: de.poju_matrix,
  fr: fr.poju_matrix,
};

export function normalizeMatrixLocale(locale: string): MatrixLocale {
  const l = locale.toLowerCase();
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("es")) return "es";
  if (l.startsWith("de")) return "de";
  if (l.startsWith("fr")) return "fr";
  return "en";
}

function getNested(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

/** Server-safe poju_matrix string lookup (card + template namespaces). */
export function tMatrix(locale: string, key: string, vars?: Record<string, string>): string {
  const loc = normalizeMatrixLocale(locale);
  let s = getNested(BY_LOCALE[loc], key) ?? getNested(BY_LOCALE.en, key) ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, v);
    }
  }
  return s;
}
