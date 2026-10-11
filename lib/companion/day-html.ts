/**
 * Self-contained single-day companion HTML (email attachment / offline).
 */

import type { CompanionDayCards, CompanionJob } from "./types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cardBlock(
  title: string,
  card: CompanionDayCards["primary"],
  labels: { field: string; plan: string; move: string },
): string {
  return `<section class="card">
  <h2>${escapeHtml(title)}</h2>
  <h3>${escapeHtml(labels.field)}</h3>
  <p>${escapeHtml(card.field_tone)}</p>
  <h3>${escapeHtml(labels.plan)}</h3>
  <p>${escapeHtml(card.against_plan)}</p>
  <h3>${escapeHtml(labels.move)}</h3>
  <p>${escapeHtml(card.one_move)}</p>
</section>`;
}

/** Build offline HTML for one delivered day (no gold calendar). */
export function buildCompanionDayHtml(input: {
  job: CompanionJob;
  dayIndex: number;
  cards: CompanionDayCards;
}): string {
  const zh = input.job.brief.locale.startsWith("zh");
  const day = input.job.days[input.dayIndex];
  const dateKey = day?.date_key ?? "";
  const labels = zh
    ? { field: "今日场域", plan: "对着这条方案", move: "今天一小步" }
    : { field: "Today's field", plan: "Against this plan", move: "One move today" };
  const title = zh
    ? `主辅提醒 · ${dateKey}（第 ${input.dayIndex + 1}/30 日）`
    : `Primary / backup reminder · ${dateKey} (day ${input.dayIndex + 1}/30)`;

  return `<!DOCTYPE html>
<html lang="${zh ? "zh" : "en"}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
  body{font-family:Georgia,serif;background:#0c0a09;color:#f5f0e8;margin:0;padding:24px;line-height:1.55}
  h1{font-size:1.35rem;color:#d4a84b;margin:0 0 8px}
  .sub{color:#a8a29e;font-size:.9rem;margin:0 0 24px}
  .card{border:1px solid #3f3a32;border-radius:12px;padding:18px 20px;margin:0 0 16px;background:#161311}
  .card h2{margin:0 0 12px;font-size:1.1rem;color:#e7c87a}
  .card h3{margin:14px 0 6px;font-size:.85rem;letter-spacing:.04em;text-transform:uppercase;color:#a8a29e}
  .card p{margin:0;white-space:pre-wrap}
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="sub">${escapeHtml(
    zh
      ? `主：${input.job.brief.primary.name} · 辅：${input.job.brief.backup.name}`
      : `Primary: ${input.job.brief.primary.name} · Backup: ${input.job.brief.backup.name}`,
  )}</p>
  ${cardBlock(
    zh ? `主路径 · ${input.job.brief.primary.name}` : `Primary · ${input.job.brief.primary.name}`,
    input.cards.primary,
    labels,
  )}
  ${cardBlock(
    zh ? `辅路径 · ${input.job.brief.backup.name}` : `Backup · ${input.job.brief.backup.name}`,
    input.cards.backup,
    labels,
  )}
</body>
</html>`;
}
