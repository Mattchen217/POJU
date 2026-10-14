/**
 * #9 Template voice (A/B/C) — prompt ban block + regex-safe gate detector.
 * Prefer prompt + gate; do not blanket-scrub "energy" (energy picture / 能量画像 allowed).
 * SSOT: Copy quality item #9 — after name-delete, page must still feel case-specific.
 */

export const TEMPLATE_VOICE_RULE_ID = "gate_body_template_wallpaper" as const;

/** Shared duty / polish ban+prefer (EN categories + ZH align). */
export function templateVoicePromptBlock(locale: "zh" | "en" | "es" | "fr" = "en"): string {
  if (locale === "zh") {
    return [
      `## 模板腔禁区 · 本案钉死（#9 · 类别 · 换盘仍成立）`,
      `- **禁能量脚手架整页当脊梁**：能量结构 / 能量调频 / 能量泄漏 / 能量空转 / 反复「给能量充电」堆到换人也能穿。`,
      `- **禁口头禅/箴言式金句堆**：口头禅、箴言、今日箴言、默念这句肯定语当交付填料。`,
      `- **禁万能对仗墙纸**：表面轻松、底下刺痛；外面光滑、里面扎人；同类反义对仗换壳仍禁——删掉，用用户原词写真张力。`,
      `- **禁删人名后仍成立的运势开场**：泛「你当前的状态是…」长文且无锁定期望/收集事实。`,
      `- **要**：围期望（尤其开篇）；引用角色/期限/对方行为等收集事实；决策备忘口气（主辅路径·做什么·何时停）——不是能量使用手册；每页最多一个新鲜隐喻，扛不住主张就删。`,
      `- **允许**：能量画像（首次可短同位语）；方法论可提「三千年东方决策智慧」——禁占卜剧场与恐吓运势。`,
    ].join("\n");
  }
  if (locale === "es") {
    return [
      `## Voz plantilla prohibida (#9 · categorías)`,
      `- Prohibido andamiaje de energía apilado: estructura energética / retune / fuga / giro en vacío / recarga tu energía como columna del informe.`,
      `- Prohibido mantra / afirmación como relleno; prohibido díadas superficie fácil · pinchazo debajo.`,
      `- Preferir: clavar la expectativa; citar hechos recogidos; tono de memo de decisión; una metáfora fresca máx.`,
      `- Permitido: mapa de fuerzas / cuadro energético con glosa en la 1ª vez; sabiduría oriental de decisión — sin teatro de adivinación.`,
    ].join("\n");
  }
  if (locale === "fr") {
    return [
      `## Voix modèle interdite (#9 · catégories)`,
      `- Interdit échafaudage énergie empilé: structure énergétique / retune / fuite / tourne à vide / recharge ton énergie comme colonne.`,
      `- Interdit mantra / affirmation rempli; interdit couplets surface facile · piqûre dessous.`,
      `- Préférer: clouer l'attente; citer faits collectés; ton mémo de décision; une métaphore fraîche max.`,
      `- Permis: tableau énergétique / carte des forces avec glose à la 1ère fois; sagesse orientale de décision — sans théâtre divinatoire.`,
    ].join("\n");
  }
  // en (default)
  return [
    `## Template voice ban (#9 · categories · still true after name-delete)`,
    `- **Ban stacked energy scaffolding as the report's spine**: energy structure / energy retune / energy leak / energy spinning / recharge your energy repeated until any user could wear it.`,
    `- **Ban mantra / affirmation catchphrases as delivery filler**: mantra, affirmation, hold this mantra, today's mantra.`,
    `- **Ban surface/sting couplets and clones**: easy surface · sting underneath; easy on the surface, sting underneath; smooth outside, sharp underneath — delete; say the real tension in their words.`,
    `- **Ban fortune-template openers that survive name-deletion**: generic "your current state is…" essays with no locked expectation / collecting fact.`,
    `- **Prefer**: nail the user's stated expectation in the first screens (P1 especially); cite collecting facts (roles, deadlines, partner behavior); decision-memo tone — main + backup path, what to do, when to stop — not an energy user-manual; one fresh metaphor max per page (drop if it doesn't carry the claim).`,
    `- **EN→vernacular swaps (examples)**: Your Energy Structure → Why this decision sticks for you; Energy Retune Plan → How to reset your next moves; energy is leaking / spinning in vain → effort burns out before the finish / friction eats the return; hold this mantra → one line you can act on tonight.`,
    `- **Allowed**: energy picture with first-use short appositive; methodology may lean on "3000 years of Eastern decision wisdom" — refuse scare-fortune / divination theater.`,
  ].join("\n");
}

