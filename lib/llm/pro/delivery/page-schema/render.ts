/**
 * Convert filled page_schema → argument tree (for evidence/mark) + markdown.
 * Each content unit carries chart_anchors (ClaimPlan) for calc-first evidence.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeliveryArgument } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeliveryPageData, RiskItem } from "./types";

function anchorsOf(list: readonly string[] | undefined): readonly string[] | undefined {
  if (!list?.length) return undefined;
  const cleaned = list.map((s) => s.trim()).filter(Boolean);
  return cleaned.length ? cleaned : undefined;
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
    case "direct_answer": {
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
    case "foundation":
      return page.why_cards.map((c) =>
        withAnchors(
          `### ${c.title}\n\n**表象:** ${c.surface}\n\n**本质:** ${c.essence}`,
          c.chart_anchors,
        ),
      );
    case "science_action": {
      const angleBody = (
        trackTitle: string,
        label: string,
        a: (typeof page.primary_toolkit.angles)[number],
      ): DeliveryArgument => {
        const means = a.means.map((s) => `- ${s}`).join("\n");
        const metrics =
          a.hard_metrics.length > 0
            ? `\n\n**硬指标:**\n${a.hard_metrics.map((m) => `- ${m}`).join("\n")}`
            : "";
        return withAnchors(
          `### ${label} · ${trackTitle} · ${a.name}\n\n**策略:** ${a.strategy}\n\n**行动:**\n${means}${metrics}`,
          a.chart_anchors,
        );
      };
      const out: DeliveryArgument[] = [];
      if (page.opening?.trim()) {
        out.push({ body: `### 开篇\n\n${page.opening.trim()}` });
      }
      for (const a of page.primary_toolkit.angles) {
        out.push(angleBody(page.primary_toolkit.title, "主·科学", a));
      }
      for (const a of page.backup_toolkit.angles) {
        out.push(angleBody(page.backup_toolkit.title, "辅·科学", a));
      }
      return out;
    }
    case "metaphysics_action": {
      /** question_anchor / desired_outcome stay in page_schema for fill grounding — not evidence slots / user page. */
      return page.dimensions.map((a) =>
        withAnchors(
          `### 相关维 · ${a.name}\n\n**策略:** ${a.strategy}\n\n**行动:**\n${a.means.map((m) => `- ${m}`).join("\n")}`,
          a.chart_anchors,
        ),
      );
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
    case "risk_guard": {
      /** One RiskItem = one evidence slot (no 4-bucket merge). */
      const out: DeliveryArgument[] = [];
      page.red_lights.forEach((x, i) => {
        out.push(
          withAnchors(`### 红灯 ${i + 1}\n\n${formatRiskItem(x)}`, x.chart_anchors),
        );
      });
      page.traps.forEach((x, i) => {
        out.push(
          withAnchors(`### 特有坑 ${i + 1}\n\n${formatRiskItem(x)}`, x.chart_anchors),
        );
      });
      out.push(
        withAnchors(
          `### 切辅开关\n\n${formatRiskItem(page.switch_to_backup)}`,
          page.switch_to_backup.chart_anchors,
        ),
      );
      page.protection_rules.forEach((x, i) => {
        out.push(
          withAnchors(`### 防护法则 ${i + 1}\n\n${formatRiskItem(x)}`, x.chart_anchors),
        );
      });
      return out;
    }
    case "signals_close":
      return [
        withAnchors(
          `### 身份重塑\n\n**之前:** ${page.identity_before}\n\n**之后:** ${page.identity_after}\n\n` +
            `**为何切换:** ${page.identity_shift}`,
          page.identity_shift_anchors,
        ),
        { body: `### 金句\n\n> ${page.quote}\n\n**怎么用:** ${page.quote_use}` },
        withAnchors(
          `### 今晚一件事\n\n${page.immediate_action}\n\n` +
            `**做成什么样:** ${page.tonight_done_looks_like}\n\n` +
            `**为何今晚:** ${page.tonight_why}`,
          page.tonight_anchors,
        ),
        ...page.day7_micro_actions.map((x, i) =>
          withAnchors(
            `### 近7日 · ${i + 1}\n\n**${x.action}**\n- 为何: ${x.why}\n- 勾选: ${x.done_when}`,
            x.chart_anchors,
          ),
        ),
        {
          body: `### 带走三样\n\n${page.takeaways.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
        },
      ];
    default:
      return [];
  }
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
