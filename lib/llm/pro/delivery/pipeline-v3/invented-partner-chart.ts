/**
 * #13 Invented partner chart on solo / partner_bazi=absent —
 * prompt duty + category gate (delivery body + Companion share detector).
 *
 * When path=solo or partner_bazi=absent (or Companion relation_boundary says
 * no partner chart), visible prose must not fabricate partner day-master,
 * luck pillars, dyad/合盘 scores, or partner-bazi specifics.
 * Boundary / ban-copy that *forbids* inventing is allowed.
 * path=dyad / partner_bazi=present: gate does not fire (grounded anchors OK).
 */

export const INVENTED_PARTNER_CHART_RULE_ID =
  "gate_body_invented_partner_chart_on_solo" as const;

/** Companion day-gate alias (same detector). */
export const COMPANION_INVENTED_PARTNER_CHART_RULE_ID =
  "companion_invented_partner_chart_on_solo" as const;

export const INVENTED_PARTNER_CHART_DUTY_LINE =
  `  · **臆造对方盘整类（硬 · #13）**：path=solo / partner_bazi=absent 时禁写对方日主/大运/合盘分数/对方八字专名；只写自述可观察行为 + 你侧栏杆；边界禁令句本身允许`;

export type InventedPartnerKind =
  | "partner_day_master"
  | "partner_luck_pillar"
  | "dyad_score"
  | "partner_bazi_spec";

export type InventedPartnerHit = {
  kind: InventedPartnerKind;
  hit: string;
};

export type PartnerChartPathInput = {
  partner_bazi?: "absent" | "present" | null;
  pivot_chart_path?: "solo" | "dyad" | null;
  /** Companion brief relation_boundary fallback when path fields absent. */
  relation_boundary?: string | null;
};

/**
 * True when hard gate should run: explicit solo/absent, or Companion
 * relation_boundary that declares no partner chart.
 * present/dyad → false. Unset non-dyad → false (no gate).
 */
export function isPartnerChartAbsentPath(
  input: PartnerChartPathInput,
): boolean {
  if (input.partner_bazi === "present" || input.pivot_chart_path === "dyad") {
    return false;
  }
  if (input.partner_bazi === "absent" || input.pivot_chart_path === "solo") {
    return true;
  }
  const rb = String(input.relation_boundary ?? "");
  if (/无对方盘|without partner chart/i.test(rb)) return true;
  return false;
}

const PARTNER_DAY_MASTER_RE =
  /(?:对方|他的|她的|其)日主|(?:他|她)是[甲乙丙丁戊己庚辛壬癸][木火土金水]?日主|对方是[甲乙丙丁戊己庚辛壬癸][木火土金水]?|partner'?s?\s+day[\s-]?master|their\s+day[\s-]?master|day[\s-]?master\s+(?:is|=)\s*[甲乙丙丁戊己庚辛壬癸A-Za-z]/i;

const PARTNER_LUCK_PILLAR_RE =
  /(?:对方|他的|她的|其)大运|对方走[甲乙丙丁戊己庚辛壬癸]|partner'?s?\s+(?:current\s+)?(?:luck|decade)\s*pillars?|their\s+(?:current\s+)?(?:luck|decade)\s*pillars?/i;

const DYAD_SCORE_RE =
  /合盘分数|合盘\s*\d{1,3}\s*分|契合度\s*[：:=]?\s*\d{1,3}|匹配度\s*\d{1,3}\s*%?|合盘指数|resonance[_\s-]?index\s*[：:=]?\s*\d+|dyad\s+score\s*[：:=]?\s*\d+|compatibility\s+score\s*[：:=]?\s*\d+/i;

const PARTNER_BAZI_SPEC_RE =
  /(?:对方|他的|她的)八字|(?:对方|他的|她的)命盘|对方用神|对方喜用|对方忌神|partner'?s?\s+(?:bazi|ba\s*zi|birth\s*chart|八字)|their\s+(?:bazi|ba\s*zi|birth\s*chart)/i;

/** Ban / boundary copy windows — invent *prohibition* is OK, not a soft-pass invent. */
function isBanOrBoundaryWindow(text: string, index: number, hitLen: number): boolean {
  const start = Math.max(0, index - 36);
  const end = Math.min(text.length, index + hitLen + 48);
  const window = text.slice(start, end);
  return /禁止臆造|禁臆造|never invent|do not invent|don't invent|无对方盘|without partner chart|partner_bazi\s*=\s*absent|path\s*=\s*solo|只钉你侧|stay on your rails/i.test(
    window,
  );
}

