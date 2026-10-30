/**
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
import { addDaysKey } from "@/lib/companion/date-keys";
import {
  COMPANION_WINDOW_DAYS,
  type CompanionDayCards,
  type CompanionDayRecord,
  type CompanionJob,
} from "@/lib/companion/types";
import {
  sanitizePlainExport,
  type SanitizeExportOptions,
} from "@/lib/glossary/sanitize-export-surface";
/** Minimal job shape for pack fill (API publicJob is enough). */
export type ReminderPackJobLike = Pick<
  CompanionJob,
  "brief" | "days" | "delivery_day_key" | "ends_day_key"
>;


export type BuildReminderOfflineHtmlOptions = {
  embed?: boolean;
  closeLabel?: string;
  /** Pack: note under subtitle. */
  packNote?: string;
  /**
   * Segment-scoped term confirmations for export sanitize.
   * Must include matching `sourceId` on each row when soft-mapping dual-ns (空亡/白虎).
   */
  confirmedTerms?: SanitizeExportOptions["confirmed"];
  /** Fact-source id for this reminder document (pairs with confirmedTerms.sourceId). */
  termSourceId?: string;
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
  return normalizeCompanionLocale(locale);
}

/** Phase 5: shared export sanitize (decision-anchor copy only — no task tracker rewrite). */
function compliantBody(
  s: string,
  locale: string,
  options?: SanitizeExportOptions,
): string {
  return sanitizePlainExport(s ?? "", locale, "email", options).content;
}

/** Evidence body: sanitize then escape; markers already reduced by export pipeline. */
function renderEvidenceHtml(
  evidence: string,
  locale: string,
  options?: SanitizeExportOptions,
): string {
  const raw = compliantBody(evidence || "", locale, options);
  return escapeHtml(raw).replace(/\n/g, "<br/>");
}

function cardBodyHtml(
  cards: CompanionDayCards,
  labels: ReturnType<typeof companionUiLabels>,
  locale: string,
  options?: SanitizeExportOptions,
): string {
  return [
    `<h5>${escapeHtml(labels.today)}</h5><p>${escapeHtml(compliantBody(cards.today_is, locale, options))}</p>`,
    `<h5>${escapeHtml(labels.suitable)}</h5><p>${escapeHtml(compliantBody(cards.suitable, locale, options))}</p>`,
    `<h5>${escapeHtml(labels.unsuitable)}</h5><p>${escapeHtml(compliantBody(cards.unsuitable, locale, options))}</p>`,
    `<h5>${escapeHtml(labels.suggestion)}</h5><p>${escapeHtml(compliantBody(cards.suggestion, locale, options))}</p>`,
    `<details class="poju-companion-sheet__evidence"><summary>${escapeHtml(labels.evidence)}</summary><div class="poju-companion-sheet__evidence-body"><p>${renderEvidenceHtml(cards.evidence, locale, options)}</p></div></details>`,
  ].join("\n");
}

function weekdayLabels(locale: CompanionLocale): string[] {
  if (locale === "zh") return ["一", "二", "三", "四", "五", "六", "日"];
  if (locale === "fr") return ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
  if (locale === "es") return ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
}

function sanitizeOptsFromBuild(
  opts?: BuildReminderOfflineHtmlOptions,
): SanitizeExportOptions | undefined {
  if (!opts?.confirmedTerms?.length && !opts?.termSourceId) return undefined;
  return {
    ...(opts.confirmedTerms ? { confirmed: opts.confirmedTerms } : {}),
    ...(opts.termSourceId ? { sourceId: opts.termSourceId } : {}),
  };
}

