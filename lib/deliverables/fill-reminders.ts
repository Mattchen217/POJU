/**
 * Fill reminders-30d blank template from CompanionJob (or days+cards).
 */

import {
  assertSkeletonUnchanged,
  fillDeliverableHtml,
} from "@/lib/deliverables/fill-html";
import { REMINDERS_30D_TEMPLATE } from "@/lib/deliverables/templates/reminders-30d";
import {
  companionUiLabels,
  normalizeCompanionLocale,
} from "@/lib/companion/locale-voice";
import {
  COMPANION_WINDOW_DAYS,
  type CompanionDayCards,
  type CompanionJob,
} from "@/lib/companion/types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Strip ⟦t:term⟧ markers; keep term text. */
function stripTermMarks(s: string): string {
  return s.replace(/⟦t:([^|⟧]+)(?:\|[^⟧]*)?⟧/g, "$1");
}

function langAttr(locale: string): string {
  const n = normalizeCompanionLocale(locale);
  if (n === "zh") return "zh-Hans";
  return n;
}

function maybeAssertSkeleton(before: string, after: string): void {
  if (process.env.NODE_ENV === "production") return;
  try {
    assertSkeletonUnchanged(before, after);
  } catch (e) {
    console.warn("[fill-reminders] skeleton assert:", e);
  }
}

/** Day-card fragment reused from companion day-html section content. */
export function buildRemindersDayCardHtml(
  cards: CompanionDayCards,
  labels: ReturnType<typeof companionUiLabels>,
): string {
  const section = (h: string, body: string) =>
    `<h3 class="day-card__section-title">${escapeHtml(h)}</h3><p class="day-card__section-body">${escapeHtml(body)}</p>`;
  return `${section(labels.today, cards.today_is)}
${section(labels.suitable, cards.suitable)}
${section(labels.unsuitable, cards.unsuitable)}
${section(labels.suggestion, cards.suggestion)}
<div class="day-card__evidence">
  ${section(labels.evidence, stripTermMarks(cards.evidence))}
</div>`;
}

export type FillRemindersInput =
  | CompanionJob
  | {
      brief: CompanionJob["brief"];
      days: CompanionJob["days"];
    };

export function buildRemindersSlotMap(
  job: FillRemindersInput,
  locale?: string,
): Record<string, string> {
  const loc = normalizeCompanionLocale(locale || job.brief.locale);
  const labels = companionUiLabels(loc);
  const zh = loc === "zh";

  const title = zh
    ? "30 日提醒"
    : loc === "fr"
      ? "Rappels 30 jours"
      : loc === "es"
        ? "Recordatorios 30 días"
        : "30-day reminders";
  const subtitle = zh
    ? "每日一张，锚定主辅策略"
    : "One card a day · primary & backup anchors";
  const anchor = labels.anchor(job.brief.primary.name, job.brief.backup.name);

  const privacy = zh
    ? "本文件保存在你的设备上；打开无需登录。"
    : "This file stays on your device; no sign-in required.";
  const disclaimer = zh
    ? "内容供决策参考，不构成医疗、法律或投资建议。"
    : "For decision support only — not medical, legal, or investment advice.";
  const readingHint = zh
    ? "点目录切换日期（01–30）。"
    : "Use the TOC to switch days (01–30).";

  const slots: Record<string, string> = {
    SLOT_LANG: langAttr(loc),
    SLOT_TITLE: escapeHtml(title),
    SLOT_SUBTITLE: escapeHtml(subtitle),
    SLOT_ANCHOR: escapeHtml(anchor),
    SLOT_READING_HINT: escapeHtml(readingHint),
    SLOT_PRIVACY: escapeHtml(privacy),
    SLOT_DISCLAIMER: escapeHtml(disclaimer),
    SLOT_PAGE_LABEL: `1 / ${COMPANION_WINDOW_DAYS}`,
    SLOT_GLOSSARY_JSON: "[]",
  };

  for (let i = 0; i < COMPANION_WINDOW_DAYS; i++) {
    const n = String(i + 1).padStart(2, "0");
    const day = job.days[i];
    const dateKey = day?.date_key ?? "";
    const tocTitle = dateKey
      ? labels.title(dateKey, i + 1)
      : zh
        ? `第 ${i + 1} 日`
        : `Day ${i + 1}`;
    slots[`SLOT_TOC_DAY_${n}`] = escapeHtml(tocTitle);
    if (day?.cards) {
      slots[`SLOT_DAY_${n}`] = buildRemindersDayCardHtml(day.cards, labels);
    } else {
      slots[`SLOT_DAY_${n}`] =
        `<p class="slot-empty">${escapeHtml(zh ? "尚未生成" : "Not ready yet")}</p>`;
    }
  }

  return slots;
}

export function fillReminders30dHtml(
  job: FillRemindersInput,
  locale?: string,
): string {
  const slots = buildRemindersSlotMap(job, locale);
  const html = fillDeliverableHtml(REMINDERS_30D_TEMPLATE, slots);
  maybeAssertSkeleton(REMINDERS_30D_TEMPLATE, html);
  return html;
}
