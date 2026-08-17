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
        const metrics =
          a.hard_metrics.length > 0
            ? `\n\n**硬指标:**\n${a.hard_metrics.map((m) => `- ${m}`).join("\n")}`
            : "";
        return {
          body: `### ${label} · ${trackTitle} · ${a.name}\n\n**策略:** ${a.strategy}\n\n**行动:**\n${means}${metrics}`,
        };
      };
      const out: Array<{ body: string }> = [];
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
      const out: Array<{ body: string }> = [];
      for (const a of page.dimensions) {
        out.push({
          body: `### 相关维 · ${a.name}\n\n**策略:** ${a.strategy}\n\n**行动:**\n${a.means.map((m) => `- ${m}`).join("\n")}`,
        });
      }
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
    case "risk_guard": {
      const fmt = (r: {
        situation: string;
        then_do: string;
        watch: string;
        forbid: string;
        narrative?: string;
      }) =>
        r.narrative?.trim()
          ? r.narrative.trim()
          : `**出现:** ${r.situation}\n\n**该做:** ${r.then_do}\n\n**注意:** ${r.watch}\n\n**禁做:** ${r.forbid}`;
      return [
        {
          body: `### 红灯\n\n${page.red_lights.map((x) => fmt(x)).join("\n\n---\n\n")}`,
        },
        {
          body: `### 特有坑\n\n${page.traps.map((x) => fmt(x)).join("\n\n---\n\n")}`,
        },
        {
          body: `### 切辅开关\n\n${fmt(page.switch_to_backup)}`,
        },
        {
          body: `### 防护法则\n\n${page.protection_rules.map((x) => fmt(x)).join("\n\n---\n\n")}`,
        },
      ];
    }
    case "signals_close":
      return [
        {
          body:
            `### 身份重塑\n\n**之前:** ${page.identity_before}\n\n**之后:** ${page.identity_after}\n\n` +
            `**为何切换:** ${page.identity_shift}`,
        },
        {
          body: `### 金句\n\n> ${page.quote}\n\n**怎么用:** ${page.quote_use}`,
        },
        {
          body:
            `### 今晚一件事\n\n${page.immediate_action}\n\n` +
            `**做成什么样:** ${page.tonight_done_looks_like}\n\n` +
            `**为何今晚:** ${page.tonight_why}`,
        },
        {
          body: `### 近7日微清单\n\n${page.day7_micro_actions
            .map(
              (x) =>
                `- **${x.action}**\n  - 为何: ${x.why}\n  - 勾选: ${x.done_when}`,
            )
            .join("\n")}`,
        },
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
): DeliveryArgumentTree {
  return { [key]: pageSchemaToArgumentBodies(page) };
}

export function pageSchemaToBodyMarkdown(page: DeliveryPageData): string {
  return pageSchemaToArgumentBodies(page)
    .map((a) => a.body.trim())
    .filter(Boolean)
    .join("\n\n");
}
