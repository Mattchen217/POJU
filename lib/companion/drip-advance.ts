/**
 * Companion lifecycle:
 * 1) fill 1–2 days / invoke → 2) full-window gate → 3) drip one day → wipe that day
 * 4) after window ends → purge whole job.
 */

import { resolveBaziDayContext } from "@/lib/calculations/liuri";
import { getResendFromNotify } from "@/lib/email/from-addresses";
import { sendEmail } from "@/lib/email/resend-client";

import { gateCompanionBatch } from "./batch-gate";
import { generateCompanionDayPair, nextPendingDayIndexes } from "./batch-generate";
import { buildReminderDayOfflineHtml, reminderDayOfflineFilename } from "./reminder-day-offline-html";
import { formatDateKey } from "./date-keys";
import { normalizeCompanionLocale, companionUiLabels } from "./locale-voice";
import { saveCompanionJob } from "./job-store";
import {
  COMPANION_WINDOW_DAYS,
  type CompanionDayRecord,
  type CompanionJob,
} from "./types";

async function sendDayEmail(job: CompanionJob, dayIndex: number): Promise<boolean> {
  const day = job.days[dayIndex];
  if (!day?.cards || !job.email?.trim()) return false;

  const locale = normalizeCompanionLocale(job.brief.locale);
  const labels = companionUiLabels(locale);
  const html_attachment = buildReminderDayOfflineHtml({
    job,
    dayIndex,
    cards: day.cards,
    opts: { embed: false },
  });
  const dayNum = String(dayIndex + 1).padStart(2, "0");
  const title = labels.title(day.date_key, dayIndex + 1);
  const body_text = [
    day.cards.today_is,
    "",
    labels.favorsPrefix,
    day.cards.suitable,
    "",
    labels.holdPrefix,
    day.cards.unsuitable,
    "",
    labels.suggestionPrefix,
    day.cards.suggestion,
  ].join("\n");

  const result = await sendEmail({
    from: getResendFromNotify(),
    to: job.email,
    subject: title,
    html: `<p>${labels.emailIntro}</p>`,
    text: body_text,
    attachments: [
      {
        filename: reminderDayOfflineFilename(dayIndex + 1, day.date_key),
        content: html_attachment,
      },
    ],
    logTag: "companion",
  });

  return result.ok;
}

/** Wipe one day's cards after browser push + optional email. */
function purgeDayContent(day: CompanionDayRecord, now: string): void {
  day.cards = null;
  day.status = "purged";
  day.error = null;
  if (!day.delivered_at) day.delivered_at = now;
}

/** Full job wipe after window ends (Never Stored narrow retention). */
export async function purgeCompanionJobFully(
  job: CompanionJob,
): Promise<CompanionJob> {
  const now = new Date().toISOString();
  job.purged_at = now;
  job.email = null;
  job.liuri_pack = [];
  job.batch_status = job.batch_status === "ready" ? "ready" : job.batch_status;
  job.days = job.days.map((d) => ({
    ...d,
    cards: null,
    status: "purged",
    error: null,
  }));
  job.updated_at = now;
  await saveCompanionJob(job);
  return job;
}

/**
 * Fill next 1–2 pending days in one LLM invoke. Does not drip yet.
 */
export async function fillCompanionJobPair(
  job: CompanionJob,
  opts?: { pair_size?: 1 | 2 },
): Promise<CompanionJob> {
  if (job.purged_at) return job;
  if (job.batch_status === "ready") return job;

  const pending = nextPendingDayIndexes(
    job.days.map((d) => ({ day_index: d.day_index, cards: d.cards })),
    opts?.pair_size ?? 2,
  );
  if (!pending.length) {
    return runCompanionBatchGateOnJob(job);
  }

  job.batch_status = "filling";
  try {
    const pair = await generateCompanionDayPair({
      brief: job.brief,
      liuri_pack: job.liuri_pack,
      days: job.days.map((d) => ({
        day_index: d.day_index,
        date_key: d.date_key,
        cards: d.cards,
        generated_at: d.generated_at,
      })),
      day_indexes: pending,
      locale: job.brief.locale,
      sessionId: job.session_id,
      thinking_effort: "medium",
    });

    const now = new Date().toISOString();
    for (const slot of pair.generated) {
      const day = job.days[slot.day_index];
      if (!day) continue;
      if (slot.cards && !slot.error) {
        day.cards = slot.cards;
        day.status = "generated";
        day.generated_at = slot.generated_at ?? now;
        day.error = null;
      } else {
        day.status = "failed";
        day.error = slot.error ?? "generate_failed";
        // Do not persist failed-gate drafts into the job window.
        day.cards = null;
      }
    }
  } catch (e) {
    job.batch_status = "failed";
    job.batch_gate = {
      passed: false,
      failed_rule: "companion_fill_exception",
      detail: e instanceof Error ? e.message : String(e),
      checked_at: new Date().toISOString(),
    };
    job.updated_at = new Date().toISOString();
    await saveCompanionJob(job);
    return job;
  }

  job.updated_at = new Date().toISOString();
  await saveCompanionJob(job);

  const stillPending = nextPendingDayIndexes(
    job.days.map((d) => ({ day_index: d.day_index, cards: d.cards })),
    1,
  );
  if (!stillPending.length) {
    return runCompanionBatchGateOnJob(job);
  }
  return job;
}

