/**
 * Layer 3 · code-owned delivery structures (P1 dashboard, P7 4-week dual track).
 * Encoded as ```poju-struct fenced JSON so UI can render widgets; prose stays outside.
 */

import type { MetaphysicsPack } from "@/lib/calculations/metaphysics-pack";
import { deliveryLocaleBucket } from "@/lib/llm/pro/delivery/delivery-locale";
import {
  degradeMarkersToPlain,
  stripBrokenMarkers,
} from "@/lib/llm/sanitize/term-marking";
import type { BreakthroughCore } from "@/lib/poju/agent-state";

export type EnergyDashboardStruct = {
  kind: "energy_dashboard";
  output_capacity: number;
  sustain_capacity: number;
  resistance_load: number;
  source: "chart" | "empty";
  labels: {
    title: string;
    output: string;
    sustain: string;
    resistance: string;
    empty_note: string;
  };
};

export type ThirtyDayWeekStruct = {
  week: 1 | 2 | 3 | 4;
  phase_label: string;
  science: string[];
  metaphysics: string[];
};

export type ThirtyDayGanttStruct = {
  kind: "thirty_day_gantt";
  weeks: ThirtyDayWeekStruct[];
  labels: {
    title: string;
    science_col: string;
    metaphysics_col: string;
    week_col: string;
  };
};

export type ThreePhaseRoadmapStruct = {
  kind: "three_phase_roadmap";
  phases: Array<{
    id: "phase1" | "phase2" | "phase3";
    window: string;
    title: string;
    detail: string;
    current?: boolean;
  }>;
  labels: { title: string };
};

export type PageScanItem = {
  label: string;
  value: string;
};

/**
 * Model-authored glance strip (2–4 dynamic items).
 * Legacy strategy/homework/key kept optional for old reports.
 */
export type PageScanCardStruct = {
  kind: "page_scan_card";
  items: PageScanItem[];
  labels: { title: string };
  /** @deprecated mapped into items when reading old fences */
  strategy?: string;
  homework?: string;
  key?: string;
};

export type PojuStructPayload =
  | EnergyDashboardStruct
  | ThirtyDayGanttStruct
  | ThreePhaseRoadmapStruct
  | PageScanCardStruct;

const FENCE_RE = /```poju-struct\s*\n([\s\S]*?)```/g;

function copyFor(locale: string) {
  const b = deliveryLocaleBucket(locale);
  if (b === "zh") {
    return {
      dashTitle: "能量仪表盘（真算分值）",
      output: "输出力",
      sustain: "续航力",
      resistance: "阻力负载",
      emptyNote: "分值暂缺——本段只做定性说明，不编造数字。",
      ganttTitle: "未来30天双轨节奏（按周）",
      scienceCol: "科学动作",
      metaCol: "环境与时区调频",
      weekCol: "周次",
      phases: ["观察校准", "小步调整", "巩固推进", "收束复盘"] as const,
      roadmapTitle: "三阶段路线图（节奏感，非日期断言）",
      phaseWindows: ["1–3个月 · 蓄水养根", "4–6个月 · 松动试探", "7–12个月 · 自然吸引"] as const,
      phaseTitles: ["蓄水期", "松动期", "吸引期"] as const,
      scanTitle: "核心速览",
    };
  }
  if (b === "es") {
    return {
      dashTitle: "Panel energético (calculado)",
      output: "Salida",
      sustain: "Sostenimiento",
      resistance: "Resistencia",
      emptyNote: "Puntuaciones no disponibles — solo cualitativo; sin números inventados.",
      ganttTitle: "Ritmo de doble vía a 30 días (por semana)",
      scienceCol: "Acciones científicas",
      metaCol: "Alineación ambiental y horaria",
      weekCol: "Semana",
      phases: ["Observar", "Ajustar", "Consolidar", "Cerrar el ciclo"] as const,
      roadmapTitle: "Hoja de ruta en tres fases (ritmo, no fechas)",
      phaseWindows: [
        "Meses 1–3 · acumular y enraizar",
        "Meses 4–6 · aflojar y probar",
        "Meses 7–12 · atraer con naturalidad",
      ] as const,
      phaseTitles: ["Acumular", "Aflojar", "Atraer"] as const,
      scanTitle: "Puntos Clave",
    };
  }
  if (b === "fr") {
    return {
      dashTitle: "Tableau de bord énergétique (calculé)",
      output: "Output",
      sustain: "Endurance",
      resistance: "Résistance",
      emptyNote: "Scores indisponibles — qualitatif uniquement ; pas de chiffres inventés.",
      ganttTitle: "Rythme double voie sur 30 jours (par semaine)",
      scienceCol: "Actions scientifiques",
      metaCol: "Alignement environnemental et horaire",
      weekCol: "Semaine",
      phases: ["Observer", "Ajuster", "Consolider", "Clôturer"] as const,
      roadmapTitle: "Feuille de route en trois phases (rythme, pas de dates)",
      phaseWindows: [
        "Mois 1–3 · stocker et enraciner",
        "Mois 4–6 · assouplir et tester",
        "Mois 7–12 · attirer naturellement",
      ] as const,
      phaseTitles: ["Stocker", "Assouplir", "Attirer"] as const,
      scanTitle: "Points Clés",
    };
  }
  return {
    dashTitle: "Energy dashboard (computed)",
    output: "Output",
    sustain: "Sustain",
    resistance: "Resistance",
    emptyNote: "Scores unavailable — qualitative only; no invented numbers.",
    ganttTitle: "30-day dual-track rhythm (by week)",
    scienceCol: "Science actions",
    metaCol: "Environmental Alignment",
    weekCol: "Week",
    phases: ["Observe", "Adjust", "Consolidate", "Close the loop"] as const,
    roadmapTitle: "Three-phase roadmap (rhythm, not calendar claims)",
    phaseWindows: [
      "Months 1–3 · store & root",
      "Months 4–6 · loosen & test",
      "Months 7–12 · natural attract",
    ] as const,
    phaseTitles: ["Store", "Loosen", "Attract"] as const,
    scanTitle: "Key Takeaways",
  };
}