/** Monday-start calendar grid covering job window. */
function buildCalendarHtml(
  job: ReminderPackJobLike,
  locale: CompanionLocale,
  sanitizeOpts?: SanitizeExportOptions,
): {
  calendar: string;
  daysJson: Record<string, { title: string; html: string }>;
} {
  const labels = companionUiLabels(locale);
  const daysJson: Record<string, { title: string; html: string }> = {};
  const byKey = new Map(job.days.map((d) => [d.date_key, d] as const));
  const start = new Date(`${job.delivery_day_key}T12:00:00`);
  const end = new Date(`${job.ends_day_key}T12:00:00`);
  const gridStart = new Date(start);
  const dow = (gridStart.getDay() + 6) % 7;
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
        Boolean(dayRec?.cards) &&
        (dayRec!.status === "delivered" ||
          dayRec!.status === "sent" ||
          dayRec!.status === "generated");
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
          const html = `<article class="poju-companion-sheet__card">${cardBodyHtml(dayRec.cards, labels, locale, sanitizeOpts)}</article>`;
          daysJson[dateKey] = { title, html };
          const sug = compliantBody(dayRec.cards.suggestion, locale, sanitizeOpts);
          const snip = escapeHtml(sug.slice(0, 48));
          const more = sug.length > 48 ? "…" : "";
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
  const sanitizeOpts = sanitizeOptsFromBuild(input.opts);
  return fillSlots(REMINDER_DAY_BLANK_TEMPLATE, {
    SLOT_LANG: langAttr(locale),
    SLOT_DOC_TITLE: escapeHtml(title),
    SLOT_EMBED: input.opts?.embed ? "1" : "0",
    SLOT_CLOSE_LABEL: escapeHtml(closeLabel),
    SLOT_FRAME_ARIA: escapeHtml(title),
    SLOT_TITLE: escapeHtml(title),
    SLOT_SUBTITLE: escapeHtml(subtitle),
    SLOT_CARD_BODY: cardBodyHtml(input.cards, labels, locale, sanitizeOpts),
  });
}

/** 30-day pack offline HTML (vault popup / download). */
export function buildReminderPackOfflineHtml(
  job: ReminderPackJobLike,
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
  const sanitizeOpts = sanitizeOptsFromBuild(opts);
  const { calendar, daysJson } = buildCalendarHtml(job, locale, sanitizeOpts);
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


/** Today as Y-M-D in local calendar (client vault open). */
function todayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Stub pending window for blank pack chrome before companion job exists. */
function blankPackStubJob(
  locale: CompanionLocale,
  opts?: { primaryName?: string; backupName?: string; deliveryDayKey?: string },
): ReminderPackJobLike {
  const delivery = opts?.deliveryDayKey?.trim() || todayDateKey();
  const primaryName =
    opts?.primaryName?.trim() || (locale === "zh" ? "主线" : "Primary");
  const backupName =
    opts?.backupName?.trim() || (locale === "zh" ? "备线" : "Backup");
  const days: CompanionDayRecord[] = [];
  for (let i = 0; i < COMPANION_WINDOW_DAYS; i++) {
    days.push({
      day_index: i,
      date_key: addDaysKey(delivery, i),
      status: "pending",
      cards: null,
      error: null,
      generated_at: null,
      delivered_at: null,
      sent_at: null,
    });
  }
  return {
    delivery_day_key: delivery,
    ends_day_key: addDaysKey(delivery, COMPANION_WINDOW_DAYS - 1),
    brief: {
      schemaVersion: 1,
      locale,
      primary: {
        role: "primary",
        name: primaryName,
        claim: "",
        strategy_excerpt: "",
        means_excerpts: [],
      },
      backup: {
        role: "backup",
        name: backupName,
        claim: "",
        strategy_excerpt: "",
        means_excerpts: [],
      },
      original_question: "",
    },
    days,
  };
}

/**
 * Path C / SoT16 §8: first seal opens blank pack chrome immediately
 * (pending day slots), then progressive fill replaces srcDoc with the
 * same offline HTML as download/email.
 */
export function buildReminderPackBlankOpenHtml(
  locale: string,
  opts?: BuildReminderOfflineHtmlOptions & {
    primaryName?: string;
    backupName?: string;
    deliveryDayKey?: string;
  },
): string {
  const loc = normalizeCompanionLocale(locale);
  const generatingNote =
    opts?.packNote?.trim() ||
    (loc === "zh"
      ? "正在生成 30 日提醒包；日历格会随每日内容填入同一份离线 HTML。"
      : "Generating the 30-day pack — day slots fill this same offline HTML.");
  return buildReminderPackOfflineHtml(
    blankPackStubJob(loc, opts),
    { ...opts, packNote: generatingNote },
  );
}

/** Progressive srcDoc: blank pack when no job yet; filled pack when sealed. */
export function buildReminderPackProgressiveHtml(
  job: ReminderPackJobLike | null | undefined,
  opts?: BuildReminderOfflineHtmlOptions & {
    locale?: string;
    primaryName?: string;
    backupName?: string;
    deliveryDayKey?: string;
  },
): string {
  if (!job) {
    return buildReminderPackBlankOpenHtml(opts?.locale || "en", opts);
  }
  return buildReminderPackOfflineHtml(job, opts);
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