function firstInventHit(
  re: RegExp,
  text: string,
  kind: InventedPartnerKind,
): InventedPartnerHit | null {
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  const global = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = global.exec(text)) != null) {
    const hit = m[0] ?? "";
    if (!hit) continue;
    if (isBanOrBoundaryWindow(text, m.index, hit.length)) continue;
    return { kind, hit: hit.slice(0, 48) };
  }
  return null;
}

/**
 * Find first invented partner-chart claim in visible prose.
 * Call only when isPartnerChartAbsentPath(...) is true (or pass force).
 */
export function findInventedPartnerChart(
  visible: string,
): InventedPartnerHit | null {
  const text = String(visible ?? "");
  if (!text.trim()) return null;

  return (
    firstInventHit(PARTNER_DAY_MASTER_RE, text, "partner_day_master") ??
    firstInventHit(PARTNER_LUCK_PILLAR_RE, text, "partner_luck_pillar") ??
    firstInventHit(DYAD_SCORE_RE, text, "dyad_score") ??
    firstInventHit(PARTNER_BAZI_SPEC_RE, text, "partner_bazi_spec")
  );
}

/**
 * Gate-ready: only fails when path is solo/absent AND prose invents partner chart.
 */
export function findInventedPartnerChartOnSoloPath(
  visible: string,
  path: PartnerChartPathInput,
): InventedPartnerHit | null {
  if (!isPartnerChartAbsentPath(path)) return null;
  return findInventedPartnerChart(visible);
}

export function inventedPartnerChartGateDetail(hit: InventedPartnerHit): string {
  return (
    `可见层在 solo / partner_bazi=absent 路径臆造对方盘（#13 · ${hit.kind}：「${hit.hit}」）。` +
    `禁对方日主/大运/合盘分数/对方八字专名；只写用户自述可观察行为与你侧栏杆。` +
    `边界禁令句本身允许。闸门不改稿；回改正文或 Companion 后重跑。`
  );
}

export function companionInventedPartnerChartGateDetail(
  hit: InventedPartnerHit,
): string {
  return (
    `Companion 可见字段在无对方盘路径臆造对方命理（#13 · ${hit.kind}：「${hit.hit}」）。` +
    `日提醒只钉你侧主辅 + 可观察现实；禁对方日主/大运/合盘分数。回改后重跑。`
  );
}

/** Shared duty / polish ban block (#13). */
export function inventedPartnerChartPromptBlock(
  locale: "zh" | "en" | "es" | "fr" = "zh",
): string {
  if (locale === "en") {
    return [
      "## Invented partner chart ban (#13 · solo / partner_bazi=absent)",
      "- When path=solo or partner_bazi=absent: **ban** inventing their day-master, luck pillars, dyad/合盘 scores, or partner-bazi specifics.",
      "- **Allow** observable partner behavior from collecting, and boundary copy that forbids inventing.",
      "- When partner_bazi=present / path=dyad: structure anchors from feed are OK — still no Match chapter wallpaper.",
    ].join("\n");
  }
  if (locale === "es") {
    return [
      "## Prohibido inventar carta de pareja (#13 · solo / partner_bazi=absent)",
      "- En path=solo o partner_bazi=absent: prohibido inventar su día maestro, pilares de suerte, puntuación de dyad o bazi ajeno.",
      "- Permitido conducta observable recogida y el texto de frontera que lo prohíbe.",
      "- Con partner_bazi=present: anclas del feed OK; sin capítulo Match.",
    ].join("\n");
  }
  if (locale === "fr") {
    return [
      "## Interdit d'inventer le thème partenaire (#13 · solo / partner_bazi=absent)",
      "- path=solo ou partner_bazi=absent : interdiction d'inventer leur maître du jour, piliers de chance, score dyad ou bazi partenaire.",
      "- Autorisé : comportement observable collecté + copie de frontière qui l'interdit.",
      "- partner_bazi=present : ancres du feed OK ; pas de chapitre Match.",
    ].join("\n");
  }
  return [
    "## 臆造对方盘禁令（#13 · solo / partner_bazi=absent）",
    "- path=solo 或 partner_bazi=absent：**禁**臆造对方日主、大运、合盘/契合分数、对方八字专名。",
    "- **允许**收集里自述的对方可观察行为，以及「无对方盘/禁臆造」边界句本身。",
    "- partner_bazi=present / path=dyad：可用喂料结构锚校准你侧；仍禁合盘专章墙。",
  ].join("\n");
}
