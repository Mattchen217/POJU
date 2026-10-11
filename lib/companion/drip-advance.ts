/**
 * Advance companion drip: generate next pending day; optionally email when due.
 */

import { generateCompanionDayCards } from "./companion-daily-service";
import { buildCompanionDayHtml } from "./day-html";
import { saveCompanionJob } from "./job-store";
import type { CompanionJob } from "./types";

function toBase64Utf8(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}

async function sendDayEmail(job: CompanionJob, dayIndex: number): Promise<boolean> {
  const day = job.days[dayIndex];
  if (!day?.cards || !job.email?.trim()) return false;

  const html_attachment = buildCompanionDayHtml({
    job,
    dayIndex,
    cards: day.cards,
  });
  const zh = job.brief.locale.startsWith("zh");
  const title = zh
    ? `主辅提醒 · ${day.date_key}`
    : `Primary / backup reminder · ${day.date_key}`;
  const body_text = [
    `${job.brief.primary.name}`,
    day.cards.primary.one_move,
    "",
    `${job.brief.backup.name}`,
    day.cards.backup.one_move,
  ].join("\n");

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.info("[companion] email mocked", job.email, day.date_key);
    return true;
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim() || "noreply@easternos.com";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [job.email],
      subject: title,
      html: `<p>${zh ? "附件是今日主辅提醒页，请用浏览器打开。" : "Attached is today's primary/backup reminder — open in a browser."}</p>`,
      text: body_text,
      attachments: [
        {
          filename: `companion-${day.date_key}.html`,
          content: toBase64Utf8(html_attachment),
        },
      ],
    }),
  });
  if (!response.ok) {
    console.error("[companion] resend", await response.text());
    return false;
  }
  return true;
}

/**
 * Generate the earliest pending day (day-ahead pipeline).
 * Marks generated → delivered. Sends email if mail_opt_in and email present.
 */
export async function advanceCompanionJob(
  job: CompanionJob,
  opts?: { forceSend?: boolean },
): Promise<CompanionJob> {
  const next = job.days.find((d) => d.status === "pending" || d.status === "failed");
  if (!next) return job;

  const snapshot = job.liuri_pack[next.day_index];
  if (!snapshot) {
    next.status = "failed";
    next.error = "missing_liuri_snapshot";
    job.updated_at = new Date().toISOString();
    await saveCompanionJob(job);
    return job;
  }

  try {
    const { cards } = await generateCompanionDayCards({
      brief: job.brief,
      snapshot,
      dayIndex: next.day_index,
      locale: job.brief.locale,
      sessionId: job.session_id,
    });
    const now = new Date().toISOString();
    next.cards = cards;
    next.status = "delivered";
    next.generated_at = now;
    next.delivered_at = now;
    next.error = null;

    if (job.mail_opt_in && job.email) {
      const sent = await sendDayEmail(job, next.day_index);
      if (sent || opts?.forceSend) {
        next.status = "sent";
        next.sent_at = new Date().toISOString();
      }
    }
  } catch (e) {
    next.status = "failed";
    next.error = e instanceof Error ? e.message : String(e);
  }

  job.updated_at = new Date().toISOString();
  await saveCompanionJob(job);
  return job;
}

/** Generate day 0 immediately after seal (avoid empty window). */
export async function deliverCompanionDayZero(job: CompanionJob): Promise<CompanionJob> {
  if (job.days[0] && job.days[0].status === "pending") {
    return advanceCompanionJob(job);
  }
  return job;
}
