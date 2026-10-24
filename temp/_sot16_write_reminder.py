# -*- coding: utf-8 -*-
"""SoT16 path C: write reminder offline fill + smoke scripts; patch decision blank-open."""
from pathlib import Path
root = Path(r"D:\POJU\pojulife")

reminder_offline = r'''/**
 * Eastern OS — 30-day reminder offline HTML (popup = file).
 * Blank templates (real companion / atmos calendar chrome) + slot fill.
 * Same string for vault iframe srcDoc, download, and email attachment.
 */

import {
  REMINDER_DAY_BLANK_TEMPLATE,
  REMINDER_PACK_BLANK_TEMPLATE,
} from "@/lib/companion/reminder-day-html/blank-template";
import {
  companionUiLabels,
  normalizeCompanionLocale,
  type CompanionLocale,
} from "@/lib/companion/locale-voice";
import type { CompanionDayCards, CompanionJob } from "@/lib/companion/types";

export type BuildReminderOfflineHtmlOptions = {
  embed?: boolean;
  closeLabel?: string;
  /** Pack: note under subtitle. */
  packNote?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fillSlots(template: string, slots: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(slots)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  out = out.replace(/\{\{SLOT_[A-Z0-9_]+\}\}/g, "");
  return out;
}

function langAttr(locale: string): string {
  const l = normalizeCompanionLocale(locale);
  return l;
}

/** Strip ⟦t:term|gloss⟧ markers for plain visible text; keep term. */
function stripTermMarks(s: string): string {
  return s.replace(/⟦t:([^|⟧]+)(?:\|[^⟧]*)?⟧/g, "$1");
}

/** Evidence body: keep gloss markers as data-gloss spans when present. */
function renderEvidenceHtml(evidence: string): string {
  const raw = evidence || "";
  const withGloss = raw.replace(
    /⟦t:([^|⟧]+)(?:\|([^⟧]*))?⟧/g,
    (_m, term: string, gloss?: string) => {
      const t = escapeHtml(String(term));
      const g = gloss ? escapeHtml(String(gloss)) : "";
      if (g) return `<span data-gloss="${g}" title="${g}">${t}</span>`;
      return t;
    },
  );
  // Escape anything outside our spans by running escape on non-span parts is hard;
  // markers already consumed; escape residual angle brackets lightly.
  return withGloss
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;span /g, "<span ")
    .replace(/&lt;\/span&gt;/g, "</span>")
    .replace(/&quot;/g, '"');
}

function cardBodyHtml(cards: CompanionDayCards, labels: ReturnType<typeof companionUiLabels>): string {
  const section = (h: string, body: string, evidence = false) => {
    if (evidence) {
      return `<h5>${escapeHtml(h)}</h5><details class="poju-companion-sheet__evidence"><summary>${escapeHtml(h)}</summary><div class="poju-companion-sheet__evidence-body"><p>${renderEvidenceHtml(body)}</p></div></details>`;
    }
    return `<h5>${escapeHtml(h)}</h5><p>${escapeHtml(stripTermMarks(body))}</p>`;
  };
  // Match CompanionDayReading: evidence in details with its own summary label.
  return [
    `<h5>${escapeHtml(labels.today)}</h5><p>${escapeHtml(stripTermMarks(cards.today_is))}</p>`,
    `<h5>${escapeHtml(labels.suitable)}</h5><p>${escapeHtml(stripTermMarks(cards.suitable))}</p>`,
    `<h5>${escapeHtml(labels.unsuitable)}</h5><p>${escapeHtml(stripTermMarks(cards.unsuitable))}</p>`,
    `<h5>${escapeHtml(labels.suggestion)}</h5><p>${escapeHtml(stripTermMarks(cards.suggestion))}</p>`,
    `<details class="poju-companion-sheet__evidence"><summary>${escapeHtml(labels.evidence)}</summary><div class="poju-companion-sheet__evidence-body"><p>${renderEvidenceHtml(cards.evidence)}</p></div></details>`,
  ].join("\n");
}

function weekdayLabels(locale: CompanionLocale): string[] {
  if (locale === "zh") return ["一", "二", "三", "四", "五", "六", "日"];
  if (locale === "fr") return ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
  if (locale === "es") return ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
}

/** Monday-start calendar grid covering job window. */
function buildCalendarHtml(job: CompanionJob, locale: CompanionLocale): {
  calendar: string;
  daysJson: Record<string, { title: string; html: string }>;
} {
  const labels = companionUiLabels(locale);
  const daysJson: Record<string, { title: string; html: string }> = {};
  const byKey = new Map(job.days.map((d) => [d.date_key, d] as const));
  const start = new Date(`${job.delivery_day_key}T12:00:00`);
  const end = new Date(`${job.ends_day_key}T12:00:00`);
  // Align to Monday
  const gridStart = new Date(start);
  const dow = (gridStart.getDay() + 6) % 7; // Mon=0
  gridStart.setDate(gridStart.getDate() - dow);
  const gridEnd = new Date(end);
  const endDow = (gridEnd.getDay() + 6) % 7;
  gridEnd.setDate(gridEnd.getDate() + (6 - endDow));

  const weekdays = weekdayLabels(locale)
    .map((w) => `<div class="atmos-forecast__weekday" role="columnheader">${escapeHtml(w)}</div>`)
    .join("");
  const rows: string[] = [];
  const cursor = new Date(gridStart);
  const todayKey = new Date().toISOString().slice(0, 10);
  while (cursor <= gridEnd) {
    const cells: string[] = [];
    for (let i = 0; i < 7; i++) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      const dateKey = `${y}-${m}-${d}`;
      const dayRec = byKey.get(dateKey);
      const inWindow = dateKey >= job.delivery_day_key && dateKey <= job.ends_day_key;
      const ready =
        dayRec &&
        dayRec.cards &&
        (dayRec.status === "delivered" ||
          dayRec.status === "sent" ||
          dayRec.status === "generated");
      let tone = "is-beyond";
      if (inWindow) tone = "is-active";
      if (dateKey < job.delivery_day_key) tone = "is-past";
      if (dateKey > job.ends_day_key) tone = "is-beyond";
      const todayClass = dateKey === todayKey ? " is-today" : "";
      const readyClass = ready ? " is-ready" : "";
      const monthTag = `${Number(m)}`;
      let inner = `<div class="atmos-forecast__date"><span class="atmos-forecast__day-num">${Number(d)}</span><span class="atmos-forecast__month-tag">${monthTag}</span></div>`;
      if (inWindow && dayRec) {
        if (ready && dayRec.cards) {
          const title = labels.title(dateKey, dayRec.day_index + 1);
          const html = `<article class="poju-companion-sheet__card">${cardBodyHtml(dayRec.cards, labels)}</article>`;
          daysJson[dateKey] = { title, html };
          const snip = escapeHtml(dayRec.cards.suggestion.slice(0, 48));
          const more = dayRec.cards.suggestion.length > 48 ? "…" : "";
          inner += `<button type="button" class="atmos-forecast__snippet" data-day-key="${dateKey}"><span class="atmos-forecast__snippet-text">${snip}${more}</span><span class="atmos-forecast__expand">→</span></button>`;
        } else {
          const pending =
            dayRec.status === "failed"
              ? locale === "zh"
                ? "失败"
                : "Failed"
              : locale === "zh"
                ? "待生成"
                : "Pending";
          inner += `<div class="atmos-forecast__pending-row"><span class="atmos-forecast__pending-label">${escapeHtml(pending)}</span></div>`;
        }
      }
      cells.push(
        `<div class="atmos-forecast__cell ${tone}${todayClass}${readyClass}" role="gridcell">${inner}</div>`,
      );
      cursor.setDate(cursor.getDate() + 1);
    }
    rows.push(`<div class="atmos-forecast__row" role="row">${cells.join("")}</div>`);
  }
  const calendar = `<div class="atmos-forecast__weekdays" role="row">${weekdays}</div>\n${rows.join("\n")}`;
  return { calendar, daysJson };
}

/** Single-day offline HTML (drip email / per-day file). */
export function buildReminderDayOfflineHtml(input: {
  job: CompanionJob;
  dayIndex: number;
  cards: CompanionDayCards;
  opts?: BuildReminderOfflineHtmlOptions;
}): string {
  const locale = normalizeCompanionLocale(input.job.brief.locale);
  const labels = companionUiLabels(locale);
  const day = input.job.days[input.dayIndex];
  const dateKey = day?.date_key ?? "";
  const title = labels.title(dateKey, input.dayIndex + 1);
  const closeLabel =
    input.opts?.closeLabel?.trim() || (locale === "zh" ? "关闭" : "Close");
  const subtitle = labels.anchor(input.job.brief.primary.name, input.job.brief.backup.name);
  return fillSlots(REMINDER_DAY_BLANK_TEMPLATE, {
    SLOT_LANG: langAttr(locale),
    SLOT_DOC_TITLE: escapeHtml(title),
    SLOT_EMBED: input.opts?.embed ? "1" : "0",
    SLOT_CLOSE_LABEL: escapeHtml(closeLabel),
    SLOT_FRAME_ARIA: escapeHtml(title),
    SLOT_TITLE: escapeHtml(title),
    SLOT_SUBTITLE: escapeHtml(subtitle),
    SLOT_CARD_BODY: cardBodyHtml(input.cards, labels),
  });
}

/** 30-day pack offline HTML (vault popup / download). */
export function buildReminderPackOfflineHtml(
  job: CompanionJob,
  opts?: BuildReminderOfflineHtmlOptions,
): string {
  const locale = normalizeCompanionLocale(job.brief.locale);
  const labels = companionUiLabels(locale);
  const title =
    locale === "zh" ? "30日提醒" : locale === "fr" ? "Rappels 30 jours" : "30-day reminders";
  const subtitle = labels.anchor(job.brief.primary.name, job.brief.backup.name);
  const closeLabel = opts?.closeLabel?.trim() || (locale === "zh" ? "关闭" : "Close");
  const packNote =
    opts?.packNote?.trim() ||
    (locale === "zh"
      ? "点日期查看当日提醒；与下载/邮件为同一份离线 HTML。"
      : "Tap a day to open that reminder — same offline HTML as download/email.");
  const { calendar, daysJson } = buildCalendarHtml(job, locale);
  return fillSlots(REMINDER_PACK_BLANK_TEMPLATE, {
    SLOT_LANG: langAttr(locale),
    SLOT_DOC_TITLE: escapeHtml(title),
    SLOT_EMBED: opts?.embed ? "1" : "0",
    SLOT_CLOSE_LABEL: escapeHtml(closeLabel),
    SLOT_FRAME_ARIA: escapeHtml(title),
    SLOT_TITLE: escapeHtml(title),
    SLOT_SUBTITLE: escapeHtml(subtitle),
    SLOT_PACK_NOTE: escapeHtml(packNote),
    SLOT_CALENDAR: calendar,
    SLOT_SHEET_TITLE: escapeHtml(title),
    SLOT_DAYS_JSON: JSON.stringify(daysJson).replace(/</g, "\\u003c"),
  });
}

export function reminderDayOfflineFilename(dayNum: number, dateKey: string): string {
  const n = String(Math.max(1, dayNum)).padStart(2, "0");
  return `eastern-os-reminder-day-${n}-${dateKey}.html`;
}

export function reminderPackOfflineFilename(when: Date = new Date()): string {
  return `eastern-os-reminder-pack-${when.toISOString().slice(0, 10)}.html`;
}

export function getReminderDayBlankTemplate(): string {
  return REMINDER_DAY_BLANK_TEMPLATE;
}

export function getReminderPackBlankTemplate(): string {
  return REMINDER_PACK_BLANK_TEMPLATE;
}
'''