export function encodePojuStruct(payload: PojuStructPayload): string {
  return `\`\`\`poju-struct\n${JSON.stringify(payload)}\n\`\`\``;
}

export function parsePojuStructPayloads(text: string): PojuStructPayload[] {
  const out: PojuStructPayload[] = [];
  const re = new RegExp(FENCE_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) != null) {
    try {
      const raw = JSON.parse(m[1]!.trim()) as PojuStructPayload;
      if (
        raw?.kind === "energy_dashboard" ||
        raw?.kind === "thirty_day_gantt" ||
        raw?.kind === "three_phase_roadmap" ||
        raw?.kind === "page_scan_card"
      ) {
        out.push(raw);
      }
    } catch {
      // ignore malformed
    }
  }
  return out;
}

/** Strip all poju-struct fences from body (UI renders widgets separately). */
export function stripPojuStructFences(text: string): string {
  return text.replace(new RegExp(FENCE_RE.source, "g"), "").replace(/\n{3,}/g, "\n\n").trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * When UI already renders a widget, drop its markdown fallback twin
 * (prevents duplicate dashboard / gantt / roadmap blocks in prose modules).
 */
export function stripRenderedStructFallbacks(
  text: string,
  payloads: PojuStructPayload[],
  locale: string,
): string {
  let out = text;
  for (const p of payloads) {
    const exact = formatStructFallbackMarkdown(p, locale);
    if (exact && out.includes(exact)) {
      out = out.split(exact).join("\n");
    }
    const title = p.labels?.title?.trim();
    if (title) {
      const re = new RegExp(
        `(?:^|\\n)#{1,4}\\s*${escapeRegExp(title)}\\s*\\n[\\s\\S]*?(?=\\n#{1,3}\\s|$)`,
        "g",
      );
      out = out.replace(re, "\n");
    }
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/** Scan cards: plain vernacular only — no ⟦t:⟧, no soft-gloss “金字”. */
export function plainScanText(raw: string, locale: string, max = 96): string {
  let t = degradeMarkersToPlain(raw ?? "", locale);
  t = stripBrokenMarkers(t);
  t = t
    .replace(/⟦t:[^⟧]*⟧?/g, "")
    .replace(/t:[a-zA-Z0-9_]+/g, "")
    .replace(/[\[\]【】⟦⟧|]/g, " ")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";
  const full = t.match(/^[\s\S]{6,140}?[。.!？?]/);
  if (full) return full[0]!.trim();
  return truncateLabel(t, max);
}

function isWidgetChromeLine(s: string): boolean {
  return /能量仪表盘|分值暂缺|双轨节奏|三阶段路线|周次\s*\d|科学动作|玄学适配|环境与时区调频|核心速览|Key Takeaways|Puntos Clave|Points Clés|Energy dashboard|Environmental Alignment|dual-track|待补|empty_note|output_capacity|见本页正文|See page body/i.test(
    s,
  );
}

export function buildEnergyDashboardStruct(
  pack: MetaphysicsPack | null | undefined,
  locale: string,
): EnergyDashboardStruct {
  const c = copyFor(locale);
  const dash = pack?.dashboard;
  return {
    kind: "energy_dashboard",
    output_capacity: dash?.output_capacity ?? 0,
    sustain_capacity: dash?.sustain_capacity ?? 0,
    resistance_load: dash?.resistance_load ?? 0,
    source: pack?.element_scores_source ?? "empty",
    labels: {
      title: c.dashTitle,
      output: c.output,
      sustain: c.sustain,
      resistance: c.resistance,
      empty_note: c.emptyNote,
    },
  };
}

function truncateLabel(s: string, max = 36): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const DIR_GLOSS_ZH: Record<string, string> = {
  N: "正北",
  NE: "东北",
  E: "正东",
  SE: "东南",
  S: "正南",
  SW: "西南",
  W: "正西",
  NW: "西北",
};

function glossDirs(dirs: string[], locale: string): string {
  if (!dirs.length) return "";
  if (locale.startsWith("zh")) {
    return dirs.map((d) => DIR_GLOSS_ZH[d] ?? d).join(" / ");
  }
  return dirs.join(" / ");
}

/**
 * Compact fact anchors for the thirty_day narrative prompt.
 * Model must rewrite into compliant vernacular table cells — not code-style abbreviations.
 */
export function formatThirtyDayTableFacts(
  core: BreakthroughCore | null | undefined,
): string {
  if (!core) return "";
  const pack = core.metaphysics_pack;
  const lines: string[] = [];
  const preferred = pack?.directions.preferred ?? [];
  if (preferred.length) {
    lines.push(
      `- 方位事实: ${preferred.join(" / ")} → 表内写成「推荐方位：${glossDirs(preferred, "zh")}」(英文 Optimal Directions: ${preferred.join(" / ")})；禁止只写裸字母缩写当整格。`,
    );
  }
  const hours = (pack?.favorable_hours ?? [])
    .filter((h) => h.match === "primary")
    .slice(0, 2);
  if (hours.length) {
    const periods = hours.map((h) => h.period).filter(Boolean).join("、");
    lines.push(
      `- 时段事实: ${hours.map((h) => `${h.branch} ${h.period}`).join("；")} → 表内写成「高频时段：夜间 ${periods || "…"}」(英文 Peak Focus Hours)；禁止写子/亥等地支字面。`,
    );
  }
  const colorZh = pack?.color.labels_zh?.slice(0, 2) ?? [];
  const colorEn = pack?.color.labels_en?.slice(0, 2) ?? [];
  if (colorZh.length || colorEn.length) {
    lines.push(
      `- 色彩事实: ${colorZh.join("、") || colorEn.join(", ")} → 表内写成「开运色彩/视觉锚点：…」(英文 Visual Anchors)。`,
    );
  }
  const noble = pack?.noble.instances[0];
  const nobleTraits =
    noble?.traits_zh?.slice(0, 2).join("、") ||
    noble?.traits_en?.slice(0, 2).join(", ") ||
    "";
  if (nobleTraits) {
    lines.push(
      `- 协同事实: 特质「${nobleTraits}」→ 表内写成「协同人群：具备…特质的伙伴」(英文 Synergistic Traits: …)；禁止只写方向字母 N/W。`,
    );
  } else if (pack?.noble.theoretical_slots[0]) {
    lines.push(
      `- 协同事实: 按互补特质写「协同人群：…」；禁止只写方向字母。`,
    );
  }
  const frames = (core.modern_action_frames ?? [])
    .map((f) => (f.direction ?? "").trim())
    .filter(Boolean)
    .slice(0, 6);
  if (frames.length) {
    lines.push(`- 科学动作候选(可改写分配到四周，勿照抄编号):\n${frames.map((f, i) => `  ${i + 1}. ${truncateLabel(f, 80)}`).join("\n")}`);
  }
  const rf = core.rhythm_frame;
  if (rf) {
    const rhythm = [
      rf.phase1_observe,
      rf.phase2_adjust,
      rf.phase3_consolidate,
    ]
      .map((s) => (s ?? "").trim())
      .filter(Boolean);
    if (rhythm.length) {
      lines.push(
        `- 周节奏提示(可改写为 phase_label，四周文案须互不相同):\n${rhythm.map((s, i) => `  ${i + 1}. ${truncateLabel(s, 80)}`).join("\n")}`,
      );
    }
  }
  if (!lines.length) return "";
  return `【thirty_day_table 事实锚点 · 仅供改写进表，禁止照抄代码风缩写 / 禁词 / 干支】\n${lines.join("\n")}`;
}

function sanitizeGanttCell(raw: string, locale: string, max = 120): string {
  return plainScanText(raw, locale, max);
}

function normalizeGanttWeek(
  raw: unknown,
  weekFallback: 1 | 2 | 3 | 4,
  locale: string,
): ThirtyDayWeekStruct | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const weekNum = Number(o.week);
  const week = ([1, 2, 3, 4] as const).includes(weekNum as 1 | 2 | 3 | 4)
    ? (weekNum as 1 | 2 | 3 | 4)
    : weekFallback;
  const phase = sanitizeGanttCell(String(o.phase_label ?? ""), locale, 64);
  const scienceRaw = Array.isArray(o.science) ? o.science : [];
  const alignRaw = Array.isArray(o.alignment)
    ? o.alignment
    : Array.isArray(o.metaphysics)
      ? o.metaphysics
      : [];
  const science = scienceRaw
    .map((s) => sanitizeGanttCell(String(s ?? ""), locale, 140))
    .filter((s) => s.length >= 4)
    .slice(0, 3);
  const metaphysics = alignRaw
    .map((s) => sanitizeGanttCell(String(s ?? ""), locale, 140))
    .filter((s) => s.length >= 4)
    .slice(0, 3);
  if (!phase || science.length < 1 || metaphysics.length < 1) return null;
  return { week, phase_label: phase, science, metaphysics };
}

/** Build 4-week gantt from model `thirty_day_table` (preferred path). */
export function buildThirtyDayGanttFromModel(
  raw: unknown,
  locale: string,
): ThirtyDayGanttStruct | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const weeksRaw = Array.isArray(o.weeks) ? o.weeks : Array.isArray(raw) ? raw : null;
  if (!weeksRaw || weeksRaw.length < 4) return null;
  const weeks: ThirtyDayWeekStruct[] = [];
  for (let i = 0; i < 4; i++) {
    const w = normalizeGanttWeek(weeksRaw[i], (i + 1) as 1 | 2 | 3 | 4, locale);
    if (!w) return null;
    weeks.push({ ...w, week: (i + 1) as 1 | 2 | 3 | 4 });
  }
  const c = copyFor(locale);
  return {
    kind: "thirty_day_gantt",
    weeks,
    labels: {
      title: c.ganttTitle,
      science_col: c.scienceCol,
      metaphysics_col: c.metaCol,
      week_col: c.weekCol,
    },
  };
}

export function normalizeThirtyDayGanttStruct(
  raw: ThirtyDayGanttStruct | Record<string, unknown>,
  locale: string,
): ThirtyDayGanttStruct | null {
  const weeks =
    raw && typeof raw === "object" && Array.isArray((raw as ThirtyDayGanttStruct).weeks)
      ? (raw as ThirtyDayGanttStruct).weeks
      : null;
  const built = buildThirtyDayGanttFromModel(weeks ? { weeks } : raw, locale);
  return built ? localizeThirtyDayGanttLabels(built, locale) : null;
}

export function localizeThirtyDayGanttLabels(
  gantt: ThirtyDayGanttStruct,
  locale: string,
): ThirtyDayGanttStruct {
  const c = copyFor(locale);
  return {
    ...gantt,
    kind: "thirty_day_gantt",
    labels: {
      title: c.ganttTitle,
      science_col: c.scienceCol,
      metaphysics_col: c.metaCol,
      week_col: c.weekCol,
    },
  };
}

/** @deprecated Code extraction removed — model must emit thirty_day_table. */
export function buildThirtyDayGanttStruct(
  _core: BreakthroughCore | null | undefined,
  _locale: string,
): ThirtyDayGanttStruct | null {
  return null;
}

/** Fence + fallback markdown for a model thirty-day table. */
export function encodeThirtyDayGanttMarkdown(
  gantt: ThirtyDayGanttStruct,
  locale: string,
): string {
  const normalized = localizeThirtyDayGanttLabels(gantt, locale);
  if (normalized.weeks.length < 4) return "";
  return `${encodePojuStruct(normalized)}\n\n${formatStructFallbackMarkdown(normalized, locale)}`;
}

/** Human-readable fallback under the fence (archive / plain readers). */
export function formatStructFallbackMarkdown(payload: PojuStructPayload, locale: string): string {
  if (payload.kind === "energy_dashboard") {
    if (payload.source === "empty") {
      return `### ${payload.labels.title}\n\n${payload.labels.empty_note}`;
    }
    return [
      `### ${payload.labels.title}`,
      "",
      `- ${payload.labels.output}: ${payload.output_capacity}/100`,
      `- ${payload.labels.sustain}: ${payload.sustain_capacity}/100`,
      `- ${payload.labels.resistance}: ${payload.resistance_load}/100`,
    ].join("\n");
  }

  if (payload.kind === "three_phase_roadmap") {
    const lines = [`### ${payload.labels.title}`, ""];
    for (const p of payload.phases) {
      const mark = p.current ? (locale.startsWith("zh") ? "（当前）" : " (now)") : "";
      lines.push(`- **${p.window} · ${p.title}${mark}**: ${p.detail}`);
    }
    return lines.join("\n");
  }

  if (payload.kind === "page_scan_card") {
    const items = normalizePageScanItems(payload);
    return [
      `### ${payload.labels.title}`,
      "",
      ...items.map((it) => `- **${it.label}**: ${it.value}`),
    ].join("\n");
  }

  const lines: string[] = [`### ${payload.labels.title}`, ""];
  for (const w of payload.weeks) {
    const weekLabel = `${payload.labels.week_col} ${w.week}`;
    lines.push(`#### ${weekLabel} · ${w.phase_label}`);
    lines.push(`- ${payload.labels.science_col}: ${w.science.join(" / ")}`);
    lines.push(`- ${payload.labels.metaphysics_col}: ${w.metaphysics.join(" / ")}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function buildThreePhaseRoadmapStruct(
  core: BreakthroughCore | null | undefined,
  locale: string,
  opts?: { markCurrentPhase1?: boolean },
): ThreePhaseRoadmapStruct {
  const c = copyFor(locale);
  const rf = core?.rhythm_frame;
  return {
    kind: "three_phase_roadmap",
    labels: { title: c.roadmapTitle },
    phases: [
      {
        id: "phase1",
        window: c.phaseWindows[0],
        title: c.phaseTitles[0],
        detail: truncateLabel(rf?.phase1_observe?.trim() || c.phases[0], 72),
        current: opts?.markCurrentPhase1 !== false,
      },
      {
        id: "phase2",
        window: c.phaseWindows[1],
        title: c.phaseTitles[1],
        detail: truncateLabel(rf?.phase2_adjust?.trim() || c.phases[1], 72),
      },
      {
        id: "phase3",
        window: c.phaseWindows[2],
        title: c.phaseTitles[2],
        detail: truncateLabel(rf?.phase3_consolidate?.trim() || c.phases[3], 72),
      },
    ],
  };
}

/** Pull 2–4 items from model JSON or legacy strategy/homework/key. */
export function normalizePageScanItems(
  raw: Partial<PageScanCardStruct> | Record<string, unknown> | null | undefined,
): PageScanItem[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const fromItems: PageScanItem[] = [];
  if (Array.isArray(o.items)) {
    for (const it of o.items) {
      if (!it || typeof it !== "object") continue;
      const row = it as Record<string, unknown>;
      const label = typeof row.label === "string" ? row.label.trim() : "";
      const value = typeof row.value === "string" ? row.value.trim() : "";
      if (label && value) fromItems.push({ label, value });
    }
  }
  if (fromItems.length >= 2) return fromItems.slice(0, 4);

  const legacy: PageScanItem[] = [];
  const labels = (o.labels && typeof o.labels === "object"
    ? (o.labels as Record<string, unknown>)
    : {}) as Record<string, string>;
  const triples: Array<[string, string]> = [
    [labels.strategy || "当前策略", String(o.strategy ?? "")],
    [labels.homework || "核心功课", String(o.homework ?? "")],
    [labels.key || "破局钥匙", String(o.key ?? "")],
  ];
  for (const [label, value] of triples) {
    if (value.trim()) legacy.push({ label, value: value.trim() });
  }
  return legacy.slice(0, 4);
}

/** Build scan card from model `scan.items` (preferred path). */
export function buildPageScanCardFromModel(
  raw: unknown,
  locale: string,
): PageScanCardStruct | null {
  const c = copyFor(locale);
  if (!raw || typeof raw !== "object") return null;
  const items = normalizePageScanItems(raw as Record<string, unknown>)
    .map((it) => ({
      label: plainScanText(it.label, locale, 24) || it.label.trim().slice(0, 24),
      value: plainScanText(it.value, locale, 120) || it.value.trim(),
    }))
    .filter((it) => it.label && it.value && !isWidgetChromeLine(it.value));
  if (items.length < 2) return null;
  return {
    kind: "page_scan_card",
    items: items.slice(0, 4),
    labels: { title: c.scanTitle },
  };
}

/** Normalize any fence payload (new items or legacy) for UI. */
export function normalizePageScanCardStruct(
  raw: PageScanCardStruct | Record<string, unknown>,
  locale: string,
): PageScanCardStruct | null {
  const built = buildPageScanCardFromModel(raw, locale);
  if (built) return built;
  const items = normalizePageScanItems(raw as Record<string, unknown>);
  if (items.length < 2) return null;
  return buildPageScanCardFromModel({ items }, locale);
}

/** Re-apply chrome title + plain vernacular on items (old + new sessions). */
export function localizePageScanCardLabels(
  scan: PageScanCardStruct,
  locale: string,
): PageScanCardStruct {
  const c = copyFor(locale);
  const items = normalizePageScanItems(scan)
    .map((it) => ({
      label: plainScanText(it.label, locale, 24) || it.label,
      value: plainScanText(it.value, locale, 120) || it.value,
    }))
    .filter((it) => it.label && it.value);
  return {
    kind: "page_scan_card",
    items: items.length >= 2 ? items.slice(0, 4) : scan.items ?? items,
    labels: { title: c.scanTitle },
  };
}

/** @deprecated Heuristic extraction removed — model must emit scan.items. */
export function buildPageScanCardStruct(
  _pageBody: string,
  _locale: string,
  _fallbacks?: { strategy?: string; homework?: string; key?: string },
): PageScanCardStruct | null {
  return null;
}

/** Fence + fallback markdown for a model scan card. */
export function encodePageScanMarkdown(
  scan: PageScanCardStruct,
  locale: string,
): string {
  const normalized = localizePageScanCardLabels(scan, locale);
  if (normalized.items.length < 2) return "";
  return `${encodePojuStruct(normalized)}\n\n${formatStructFallbackMarkdown(normalized, locale)}`;
}

export function buildSegmentStructureMarkdown(
  key: string,
  locale: string,
  core: BreakthroughCore | null | undefined,
): string {
  if (key === "foundation") {
    const dash = buildEnergyDashboardStruct(core?.metaphysics_pack, locale);
    const roadmap = buildThreePhaseRoadmapStruct(core, locale, { markCurrentPhase1: true });
    return [
      `${encodePojuStruct(dash)}\n\n${formatStructFallbackMarkdown(dash, locale)}`,
      `${encodePojuStruct(roadmap)}\n\n${formatStructFallbackMarkdown(roadmap, locale)}`,
    ].join("\n\n");
  }
  // thirty_day gantt is model-authored (thirty_day_table) and encoded in the segment chain / merge page_structs.
  return "";
}

