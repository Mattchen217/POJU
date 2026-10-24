/**
 * Smoke: reminder day + pack blank → filled (SoT 16 path C).
 * Run: pnpm tsx scripts/smoke-reminder-day-offline-html.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

import {
  buildReminderDayOfflineHtml,
  buildReminderPackBlankOpenHtml,
  buildReminderPackOfflineHtml,
  buildReminderPackProgressiveHtml,
  getReminderDayBlankTemplate,
  getReminderPackBlankTemplate,
  reminderDayOfflineFilename,
  reminderPackOfflineFilename,
} from "@/lib/companion/reminder-day-offline-html";
import type { CompanionJob } from "@/lib/companion/types";

function sampleJob(): CompanionJob {
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date("2026-10-21T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    const date_key = d.toISOString().slice(0, 10);
    const cards =
      i < 3
        ? {
            today_is: `Day ${i + 1} field: steady pace.`,
            suitable: "Protect deep work blocks.",
            unsuitable: "Do not force a hard launch.",
            suggestion: "Keep one clear next step.",
            evidence: "Transit note with ⟦t:比肩|peer peer⟧ marker.",
          }
        : null;
    return {
      day_index: i,
      date_key,
      status: (cards ? "generated" : "pending") as "generated" | "pending",
      cards,
      error: null,
    };
  });
  return {
    id: "smoke-reminder-job",
    session_id: "smoke-session",
    profile_id: null,
    email: null,
    timezone: "America/Chicago",
    mail_opt_in: false,
    delivery_day_key: "2026-10-21",
    ends_day_key: days[29]!.date_key,
    brief: {
      schemaVersion: 1,
      locale: "zh",
      primary: {
        role: "primary",
        name: "稳现金流",
        claim: "先稳住",
        strategy_excerpt: "稳",
        means_excerpts: ["现金流"],
      },
      backup: {
        role: "backup",
        name: "缓跃迁",
        claim: "窗口后再动",
        strategy_excerpt: "缓",
        means_excerpts: ["窗口"],
      },
      original_question: "是否该跳槽",
    },
    liuri_pack: [],
    days,
    batch_status: "filling",
    batch_gate: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    purged_at: null,
  };
}

async function main() {
  const dayBlank = getReminderDayBlankTemplate();
  const packBlank = getReminderPackBlankTemplate();
  if (!dayBlank.includes("{{SLOT_CARD_BODY}}") || !packBlank.includes("{{SLOT_CALENDAR}}")) {
    throw new Error("reminder blanks missing slots");
  }
  const job = sampleJob();
  const dayHtml = buildReminderDayOfflineHtml({
    job,
    dayIndex: 0,
    cards: job.days[0]!.cards!,
    opts: { embed: false },
  });
  const packHtml = buildReminderPackOfflineHtml(job, { embed: true });
  if (dayHtml.includes("{{SLOT_")) throw new Error("unfilled day slots");
  if (packHtml.includes("{{SLOT_")) throw new Error("unfilled pack slots");
  if (!dayHtml.includes("poju-companion-sheet__card")) throw new Error("missing day card chrome");
  if (!packHtml.includes("atmos-forecast__cal")) throw new Error("missing pack calendar chrome");
  if (dayHtml.length < 20_000) throw new Error(`day too small ${dayHtml.length}`);
  if (packHtml.length < 30_000) throw new Error(`pack too small ${packHtml.length}`);

  const blankOpen = buildReminderPackBlankOpenHtml("zh", { embed: true });
  const progressiveEmpty = buildReminderPackProgressiveHtml(null, {
    locale: "zh",
    embed: true,
  });
  const progressiveFilled = buildReminderPackProgressiveHtml(job, { embed: true });
  if (blankOpen.includes("{{SLOT_")) throw new Error("unfilled blank-open slots");
  if (!blankOpen.includes("atmos-forecast__cal")) throw new Error("blank-open missing calendar");
  if (!blankOpen.includes("atmos-forecast__pending")) throw new Error("blank-open missing pending slots");
  if (progressiveEmpty !== blankOpen && !progressiveEmpty.includes("atmos-forecast__cal")) {
    throw new Error("progressive(null) missing calendar");
  }
  if (progressiveFilled.includes("{{SLOT_")) throw new Error("unfilled progressive slots");
  if (!progressiveFilled.includes("poju-companion-sheet__card")) {
    throw new Error("progressive(job) missing filled day card");
  }

  const dir = join(process.cwd(), "temp");
  mkdirSync(dir, { recursive: true });
  const dayName = reminderDayOfflineFilename(1, job.days[0]!.date_key);
  const packName = reminderPackOfflineFilename();
  const dayOut = join(dir, dayName);
  const packOut = join(dir, packName);
  const stableDay = join(dir, "eastern-os-reminder-day-smoke.html");
  const stablePack = join(dir, "eastern-os-reminder-pack-smoke.html");
  writeFileSync(dayOut, dayHtml, "utf8");
  writeFileSync(packOut, packHtml, "utf8");
  writeFileSync(stableDay, dayHtml, "utf8");
  writeFileSync(stablePack, packHtml, "utf8");
  const blankOut = join(dir, "eastern-os-reminder-pack-blank-open.html");
  writeFileSync(blankOut, blankOpen, "utf8");
  console.log("READY reminder offline html");
  console.log("day_blank_bytes", dayBlank.length);
  console.log("pack_blank_bytes", packBlank.length);
  console.log("day_filled_bytes", dayHtml.length);
  console.log("pack_filled_bytes", packHtml.length);
  console.log("day", dayOut);
  console.log("pack", packOut);
  console.log("stable_day", stableDay);
  console.log("stable_pack", stablePack);
  console.log("blank_open", join(dir, "eastern-os-reminder-pack-blank-open.html"));
  console.log("blank_open_bytes", blankOpen.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
