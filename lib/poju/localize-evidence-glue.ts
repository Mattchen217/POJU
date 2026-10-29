/**
 * Display-time evidence connective.
 * Mark pads are Chinese function-word glue. Term slots render in the UI locale,
 * so an English book otherwise shows "Era在机制上衔接Dew".
 * Stored books re-render without a regenerate. zh is unchanged.
 */

import { deliveryLocaleBucket } from "@/lib/llm/pro/delivery/delivery-locale";

/** Structural pads inserted between term slots (not case sentences). */
const ZH_EVIDENCE_GLUE_PADS = [
  "这一环接着落到下一点",
  "在机制上衔接",
  "由此引动",
  "并落到此处",
  "再对照结构",
] as const;

const GLUE_REPLACEMENT: Record<
  "en" | "es" | "fr",
  Record<(typeof ZH_EVIDENCE_GLUE_PADS)[number], string>
> = {
  en: {
    "这一环接着落到下一点": " and the next link is ",
    "在机制上衔接": " links, in how this works, to ",
    "由此引动": " and that sets in motion ",
    "并落到此处": " and it shows up here in ",
    "再对照结构": " set against the pattern of ",
  },
  es: {
    "这一环接着落到下一点": " y el siguiente eslabón es ",
    "在机制上衔接": " enlaza, en cómo funciona, con ",
    "由此引动": " y eso pone en marcha ",
    "并落到此处": " y aquí se ve en ",
    "再对照结构": " frente al patrón de ",
  },
  fr: {
    "这一环接着落到下一点": " et le maillon suivant est ",
    "在机制上衔接": " relie, dans le fonctionnement, ",
    "由此引动": " et cela met en mouvement ",
    "并落到此处": " et cela se voit ici dans ",
    "再对照结构": " face au schéma de ",
  },
};

/** Function-word Han only — leftover glue stuck to a Latin token. */
const GLUE_HAN_CHARS = new Set(
  "这一环接着落到下一点在机制上衔接由此引动并此处再对照结构的了着过与及和而之".split(""),
);

function joinerFor(locale: string): string {
  const bucket = deliveryLocaleBucket(locale);
  if (bucket === "es") return " y ";
  if (bucket === "fr") return " et ";
  return " ";
}

function isGlueHanRun(han: string): boolean {
  if (!han) return false;
  for (const ch of han) {
    if (!GLUE_HAN_CHARS.has(ch)) return false;
  }
  return true;
}

/**
 * Replace Chinese slot-glue with a locale connector.
 * Real Chinese sentences (content characters) stay — this only lifts function-word pads.
 */
export function localizeEvidenceGlue(text: string, locale: string): string {
  const raw = text ?? "";
  if (!raw) return raw;
  const bucket = deliveryLocaleBucket(locale);
  if (bucket === "zh" || bucket === "de") return raw;
  const table = GLUE_REPLACEMENT[bucket];
  let out = raw;
  for (const pad of ZH_EVIDENCE_GLUE_PADS) {
    if (out.includes(pad)) out = out.split(pad).join(table[pad]);
  }
  const join = joinerFor(locale);
  out = out.replace(
    /([A-Za-z0-9])([\u4e00-\u9fff]{1,16})([A-Za-z])/g,
    (full, left: string, han: string, right: string) =>
      isGlueHanRun(han) ? `${left}${join}${right}` : full,
  );
  return out.replace(/[ \t]{2,}/g, " ");
}
