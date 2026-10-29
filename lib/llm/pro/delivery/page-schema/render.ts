/**
 * Convert filled page_schema → argument tree (for evidence/mark) + markdown.
 * Each content unit carries chart_anchors (ClaimPlan) for calc-first evidence.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeliveryArgument } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  DELIVERY_PAGE_SCHEMA_VERSION,
  type DeliveryPageData,
  type RiskItem,
} from "./types";

/** Markdown fence language for embedding filled page_schema JSON in segment bodies. */
export const PAGE_SCHEMA_FENCE = "poju-page-schema";

export function encodePageSchemaFence(page: DeliveryPageData): string {
  return `\`\`\`${PAGE_SCHEMA_FENCE}\n${JSON.stringify({
    version: DELIVERY_PAGE_SCHEMA_VERSION,
    page,
  })}\n\`\`\``;
}

function parsePageSchemaFenceBody(raw: string): DeliveryPageData | null {
  try {
    const parsed = JSON.parse(raw.trim()) as { page?: DeliveryPageData };
    if (parsed?.page && typeof parsed.page === "object" && "page" in parsed.page) {
      return parsed.page;
    }
    const direct = JSON.parse(raw.trim()) as DeliveryPageData;
    if (direct && typeof direct === "object" && "page" in direct) return direct;
  } catch {
    return null;
  }
  return null;
}

export function extractPageSchemaFromMarkdown(md: string): DeliveryPageData | null {
  const re = /```poju-page-schema\s*([\s\S]*?)```/i;
  const m = md.match(re);
  if (!m?.[1]) return null;
  return parsePageSchemaFenceBody(m[1]);
}

/** Every closed fence on a shelf face (02/04/05/06/08 fold more than one paper). */
export function extractAllPageSchemas(md: string): DeliveryPageData[] {
  const re = /```poju-page-schema\s*([\s\S]*?)```/gi;
  const out: DeliveryPageData[] = [];
  for (const m of md.matchAll(re)) {
    const page = m[1] ? parsePageSchemaFenceBody(m[1]) : null;
    if (page) out.push(page);
  }
  return out;
}

