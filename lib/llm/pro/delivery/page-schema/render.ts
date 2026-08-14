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
    case "direct_answer":
      return [
        {
          body: `### 核心判定\n\n${page.core_judgment}`,
        },
        {
          body: `### 主路径 · ${page.primary.name}\n\n**为何:** ${page.primary.why}\n\n**条件:** ${page.primary.when}`,
        },
        {
          body: `### 辅路径 · ${page.backup.name}\n\n**为何:** ${page.backup.why}\n\n**条件:** ${page.backup.when}`,
        },
      ];
    case "foundation":
      return [
        {
          body: `### 表象 vs 本质\n\n**表象:** ${page.surface_vs_essence.surface}\n\n**本质:** ${page.surface_vs_essence.essence}`,
        },
        ...page.why_cards.map((c) => ({
          body: `### ${c.title}\n\n${c.body}`,
        })),
      ];
    case "science_action": {
      const track = (t: typeof page.primary_toolkit, label: string) => {
        const steps = t.steps.map((s) => `- ${s}`).join("\n");
        const script = t.exact_script ? `\n\n**开口:** ${t.exact_script}` : "";
        const metrics =
          t.hard_metrics.length > 0
            ? `\n\n**硬指标:**\n${t.hard_metrics.map((m) => `- ${m}`).join("\n")}`
            : "";
        return {
          body: `### ${label} · ${t.title}\n\n**策略:** ${t.strategy}${script}\n\n**手段:**\n${steps}${metrics}`,
        };
      };
      const out = [
        track(page.primary_toolkit, "主工具箱"),
        track(page.backup_toolkit, "辅防护"),
      ];
      if (page.opening?.trim()) {
        out.unshift({ body: `### 开口\n\n${page.opening.trim()}` });
      }
      if (page.alert?.trim()) {
        out.push({ body: `### 注意\n\n${page.alert.trim()}` });
      }
      return out;
    }
    case "metaphysics_action": {
      const track = (t: typeof page.primary_track, label: string) => ({
        body: `### ${label} · ${t.title}\n\n**策略:** ${t.strategy}\n\n**手段:**\n${t.methods.map((m) => `- ${m}`).join("\n")}`,
      });
      return [
        track(page.primary_track, "主·东方"),
        track(page.backup_track, "辅·东方"),
        {
          body: `### 借力\n\n${page.leverage.map((x) => `- ${x}`).join("\n")}`,
        },
        {
          body: `### 避坑\n\n${page.avoid.map((x) => `- ${x}`).join("\n")}`,
        },
      ];
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
