/**
 * Convert filled page_schema → argument tree (for evidence/mark) + markdown.
 */

import type { DeliveryArgumentTree, DeliverySegmentKey } from "../delivery-schema";
import type { DeliveryPageData } from "./types";
import { DELIVERY_PAGE_SCHEMA_VERSION } from "./types";

export const PAGE_SCHEMA_FENCE = "poju-page-schema";

export function encodePageSchemaFence(page: DeliveryPageData): string {
  return `\`\`\`${PAGE_SCHEMA_FENCE}\n${JSON.stringify({
    version: DELIVERY_PAGE_SCHEMA_VERSION,
    page,
  })}\n\`\`\``;
}

export function extractPageSchemaFromMarkdown(md: string): DeliveryPageData | null {
  const re = /```poju-page-schema\s*([\s\S]*?)```/i;
  const m = md.match(re);
  if (!m?.[1]) return null;
  try {
    const parsed = JSON.parse(m[1].trim()) as { page?: DeliveryPageData };
    if (parsed?.page && typeof parsed.page === "object" && "page" in parsed.page) {
      return parsed.page;
    }
    // allow raw page object
    const raw = JSON.parse(m[1].trim()) as DeliveryPageData;
    if (raw && typeof raw === "object" && "page" in raw) return raw;
  } catch {
    return null;
  }
  return null;
}

export function stripPageSchemaFence(md: string): string {
  return md.replace(/```poju-page-schema\s*[\s\S]*?```/gi, "").trim();
}

/** Slot fields → labeled markdown bodies for evidence targeting. */
export function pageSchemaToArgumentBodies(page: DeliveryPageData): Array<{ body: string }> {
  switch (page.page) {
    case "direct_answer": {
      const trackBody = (
        label: string,
        t: typeof page.primary,
      ): string => {
        const chip = t.leverage_chip?.trim()
          ? `\n\n**关键筹码:** ${t.leverage_chip.trim()}`
          : "";
        return (
          `### ${label} · ${t.name}\n\n` +
          `**核心打法:** ${t.core_logic}\n\n` +
          `**为何:** ${t.why}\n\n` +
          `**条件:** ${t.when}${chip}`
        );
      };
      return [
        { body: `### 核心判定\n\n${page.core_judgment}` },
        { body: trackBody("主路径", page.primary) },
        { body: trackBody("辅路径", page.backup) },
      ];
    }
    case "foundation":
      return [
        ...page.why_cards.map((c) => ({
          body: `### ${c.title}\n\n**表象:** ${c.surface}\n\n**本质:** ${c.essence}`,
        })),
      ];
    case "science_action": {
      const angleBody = (
        trackTitle: string,
        label: string,
        a: (typeof page.primary_toolkit.angles)[number],
      ) => {
        const means = a.means.map((s) => `- ${s}`).join("\n");
        const script = a.exact_script ? `\n\n**开口:** ${a.exact_script}` : "";
        const metrics =
          a.hard_metrics.length > 0
            ? `\n\n**硬指标:**\n${a.hard_metrics.map((m) => `- ${m}`).join("\n")}`
            : "";
        return {
          body: `### ${label} · ${trackTitle} · ${a.name}\n\n**策略:** ${a.strategy}${script}\n\n**手段:**\n${means}${metrics}`,
        };
      };
      const out: Array<{ body: string }> = [];
      if (page.opening?.trim()) {
        out.push({ body: `### 开口\n\n${page.opening.trim()}` });
      }
      for (const a of page.primary_toolkit.angles) {
        out.push(angleBody(page.primary_toolkit.title, "主·科学", a));
      }
      for (const a of page.backup_toolkit.angles) {
        out.push(angleBody(page.backup_toolkit.title, "辅·科学", a));
      }
      if (page.alert?.trim()) {
        out.push({ body: `### 注意\n\n${page.alert.trim()}` });
      }
      return out;
    }
    case "metaphysics_action": {
      const out: Array<{ body: string }> = [
        {
          body: `### 锚定\n\n**问题:** ${page.question_anchor}\n\n**期望:** ${page.desired_outcome}`,
        },
      ];
      for (const a of page.dimensions) {
        out.push({
          body: `### 相关维 · ${a.name}\n\n**策略:** ${a.strategy}\n\n**手段:**\n${a.means.map((m) => `- ${m}`).join("\n")}`,
        });
      }
      out.push({
        body: `### 借力\n\n${page.leverage.map((x) => `- ${x}`).join("\n")}`,
      });
      out.push({
        body: `### 避坑\n\n${page.avoid.map((x) => `- ${x}`).join("\n")}`,
      });
      return out;
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
    case "risk_guard":
      return [
        {
          body: `### 红灯\n\n${page.red_lights.map((x) => `- ${x}`).join("\n")}`,
        },
        {
          body: `### 特有坑\n\n${page.traps.map((x) => `- ${x}`).join("\n")}`,
        },
        {
          body: `### 切辅开关\n\n${page.switch_to_backup}`,
        },
        {
          body: `### 防护法则\n\n${page.protection_rules.map((x) => `- ${x}`).join("\n")}`,
        },
        ...(page.boundary_script
          ? [{ body: `### 边界短句\n\n${page.boundary_script}` }]
          : []),
      ];
    case "signals_close":
      return [
        {
          body: `### 身份重塑\n\n**之前:** ${page.identity_before}\n\n**之后:** ${page.identity_after}`,
        },
        {
          body: `### 金句\n\n> ${page.quote}`,
        },
        {
          body: `### 今晚一件事\n\n${page.immediate_action}`,
        },
        {
          body: `### 近7日微清单\n\n${page.day7_micro_actions.map((x) => `- ${x}`).join("\n")}`,
        },
      ];
    default:
      return [];
  }
}

export function pageSchemaToArgumentTree(
  key: DeliverySegmentKey,
  page: DeliveryPageData,
): DeliveryArgumentTree {
  return { [key]: pageSchemaToArgumentBodies(page) };
}

export function pageSchemaToBodyMarkdown(page: DeliveryPageData): string {
  return pageSchemaToArgumentBodies(page)
    .map((a) => a.body.trim())
    .filter(Boolean)
    .join("\n\n");
}