/** Run whole-window gate; mark ready or failed. */
export async function runCompanionBatchGateOnJob(
  job: CompanionJob,
): Promise<CompanionJob> {
  const gate = gateCompanionBatch(
    job.days.map((d) => ({ day_index: d.day_index, cards: d.cards })),
    { require_full_window: true },
  );
  job.batch_gate = {
    passed: gate.passed,
    failed_rule: gate.failed_rule,
    detail: gate.detail,
    checked_at: gate.checked_at,
    generated_count: gate.generated_count,
  };
  job.batch_status = gate.passed ? "ready" : "failed";
  job.updated_at = new Date().toISOString();
  if (gate.passed) {
    try {
      const { fillReminders30dHtml } =
        require("@/lib/deliverables/fill-reminders") as typeof import("@/lib/deliverables/fill-reminders");
      const loc = job.brief.locale;
      job.filled_html = fillReminders30dHtml(job, loc);
      job.filled_html_locale = loc;
      // Best-effort: also stash on session bag when session is loadable.
      try {
        const { loadPOJUSession, savePOJUSession } =
          require("@/lib/poju/session-manager") as typeof import("@/lib/poju/session-manager");
        const { ensureRemindersFilledHtml } =
          require("@/lib/deliverables/persist") as typeof import("@/lib/deliverables/persist");
        const session = await loadPOJUSession(job.session_id);
        if (session) {
          const { session: next } = ensureRemindersFilledHtml(session, job, loc);
          await savePOJUSession(next);
        }
      } catch (inner) {
        console.warn("[companion] session reminders html persist skipped", inner);
      }
    } catch (e) {
      console.warn("[companion] fillReminders30dHtml failed", e);
    }
  }
  await saveCompanionJob(job);
  return job;
}

/**
 * Deliver today's generated day (batch must be ready), then wipe that day's content.
 * Optional email when mail_opt_in.
 */
export async function deliverDueCompanionDay(
  job: CompanionJob,
  opts?: { forceSend?: boolean; asOf?: Date },
): Promise<CompanionJob> {
  if (job.purged_at) return job;

  const todayKey = formatDateKey(
    resolveBaziDayContext(opts?.asOf ?? new Date(), job.timezone).baziDay,
  );

  if (todayKey > job.ends_day_key) {
    return purgeCompanionJobFully(job);
  }

  if (job.batch_status !== "ready") {
    return job;
  }

  const due = job.days.find(
    (d) =>
      d.date_key <= todayKey &&
      d.status === "generated" &&
      d.cards != null,
  );
  if (!due) {
    const allPurged = job.days.every(
      (d) => d.status === "purged" || d.date_key > todayKey,
    );
    const pastEnd = todayKey > job.ends_day_key;
    if (pastEnd || (allPurged && todayKey >= job.ends_day_key)) {
      return purgeCompanionJobFully(job);
    }
    return job;
  }

  const now = new Date().toISOString();
  due.status = "delivered";
  due.delivered_at = now;

  if (job.mail_opt_in && job.email) {
    const sent = await sendDayEmail(job, due.day_index);
    if (sent || opts?.forceSend) {
      due.status = "sent";
      due.sent_at = new Date().toISOString();
    }
  }

  // Push/send done → delete that day's stored content immediately.
  purgeDayContent(due, now);

  job.updated_at = now;
  await saveCompanionJob(job);

  const remaining = job.days.some(
    (d) => d.status === "generated" || d.status === "pending" || d.status === "failed",
  );
  if (!remaining && todayKey >= job.ends_day_key) {
    return purgeCompanionJobFully(job);
  }
  return job;
}

/**
 * @deprecated Prefer fillCompanionJobPair + deliverDueCompanionDay.
 * Kept for Lab day-zero smoke: generate one day without requiring full gate.
 */
export async function advanceCompanionJob(
  job: CompanionJob,
  opts?: { forceSend?: boolean },
): Promise<CompanionJob> {
  if (job.batch_status === "ready") {
    return deliverDueCompanionDay(job, opts);
  }
  const filled = await fillCompanionJobPair(job, { pair_size: 1 });
  if (filled.batch_status === "ready") {
    return deliverDueCompanionDay(filled, opts);
  }
  return filled;
}

/** After seal: start filling (do not drip until batch gate passes). */
export async function deliverCompanionDayZero(
  job: CompanionJob,
): Promise<CompanionJob> {
  if (job.days[0]?.status === "pending") {
    return fillCompanionJobPair(job, { pair_size: 2 });
  }
  return job;
}

export function companionGeneratedCount(job: CompanionJob): number {
  return job.days.filter((d) => d.cards != null || d.status === "generated").length;
}

export function companionWindowComplete(job: CompanionJob): boolean {
  return companionGeneratedCount(job) >= COMPANION_WINDOW_DAYS;
}