# Fix evidence render - the double-escape approach is buggy. Use cleaner version.
reminder_offline = reminder_offline.replace(
'''/** Evidence body: keep gloss markers as data-gloss spans when present. */
function renderEvidenceHtml(evidence: string): string {
  const raw = evidence || "";
  const withGloss = raw.replace(
    /⟦t:([^|⟧]+)(?:\|([^⟧]*))?⟧/g,
    (_m, term: string, gloss?: string) => {
      const t = escapeHtml(String(term));
      const g = gloss ? escapeHtml(String(gloss)) : "";
      if (g) return `<span data-gloss="${g}" title="${g}">${t}</span>`;
      return t;
    },
  );
  // Escape anything outside our spans by running escape on non-span parts is hard;
  // markers already consumed; escape residual angle brackets lightly.
  return withGloss
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;span /g, "<span ")
    .replace(/&lt;\/span&gt;/g, "</span>")
    .replace(/&quot;/g, '"');
}''',
'''/** Evidence body: escape text, turn term markers into data-gloss spans. */
function renderEvidenceHtml(evidence: string): string {
  const raw = evidence || "";
  const parts: string[] = [];
  const re = /⟦t:([^|⟧]+)(?:\|([^⟧]*))?⟧/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    parts.push(escapeHtml(raw.slice(last, m.index)));
    const t = escapeHtml(String(m[1]));
    const g = m[2] ? escapeHtml(String(m[2])) : "";
    parts.push(g ? `<span data-gloss="${g}" title="${g}">${t}</span>` : t);
    last = m.index + m[0].length;
  }
  parts.push(escapeHtml(raw.slice(last)));
  return parts.join("").replace(/\\n/g, "<br/>");
}''')

(root / "lib" / "companion" / "reminder-day-offline-html.ts").write_text(reminder_offline, encoding="utf-8")
print("wrote reminder-day-offline-html.ts", len(reminder_offline))
