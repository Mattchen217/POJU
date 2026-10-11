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

/** Strip ⟦t:term⟧ markers for plain email; keep term text. */
function stripTermMarks(s: string): string {
  return s.replace(/⟦t:([^⟧]+)⟧/g, "$1");
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
  const c = input.cards;
  const labels = zh
    ? {
        today: "今天是什么",
        suitable: "今天适合",
        unsuitable: "今天不宜",
        suggestion: "建议",
        evidence: "今日依据",
      }
    : {
        today: "What today is",
        suitable: "Favors today",
        unsuitable: "Hold back today",
        suggestion: "Suggestion",
        evidence: "Why today",
      };
  const title = zh
    ? `每日提醒 · ${dateKey}（第 ${input.dayIndex + 1}/30 日）`
    : `Daily reminder · ${dateKey} (day ${input.dayIndex + 1}/30)`;

  const section = (h: string, body: string) =>
    `<h3>${escapeHtml(h)}</h3><p>${escapeHtml(body)}</p>`;

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
  .card h3{margin:14px 0 6px;font-size:.85rem;letter-spacing:.04em;text-transform:uppercase;color:#a8a29e}
  .card h3:first-child{margin-top:0}
  .card p{margin:0;white-space:pre-wrap}
  .evidence{border-top:1px solid #3f3a32;margin-top:18px;padding-top:14px;color:#d6d3d1;font-size:.95rem}
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="sub">${escapeHtml(
    zh
      ? `锚定主：${input.job.brief.primary.name} · 辅：${input.job.brief.backup.name}`
      : `Anchored primary: ${input.job.brief.primary.name} · backup: ${input.job.brief.backup.name}`,
  )}</p>
  <section class="card">
    ${section(labels.today, c.today_is)}
    ${section(labels.suitable, c.suitable)}
    ${section(labels.unsuitable, c.unsuitable)}
    ${section(labels.suggestion, c.suggestion)}
    <div class="evidence">
      ${section(labels.evidence, stripTermMarks(c.evidence))}
    </div>
  </section>
</body>
</html>`;
}