/** Short line for P1–P6 pageDuty / polish avoidance (locale-neutral categories). */
export const TEMPLATE_VOICE_DUTY_LINE =
  `  · **模板腔/运势墙纸整类（#9 · 硬）**：禁能量结构·调频·泄漏脚手架堆；禁 mantra/affirmation/口头禅金句填料；禁「表面轻松·底下刺痛」万能对仗；禁删人名后仍成立的「你当前状态是…」运势开场。要：围期望·钉收集事实·决策备忘（主辅/做什么/何时停）；每页≤1隐喻。允许能量画像（禁写成能量使用手册）。`;

export type TemplateWallpaperHit = {
  kind:
    | "energy_stack"
    | "mantra"
    | "surface_sting"
    | "fortune_opener"
    | "energy_title";
  hit: string;
};

/** Targeted phrases only — not a blanket "energy" ban. */
const ENERGY_TITLE_RE =
  /\b(?:your\s+)?energy\s+structure\b|\benergy\s+retune(?:\s+plan)?\b|能量结构|能量调频/gi;

const ENERGY_LEAK_SPIN_RE =
  /\benergy\s+(?:is\s+)?leaking\b|\benergy\s+spinning(?:\s+in\s+vain)?\b|\brecharge\s+your\s+energy\b|能量泄漏|能量空转|给能量充电|能量充电/gi;

const MANTRA_RE =
  /\bhold\s+this\s+mantra\b|\btoday'?s\s+mantra\b|\bthis\s+affirmation\b|\b(?:daily\s+)?affirmation\b|\bmantra\b|今日箴言|口头禅|默念这句|肯定语/gi;

const SURFACE_STING_RE =
  /easy\s+(?:on\s+the\s+)?surface[\s·,，、\-–—]{0,12}(?:a\s+)?sting\s+underneath|smooth\s+outside[\s·,，、\-–—]{0,20}sharp\s+underneath|表面轻松[\s·,，、\-–—]{0,12}底下刺痛|表面[\s\S]{0,8}轻松[\s\S]{0,16}刺痛|外面光滑[\s\S]{0,12}里面扎/gi;

const FORTUNE_OPENER_RE =
  /\byour\s+current\s+state\s+is\b|你当前的状态是|你目前的状态是/gi;

/**
 * Detect template wallpaper in visible prose.
 * Returns null when clean (or only allowed "energy picture" / 能量画像).
 */
export function detectTemplateWallpaper(
  text: string,
): TemplateWallpaperHit | null {
  const t = String(text ?? "");
  if (!t.trim()) return null;

  const mantra = t.match(MANTRA_RE);
  if (mantra?.[0]) {
    return { kind: "mantra", hit: mantra[0].slice(0, 48) };
  }
  const sting = t.match(SURFACE_STING_RE);
  if (sting?.[0]) {
    return { kind: "surface_sting", hit: sting[0].slice(0, 64) };
  }
  const fortune = t.match(FORTUNE_OPENER_RE);
  if (fortune?.[0]) {
    return { kind: "fortune_opener", hit: fortune[0].slice(0, 48) };
  }
  const title = t.match(ENERGY_TITLE_RE);
  if (title?.[0]) {
    return { kind: "energy_title", hit: title[0].slice(0, 48) };
  }
  const leak = t.match(ENERGY_LEAK_SPIN_RE);
  if (leak?.[0]) {
    return { kind: "energy_stack", hit: leak[0].slice(0, 48) };
  }
  // Stacked energy-* scaffold tokens (title-ish), excluding energy picture / 能量画像
  const scrubbed = t
    .replace(/\benergy\s+picture\b/gi, " ")
    .replace(/能量画像/g, " ");
  const scaffoldHits = [
    ...scrubbed.matchAll(/\benergy\s+(?:structure|retune|leak|leaking|spinning|recharge)\b/gi),
    ...scrubbed.matchAll(/能量(?:结构|调频|泄漏|空转)/g),
  ];
  if (scaffoldHits.length >= 2) {
    return {
      kind: "energy_stack",
      hit: scaffoldHits
        .slice(0, 3)
        .map((m) => m[0])
        .join(" · ")
        .slice(0, 72),
    };
  }
  return null;
}

export function templateWallpaperGateDetail(hit: TemplateWallpaperHit): string {
  return (
    `可见层撞模板腔/运势墙纸（#9 · ${hit.kind}：「${hit.hit}」）。` +
    `禁能量结构·调频·泄漏脚手架、mantra/affirmation、表面/刺痛万能对仗、删人名后仍成立的运势开场；` +
    `改成本案期望+收集事实的决策备忘口气后重跑——闸门不改稿。允许 energy picture / 能量画像。`
  );
}
