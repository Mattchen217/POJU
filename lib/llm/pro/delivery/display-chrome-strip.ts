/**
 * Display-only B strip for JSON-shape example leftovers stuck in page_title /
 * page_subtitle (e.g. 「贴本案科学打法名：…」 / 「Ponle nombre al método…」).
 *
 * Does **not** mutate stored model output — callers apply before UI / export.
 * Category: shape-instruction chrome, still true on another chart/locale.
 */

/** Exact placeholders copied from body-prompt shape blocks (no real title after). */
const EXACT_SHAPE_PLACEHOLDERS = [
  "贴本案科学打法名",
  "贴本案的主标题（含具体取舍，禁空泛）",
  "贴本案的主标题",
  "贴本案气场博弈的暗锦囊名（禁「东方谋略三柱」空壳）",
  "贴本案气场博弈的暗锦囊名",
  "贴本案时位进退的谋略名（禁空壳三柱名；禁卦名当标题）",
  "贴本案时位进退的谋略名",
  "贴主辅节奏与可落实行动（零专名）",
  "贴本案的副题（写清主轨名 vs 辅轨名的实质对比；禁「点明攻坚轨 vs 止损轨」模板句）",
  "贴本案的副题",
  "点局势取向+意象稳压+仪轨节奏（零专名）",
  "点时位松紧+意象涵养+日用收势（零专名；禁贴卦辞）",
  "…",
  "...",
] as const;

/**
 * Leading instruction shells models keep then append the real title after : / ：
 * zh 贴本案*；es/fr calques of “name this case’s method”.
 */
const LEADING_SHAPE_PREFIXES: RegExp[] = [
  /^贴本案[^：:\n]{0,48}[：:]\s*/u,
  /^贴主辅[^：:\n]{0,48}[：:]\s*/u,
  /^Ponle nombre al método de este caso\s*[：:]\s*/iu,
  /^Donne(?:z)? un nom à (?:la )?méthode(?: de ce cas)?\s*[：:]\s*/iu,
  /^Name (?:this|the) case(?:'s|’s)? (?:science )?(?:method|play|playbook)\s*[：:]\s*/iu,
];

function normalizeChrome(raw: string): string {
  return String(raw ?? "")
    .replace(/\u00a0/g, " ")
    .trim();
}

/**
 * Strip shape-example chrome from a user-visible title/subtitle.
 * Returns empty string when the whole field was only a placeholder.
 */
export function stripShapeExampleChrome(raw: string): string {
  let t = normalizeChrome(raw);
  if (!t) return "";

  for (const exact of EXACT_SHAPE_PLACEHOLDERS) {
    if (t === exact) return "";
  }

  for (const re of LEADING_SHAPE_PREFIXES) {
    if (re.test(t)) {
      t = t.replace(re, "").trim();
      break;
    }
  }

  for (const exact of EXACT_SHAPE_PLACEHOLDERS) {
    if (t === exact) return "";
  }

  return t;
}