export function stripPageSchemaFence(md: string): string {
  return md
    .replace(/```poju-page-schema\s*[\s\S]*?```/gi, "")
    .replace(/```poju-page-schema[\s\S]*$/gi, "")
    .trim();
}

function anchorsOf(list: readonly string[] | undefined): readonly string[] | undefined {
  if (!Array.isArray(list) || !list.length) return undefined;
  const cleaned = list.map((s) => s.trim()).filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}

/** Stored polish JSON omits zod defaults. A missing list is empty, not a throw. */
function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function withAnchors(body: string, chart_anchors?: readonly string[]): DeliveryArgument {
  const a = anchorsOf(chart_anchors);
  return a ? { body, chart_anchors: a } : { body };
}

function formatRiskItem(r: RiskItem): string {
  return r.narrative?.trim()
    ? r.narrative.trim()
    : `**出现:** ${r.situation}\n\n**该做:** ${r.then_do}\n\n**注意:** ${r.watch}\n\n**禁做:** ${r.forbid}`;
}

/** Slot fields → labeled markdown bodies for evidence targeting (1 unit = 1 evidence). */
export function pageSchemaToArgumentBodies(page: DeliveryPageData): DeliveryArgument[] {
  switch (page.page) {
    case "decision_brief": {
      const trackBody = (
        label: string,
        t: typeof page.primary,
      ): DeliveryArgument => {
        const chip = t.leverage_chip?.trim()
          ? `\n\n**关键筹码:** ${t.leverage_chip.trim()}`
          : "";
        return withAnchors(
          `### ${label} · ${t.name}\n\n` +
            `**核心打法:** ${t.core_logic}\n\n` +
            `**为何:** ${t.why}\n\n` +
            `**条件:** ${t.when}${chip}`,
          t.chart_anchors,
        );
      };
      return [
        withAnchors(`### 核心判定\n\n${page.core_judgment}`, page.primary.chart_anchors),
        trackBody("主路径", page.primary),
        trackBody("辅路径", page.backup),
      ];
    }
    case "situation_analysis":
    case "personal_decision_patterns":
    case "bottleneck_analysis": {
      // One why_card = one argument, same order as the shelf slots.
      // A missing case used to fall through to [] and planProductionV3Book
      // reported v3_empty_page after the triad had already stored the schema.
      const cards = page.why_cards ?? [];
      if (!cards.length) return [];
      return cards.map((c) =>
        withAnchors(
          `### ${c.title}\n\n**表象:** ${c.surface}\n\n**本质:** ${c.essence}`,
          c.chart_anchors,
        ),
      );
    }
    case "strategic_options": {
      const options = page.options ?? [];
      if (!options.length) return [];
      return options.map((opt) =>
        withAnchors(
          `### ${opt.name}\n\n${opt.summary}\n\n` +
            `**收益:** ${opt.upside}\n\n` +
            `**成本:** ${opt.cost}\n\n` +
            `**风险:** ${opt.risk}\n\n` +
            `**可逆:** ${opt.reversibility}`,
          opt.chart_anchors,
        ),
      );
    }
    case "recommended_strategy": {
      const primary = page.primary;
      const backup = page.backup;
      const judgment = String(page.core_judgment ?? "").trim();
      if (!judgment || !primary?.why?.trim() || !backup?.why?.trim()) return [];
      const whenLine = (when: string | undefined) =>
        when?.trim() ? `\n\n**何时:** ${when.trim()}` : "";
      return [
        { body: `### 核心判定\n\n${judgment}` },
        withAnchors(
          `### 主路径 · ${primary.name}\n\n**为何:** ${primary.why}${whenLine(primary.when)}\n\n**退出:** ${primary.exit}`,
          primary.chart_anchors,
        ),
        withAnchors(
          `### 辅路径 · ${backup.name}\n\n**为何:** ${backup.why}${whenLine(backup.when)}\n\n**退出:** ${backup.exit}`,
          backup.chart_anchors,
        ),
      ];
    }
    case "execution_guidance": {
      const angleBody = (
        trackTitle: string,
        label: string,
        a: {
          name?: string;
          strategy?: string;
          means?: unknown;
          hard_metrics?: unknown;
          chart_anchors?: readonly string[];
        },
      ): DeliveryArgument => {
        const means = stringList(a.means);
        const metrics = stringList(a.hard_metrics);
        const action = means.length ? `\n\n**行动:**\n${means.map((s) => `- ${s}`).join("\n")}` : "";
        const metricBlock = metrics.length
          ? `\n\n**硬指标:**\n${metrics.map((m) => `- ${m}`).join("\n")}`
          : "";
        return withAnchors(
          `### ${label} · ${trackTitle} · ${a.name ?? ""}\n\n**策略:** ${a.strategy ?? ""}${action}${metricBlock}`,
          a.chart_anchors,
        );
      };
      const out: DeliveryArgument[] = [];
      if (typeof page.opening === "string" && page.opening.trim()) {
        out.push({ body: `### 开篇\n\n${page.opening.trim()}` });
      }
      const kits: Array<[{ title?: string; angles?: unknown } | undefined, string]> = [
        [page.primary_toolkit, "主·科学"],
        [page.backup_toolkit, "辅·科学"],
      ];
      for (const [kit, label] of kits) {
        const angles = Array.isArray(kit?.angles) ? kit.angles : [];
        for (const raw of angles) {
          if (!raw || typeof raw !== "object") continue;
          out.push(angleBody(typeof kit?.title === "string" ? kit.title : "", label, raw));
        }
      }
      return out;
    }
    case "self_regulation": {
      /** question_anchor / desired_outcome stay in page_schema for fill grounding — not evidence slots / user page. */
      const dimensions = Array.isArray(page.dimensions) ? page.dimensions : [];
      return dimensions.flatMap((a) => {
        if (!a || typeof a !== "object") return [];
        const means = stringList(a.means);
        const action = means.length ? `\n\n**行动:**\n${means.map((m) => `- ${m}`).join("\n")}` : "";
        return [
          withAnchors(
            `### 相关维 · ${a.name ?? ""}\n\n**策略:** ${a.strategy ?? ""}${action}`,
            a.chart_anchors,
          ),
        ];
      });
    }
    case "thirty_day":
      return [
        ...page.weeks.map((w) => ({
          body: `### 第${w.week}周 · ${w.focus}\n\n${w.actions.map((a) => `- ${a}`).join("\n")}`,
        })),
        {
          body: `### 近7日 checklist\n\n${page.day7_checklist.map((x) => `- ${x}`).join("\n")}`,
        },
      ];
    case "validation_risk": {
      /** One RiskItem = one evidence slot (no 4-bucket merge). */
      const out: DeliveryArgument[] = [];
      const pushRisk = (title: string, item: unknown) => {
        if (!item || typeof item !== "object") return;
        const row = item as RiskItem;
        out.push(withAnchors(`### ${title}\n\n${formatRiskItem(row)}`, row.chart_anchors));
      };
      const reds = Array.isArray(page.red_lights) ? page.red_lights : [];
      const traps = Array.isArray(page.traps) ? page.traps : [];
      const rules = Array.isArray(page.protection_rules) ? page.protection_rules : [];
      reds.forEach((x, i) => pushRisk(`红灯 ${i + 1}`, x));
      traps.forEach((x, i) => pushRisk(`特有坑 ${i + 1}`, x));
      pushRisk("切辅开关", page.switch_to_backup);
      rules.forEach((x, i) => pushRisk(`防护法则 ${i + 1}`, x));
      return out;
    }
    case "validation_close": {
      const day7 = Array.isArray(page.day7_micro_actions) ? page.day7_micro_actions : [];
      const takeaways = stringList(page.takeaways);
      const text = (value: unknown) => (typeof value === "string" ? value : "");
      const hasClose = [
        page.identity_before,
        page.identity_after,
        page.identity_shift,
        page.quote,
        page.quote_use,
        page.immediate_action,
        page.tonight_done_looks_like,
        page.tonight_why,
      ].some((value) => typeof value === "string" && value.trim().length > 0);
      if (!hasClose && day7.length === 0 && takeaways.length === 0) return [];
      return [
        withAnchors(
          `### 身份重塑\n\n**之前:** ${text(page.identity_before)}\n\n**之后:** ${text(page.identity_after)}\n\n` +
            `**为何切换:** ${text(page.identity_shift)}`,
          page.identity_shift_anchors,
        ),
        { body: `### 金句\n\n> ${text(page.quote)}\n\n**怎么用:** ${text(page.quote_use)}` },
        withAnchors(
          `### 今晚一件事\n\n${text(page.immediate_action)}\n\n` +
            `**做成什么样:** ${text(page.tonight_done_looks_like)}\n\n` +
            `**为何今晚:** ${text(page.tonight_why)}`,
          page.tonight_anchors,
        ),
        ...day7.map((x, i) =>
          withAnchors(
            `### 近7日 · ${i + 1}\n\n**${text(x?.action)}**\n- 为何: ${text(x?.why)}\n- 勾选: ${text(x?.done_when)}`,
            x?.chart_anchors,
          ),
        ),
        {
          body: `### 带走三样\n\n${takeaways.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
        },
      ];
    }
    default:
      return [];
  }
}

/**
 * P6 ritual seals: 金句 (index 1) + 带走三样 (last).
 * No deep-evidence unit by design — empty evidence is not a coverage gap.
 * Body order: 0 identity → 1 quote → 2 tonight → 3..n-2 day7 → last takeaways.
 */
export function signalsCloseSealBodyIndexes(bodyCount: number): ReadonlySet<number> {
  if (bodyCount <= 0) return new Set();
  const seals = new Set<number>([1]);
  const last = bodyCount - 1;
  if (last > 1) seals.add(last);
  return seals;
}

export function isSignalsCloseSealBodyIndex(
  key: DeliverySegmentKey,
  bodyCount: number,
  index: number,
): boolean {
  return key === "validation_close" && signalsCloseSealBodyIndexes(bodyCount).has(index);
}

export function pageSchemaToArgumentTree(
  key: DeliverySegmentKey,
  page: DeliveryPageData,
): Partial<Record<DeliverySegmentKey, DeliveryArgument[]>> {
  return { [key]: pageSchemaToArgumentBodies(page) };
}

/** Flatten bodies only (legacy helpers / markdown preview). */
export function pageSchemaBodiesAsStrings(page: DeliveryPageData): string[] {
  return pageSchemaToArgumentBodies(page)
    .map((a) => a.body.trim())
    .filter(Boolean);
}
