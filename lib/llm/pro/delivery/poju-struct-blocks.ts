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
      metaCol: "玄学适配",
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
      metaCol: "Ajuste metafísico",
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
      metaCol: "Ajustement métaphysique",
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
    metaCol: "Metaphysics fit",
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
  return /能量仪表盘|分值暂缺|双轨节奏|三阶段路线|周次\s*\d|科学动作|玄学适配|核心速览|Key Takeaways|Puntos Clave|Points Clés|Energy dashboard|dual-track|待补|empty_note|output_capacity|见本页正文|See page body/i.test(
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

/**
 * 4-week dual-track skeleton from spine + pack.
 * Labels are deterministic facts/actions — model must not invent the grid.
 */
export function buildThirtyDayGanttStruct(
  core: BreakthroughCore | null | undefined,
  locale: string,
): ThirtyDayGanttStruct {
  const c = copyFor(locale);
  const frames = core?.modern_action_frames ?? [];
  const rf = core?.rhythm_frame;
  const pack = core?.metaphysics_pack;

  const sciencePool = frames
    .map((f) => truncateLabel(f.direction))
    .filter(Boolean);
  while (sciencePool.length < 4) {
    sciencePool.push(locale.startsWith("zh") ? "（待补科学动作）" : "(science action TBD)");
  }

  const preferred = pack?.directions.preferred?.length
    ? pack.directions.preferred.join(" / ")
    : "";
  const hours = (pack?.favorable_hours ?? [])
    .filter((h) => h.match === "primary")
    .slice(0, 2)
    .map((h) => `${h.branch} ${h.period}`)
    .join(locale.startsWith("zh") ? "；" : "; ");
  const color = pack?.color.labels_zh?.slice(0, 2).join("/") ?? pack?.color.labels_en?.slice(0, 2).join("/") ?? "";
  const noble =
    pack?.noble.instances[0] != null
      ? `${pack.noble.instances[0].direction} · ${pack.noble.instances[0].traits_zh[0] ?? pack.noble.instances[0].traits_en[0] ?? ""}`
      : pack?.noble.theoretical_slots[0] != null
        ? `${pack.noble.theoretical_slots[0].direction}`
        : "";

  const metaPool = [
    preferred
      ? locale.startsWith("zh")
        ? `朝向适配：${preferred}`
        : `Direction fit: ${preferred}`
      : locale.startsWith("zh")
        ? "朝向：按用神适配方位"
        : "Direction: follow fit map",
    hours
      ? locale.startsWith("zh")
        ? `精力高频：${hours}`
        : `High-energy windows: ${hours}`
      : locale.startsWith("zh")
        ? "择时：匹配用神时辰"
        : "Timing: match favorable hours",
    color
      ? locale.startsWith("zh")
        ? `视觉锚定：${color}`
        : `Visual anchor: ${color}`
      : locale.startsWith("zh")
        ? "色彩：用神色系锚定"
        : "Color: yong-shen visual anchor",
    noble
      ? locale.startsWith("zh")
        ? `互补协同：${noble}`
        : `Complementary ally: ${noble}`
      : locale.startsWith("zh")
        ? "贵人：互补型伙伴（无生肖）"
        : "Ally: complementary collaborator (no zodiac)",
  ];

  const phaseHints = [
    rf?.phase1_observe?.trim() || c.phases[0],
    rf?.phase2_adjust?.trim() || c.phases[1],
    // Week 3 continues adjust with a distinct label — do not clone week-2 text verbatim.
    truncateLabel(
      rf?.phase2_adjust?.trim()
        ? locale.startsWith("zh")
          ? `深化调整：${rf.phase2_adjust}`
          : `Deepen adjust: ${rf.phase2_adjust}`
        : c.phases[2],
      48,
    ),
    rf?.phase3_consolidate?.trim() || c.phases[3],
  ];

  // Prefer distinct science frames; if only 2–3 frames, rotate rather than "TBD".
  const scienceForWeek = (i: number): string => {
    if (sciencePool[i] && !/TBD|待补/.test(sciencePool[i]!)) return sciencePool[i]!;
    const pool = sciencePool.filter((s) => !/TBD|待补/.test(s));
    if (pool.length === 0) return sciencePool[i]!;
    return pool[i % pool.length]!;
  };

  const weeks: ThirtyDayWeekStruct[] = ([1, 2, 3, 4] as const).map((week, i) => ({
    week,
    phase_label: truncateLabel(String(phaseHints[i]!), 48),
    science: [scienceForWeek(i)],
    metaphysics: [metaPool[i]!],
  }));

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
  if (key === "energy_base") {
    const dash = buildEnergyDashboardStruct(core?.metaphysics_pack, locale);
    const roadmap = buildThreePhaseRoadmapStruct(core, locale, { markCurrentPhase1: true });
    return [
      `${encodePojuStruct(dash)}\n\n${formatStructFallbackMarkdown(dash, locale)}`,
      `${encodePojuStruct(roadmap)}\n\n${formatStructFallbackMarkdown(roadmap, locale)}`,
    ].join("\n\n");
  }
  if (key === "macro_cycle") {
    const roadmap = buildThreePhaseRoadmapStruct(core, locale, { markCurrentPhase1: true });
    return `${encodePojuStruct(roadmap)}\n\n${formatStructFallbackMarkdown(roadmap, locale)}`;
  }
  if (key === "thirty_day") {
    const payload = buildThirtyDayGanttStruct(core, locale);
    return `${encodePojuStruct(payload)}\n\n${formatStructFallbackMarkdown(payload, locale)}`;
  }
  return "";
}

