/**
 * Personal baseline profile → offline HTML (same fixed delivery-book card chrome).
 * Five BASELINE_MATRIX_BLOCKS pages with real PojuMatrixPayload content (B1–B5).
 */

import {
  elementCssClass,
  getStemInfo,
  yongshenChipsForLocale,
} from "@/lib/poju/bazi-matrix-mappings";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { activePillarByAge } from "@/lib/poju/matrix-life-segment";
import {
  getMatrixSynopsisPlainText,
  resolveMatrixDisplay,
} from "@/lib/poju/matrix-narrative-text";
import {
  matrixElementSoft,
  matrixSoftTerm,
} from "@/lib/poju/matrix-term-labels";
import { computeYearTransitProgress } from "@/lib/poju/matrix-transit-progress";
import { normalizeMatrixLocale, tMatrix } from "@/lib/poju/poju-matrix-i18n";
import { normalizeShenshaLocale, resolveShenshaList } from "@/lib/poju/shensha";
import { HOUR_PERIOD_INFO } from "@/lib/profile/types";

/** Mirrors BASELINE_MATRIX_BLOCKS in PojuEnergyMatrix (lib-safe, no client import). */
export const BASELINE_EXPORT_BLOCKS = [
  { id: "calibration", labelKey: "block_1" },
  { id: "energy", labelKey: "block_2" },
  { id: "trajectory", labelKey: "block_3" },
  { id: "markers", labelKey: "block_4" },
  { id: "core", labelKey: "block_5" },
] as const;

export type BuildBaselineInteractiveHtmlOptions = {
  title?: string;
  subtitle?: string;
  /** Optional vault subject line (meta). */
  subjectLabel?: string;
  profileLine?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function langAttr(locale: string): string {
  if (locale.startsWith("zh")) return "zh-Hans";
  if (locale.startsWith("es")) return "es";
  if (locale.startsWith("de")) return "de";
  if (locale.startsWith("fr")) return "fr";
  return "en";
}

function localeDisplay(locale: string): string {
  if (locale.startsWith("zh")) return "中文";
  return locale.slice(0, 2).toUpperCase();
}

function tc(locale: string, key: string, vars?: Record<string, string>): string {
  return tMatrix(locale, `card.${key}`, vars);
}

function strengthLabel(
  strength: "strong" | "weak" | "balanced",
  locale: string,
): string {
  if (strength === "strong") return tc(locale, "strength_strong");
  if (strength === "weak") return tc(locale, "strength_weak");
  return tc(locale, "strength_balanced");
}

function vitalityPin(strength: "strong" | "weak" | "balanced"): string {
  if (strength === "weak") return "22%";
  if (strength === "balanced") return "50%";
  return "78%";
}

function formatBornLine(payload: PojuMatrixPayload): string {
  const profile = payload.user_profile;
  if (!profile?.birth) return "";
  const b = profile.birth;
  const pad = (n: number) => String(n).padStart(2, "0");
  const time =
    profile.tst_meta?.original_time ?? profile.birth.tst_meta?.original_time ?? "";
  const date = `${b.year} - ${pad(b.month)} - ${pad(b.day)}`;
  return time ? `${date} - ${time}` : date;
}

function formatPlaceLine(payload: PojuMatrixPayload, locale: string): string {
  const profile = payload.user_profile;
  if (!profile) return "";
  const loc = profile.birth?.birth_location;
  const tstLon = profile.tst_meta?.longitude ?? profile.birth?.tst_meta?.longitude;
  const lon = loc?.longitude ?? tstLon;
  if (loc?.name && lon != null && !loc.use_defaults) {
    const dir = lon >= 0 ? "E" : "W";
    return `${loc.name} ${Math.abs(lon).toFixed(2)}°${dir}`;
  }
  return loc?.name || profile.birth?.timezone || tc(locale, "default_timezone");
}

function genderLabel(payload: PojuMatrixPayload, locale: string): string {
  const zh = normalizeMatrixLocale(locale) === "zh";
  const g = payload.user_profile?.birth?.gender;
  if (g === "M") return zh ? "乾造" : "Male";
  if (g === "F") return zh ? "坤造" : "Female";
  return "";
}

/** Offline zodiac: large hanzi + optional emoji (no remote/image assets). */
const ZODIAC_EMOJI: Record<string, string> = {
  鼠: "🐀",
  牛: "🐂",
  虎: "🐅",
  兔: "🐇",
  龙: "🐉",
  蛇: "🐍",
  马: "🐴",
  羊: "🐐",
  猴: "🐒",
  鸡: "🐓",
  狗: "🐕",
  猪: "🐖",
};

function chipHtml(
  soft: string,
  tone: "cyan" | "coral" | "gold" | "neutral" = "neutral",
): string {
  if (!soft) return "";
  return `<span class="pcm-chip pcm-chip--${tone}">${escapeHtml(soft)}</span>`;
}

function barFillClass(element: string): string {
  const map: Record<string, string> = {
    Wood: "pcm-bar__fill--wood",
    Fire: "pcm-bar__fill--fire",
    Earth: "pcm-bar__fill--earth",
    Metal: "pcm-bar__fill--metal",
    Water: "pcm-bar__fill--water",
  };
  return map[element] ?? "";
}

/** Compact SVG radar from wuxing scores (self-contained). */
function radarSvgHtml(
  scores: PojuMatrixPayload["wuxing_scores"],
): string {
  const n = scores.length || 5;
  const cx = 100;
  const cy = 100;
  const r = 72;
  const max = Math.max(...scores.map((s) => s.count), 1);
  const pts = scores
    .map((s, i) => {
      const ang = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
      const rr = r * (s.count / max);
      return `${cx + rr * Math.cos(ang)},${cy + rr * Math.sin(ang)}`;
    })
    .join(" ");
  const grid = [0.35, 0.65, 1]
    .map((scale) => {
      const ring = scores
        .map((_, i) => {
          const ang = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
          return `${cx + r * scale * Math.cos(ang)},${cy + r * scale * Math.sin(ang)}`;
        })
        .join(" ");
      return `<polygon points="${ring}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`;
    })
    .join("");
  const spokes = scores
    .map((_, i) => {
      const ang = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
      return `<line x1="${cx}" y1="${cy}" x2="${cx + r * Math.cos(ang)}" y2="${cy + r * Math.sin(ang)}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;
    })
    .join("");
  const labels = scores
    .map((s, i) => {
      const ang = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
      const lx = cx + (r + 16) * Math.cos(ang);
      const ly = cy + (r + 16) * Math.sin(ang);
      return `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="#9ca3af" font-size="10">${escapeHtml(s.element_zh || s.element)}</text>`;
    })
    .join("");
  return `<svg class="pcm-radar__svg" viewBox="0 0 200 200" width="220" height="220" aria-hidden="true">${grid}${spokes}<polygon points="${pts}" fill="rgba(242,202,80,0.22)" stroke="#f2ca50" stroke-width="1.5"/>${labels}</svg>`;
}

const CARD_CSS = `
*, *::before, *::after { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; height: 100%; overflow: hidden;
  background: #0B0815; color: #e0e2e8;
  font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.delivery-book-stage {
  --delivery-inset: 64px;
  display: flex; flex-direction: column;
  width: 100%; height: 100%; min-height: 0;
  padding: var(--delivery-inset);
}
.delivery-book-stage__shell {
  position: relative; flex: 1 1 auto; min-height: 0; width: 100%; max-width: 1280px;
  margin: 0 auto; display: flex; flex-direction: column;
  border-radius: 16px; overflow: hidden;
  border: 1px solid rgba(242, 202, 80, 0.35); background: #111827;
  box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(242,202,80,0.12);
}
.delivery-book-stage__card {
  position: relative; z-index: 1; flex: 1 1 auto; min-height: 0; width: 100%;
  display: flex; flex-direction: column; overflow: hidden; background: #111827;
}
.delivery-book-stage__panes {
  display: grid; grid-template-columns: minmax(260px, 380px) 1fr; flex: 1; min-height: 0;
}
.delivery-book-stage__left {
  display: flex; flex-direction: column; gap: 16px;
  padding: 24px 24px 16px; min-height: 0; overflow: hidden;
  background: #0c1219; border-right: 1px solid rgba(255,255,255,0.08);
}
.delivery-book-stage__product-title {
  margin: 0 0 6px; display: flex; flex-direction: column; gap: 6px;
  font-size: clamp(22px, 2.4vw, 32px); font-weight: 700; line-height: 1.12;
  letter-spacing: -0.02em; color: transparent;
  background: linear-gradient(135deg, #8a6a1a 0%, #bf953f 16%, #fcf6ba 36%, #d4af37 50%, #fbf5b7 66%, #b38728 82%, #aa771c 100%);
  background-size: 140% 140%; -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 10px rgba(212,175,55,0.24));
}
.delivery-book-stage__product-title span { display: block; }
.delivery-book-stage__product-title-line3 {
  font-size: 0.88em; letter-spacing: -0.02em; white-space: nowrap;
}
.delivery-book-stage__meta-card {
  display: flex; flex-direction: column; gap: 8px; padding: 10px 12px;
  border-radius: 4px; background: #111827; border: 1px solid rgba(255,255,255,0.08);
}
.delivery-book-stage__meta-question {
  margin: 0; font-size: 13px; line-height: 1.4; font-weight: 500; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.delivery-book-stage__meta-row { display: flex; align-items: center; gap: 12px; min-width: 0; }
.delivery-book-stage__meta-cell { display: inline-flex; align-items: center; gap: 6px; min-width: 0; flex: 1 1 0; }
.delivery-book-stage__meta-icon { flex: 0 0 auto; font-size: 12px; color: rgba(255,255,255,0.55); }
.delivery-book-stage__meta-text {
  min-width: 0; font-size: 12px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.delivery-book-stage__toc { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; margin-top: 4px; overflow: hidden; }
.delivery-book-stage__toc-head {
  display: flex; align-items: center; gap: 8px; font-size: 11px; letter-spacing: 0.2em;
  text-transform: uppercase; color: #6b7280; margin-bottom: 12px;
}
.delivery-book-stage__toc-head-rule { display: inline-block; width: 12px; height: 1px; background: #6b7280; }
.delivery-book-stage__toc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.delivery-book-stage__toc-item {
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px 12px;
  border: 0; border-left: 2px solid transparent; border-radius: 4px;
  background: transparent; color: #9ca3af; text-align: left; cursor: pointer; font: inherit;
}
.delivery-book-stage__toc-item:hover { color: #fff; background: rgba(31,41,55,0.5); }
.delivery-book-stage__toc-item--ready { color: #fff; }
.delivery-book-stage__toc-item.is-active,
.delivery-book-stage__toc-item--active {
  color: #fde047; font-weight: 500; background: rgba(253,224,71,0.06);
  border-left-color: #fde047;
}
.delivery-book-stage__toc-num {
  flex: 0 0 auto; width: 1.1em; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #4b5563;
}
.delivery-book-stage__toc-item.is-active .delivery-book-stage__toc-num,
.delivery-book-stage__toc-item--active .delivery-book-stage__toc-num { color: #fde047; }
.delivery-book-stage__toc-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.delivery-book-stage__toc-tag { font-size: 10px; letter-spacing: 0.08em; color: #6b7280; }
.delivery-book-stage__toc-item.is-active .delivery-book-stage__toc-tag,
.delivery-book-stage__toc-item--active .delivery-book-stage__toc-tag { color: rgba(253,224,71,0.75); }
.delivery-book-stage__toc-title {
  font-size: 13px; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.delivery-book-stage__left-foot {
  margin-top: auto; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08);
  font-size: 10px; line-height: 1.45; color: #fff;
}
.delivery-book-stage__left-foot p { margin: 0 0 4px; }
.delivery-book-stage__right {
  position: relative; display: flex; flex-direction: column; min-height: 0; overflow: hidden;
}
.delivery-book-stage__pane {
  display: none; flex: 1 1 auto; min-height: 0; overflow-y: auto;
  padding: 32px 36px 28px; scroll-behavior: smooth;
}
.delivery-book-stage__pane.is-active { display: block; }
.delivery-book-stage__page-title {
  margin: 0 0 8px; font-size: clamp(22px, 2.4vw, 30px); font-weight: 700; line-height: 1.25;
  color: transparent; background: linear-gradient(90deg, #fff 0%, #9ca3af 100%);
  -webkit-background-clip: text; background-clip: text;
}
.delivery-book-stage__page-subtitle { margin: 0 0 28px; font-size: 13px; color: #9ca3af; }
.delivery-book-stage__chrome {
  --delivery-chrome-bg: #1a2336;
  position: relative; z-index: 3; flex: 0 0 auto;
  display: grid; grid-template-columns: minmax(100px, 1fr) minmax(180px, 1.5fr) minmax(120px, 1fr);
  align-items: center; gap: 8px; margin: 0; padding: 4px 14px; min-height: 44px;
  border: none; background: var(--delivery-chrome-bg);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.07);
}
.delivery-book-stage__chrome--header { border-radius: 16px 16px 0 0; border-bottom: 1px solid rgba(148,163,184,0.14); }
.delivery-book-stage__chrome--footer { border-radius: 0 0 16px 16px; border-top: 1px solid rgba(148,163,184,0.14); }
.delivery-book-stage__chrome-left, .delivery-book-stage__chrome-center, .delivery-book-stage__chrome-right {
  display: flex; align-items: center; min-width: 0;
}
.delivery-book-stage__chrome-left { justify-content: flex-start; }
.delivery-book-stage__chrome-center { justify-content: center; }
.delivery-book-stage__chrome-right { justify-content: flex-end; }
.delivery-book-stage__header-logo-text {
  font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.72); font-weight: 600;
}
.delivery-book-stage__pager { display: flex; align-items: center; gap: 4px; }
.delivery-book-stage__icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; padding: 0; border: none; border-radius: 6px;
  background: transparent; color: #fff; cursor: pointer; font-size: 16px; line-height: 1;
}
.delivery-book-stage__icon-btn:hover:not(:disabled) { background: rgba(255,255,255,0.04); }
.delivery-book-stage__icon-btn:disabled { opacity: 0.35; cursor: default; }
.delivery-book-stage__pager-pos {
  font-size: 12px; font-variant-numeric: tabular-nums; color: rgba(255,255,255,0.85);
  min-width: 3.5em; text-align: center;
}
/* ── Baseline content (pcm-*) ── */
.pcm-card {
  padding: 16px 18px; border-radius: 8px;
  background: #111827; border: 1px solid rgba(255,255,255,0.06);
  box-shadow: 0 6px 20px rgba(0,0,0,0.22);
}
.pcm-label {
  font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
  color: #9ca3af; margin: 0 0 12px; font-weight: 600;
}
.pcm-label--gold { color: #f2ca50; }
.pcm-label--cyan { color: #67e8f9; }
.pcm-label--cyan-soft { color: #a5f3fc; }
.pcm-label--coral { color: #fb923c; }
.pcm-label--sand { color: #d6d3d1; }
.pcm-label--white { color: #e5e7eb; }
.pcm-label--flush { margin-bottom: 8px; }
.pcm-calibration__top {
  display: grid; grid-template-columns: minmax(7.25rem, 9.5rem) minmax(0, 1fr);
  gap: 12px; align-items: stretch; margin: 0 0 14px;
}
.pcm-zodiac {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.4rem; margin: 0; padding: 14px 10px 12px; text-align: center;
  border: 1px solid rgba(255,255,255,0.08); border-radius: 4px;
  background: rgba(255,255,255,0.02); min-height: 100%;
}
.pcm-zodiac__art {
  width: 72px; height: 72px; display: flex; align-items: center; justify-content: center;
  border-radius: 50%; background: rgba(242,202,80,0.08);
  border: 1px solid rgba(242,202,80,0.22);
}
.pcm-zodiac__glyph {
  font-size: 2rem; line-height: 1; color: #fde047;
  font-family: "Songti SC", "Noto Serif SC", Georgia, serif;
}
.pcm-zodiac__emoji { font-size: 1.65rem; line-height: 1; }
.pcm-zodiac__name { font-size: 1.05rem; font-weight: 650; color: #fff; }
.pcm-zodiac__pinyin { font-size: 0.75rem; color: #9ca3af; letter-spacing: 0.04em; }
.pcm-zodiac__year { font-size: 0.8rem; color: #d4af37; font-variant-numeric: tabular-nums; }
.pcm-zodiac__caption { margin: 4px 0 0; font-size: 0.68rem; color: #6b7280; letter-spacing: 0.04em; }
.pcm-hero-strip {
  display: grid; grid-template-columns: 1fr; grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 10px; margin: 0; min-width: 0; height: 100%;
}
.pcm-hero-strip__item {
  border: 1px solid rgba(242,202,80,0.18); border-radius: 12px;
  padding: 12px 12px 10px; background: rgba(255,255,255,0.03);
}
.pcm-hero-strip__value {
  font-size: 1.05rem; font-weight: 650; color: #f4f4f5; line-height: 1.25;
}
.pcm-hero-strip__label {
  margin-top: 6px; font-size: 0.72rem; color: rgba(161,161,170,0.95);
  letter-spacing: 0.04em; text-transform: uppercase;
}
.pcm-cal { margin-top: 0; }
.pcm-cal__grid {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;
}
.pcm-cal__cell {
  padding: 12px; border-radius: 8px; background: rgba(11,15,18,0.55);
  border: 1px solid rgba(255,255,255,0.06);
}
.pcm-cal__kicker { font-size: 11px; color: #9ca3af; margin-bottom: 8px; letter-spacing: 0.04em; }
.pcm-cal__value { font-size: 15px; font-weight: 600; color: #fff; line-height: 1.35; }
.pcm-cal__unit { font-weight: 400; color: #9ca3af; font-size: 0.85em; }
.pcm-cal__sub { margin-top: 4px; font-size: 13px; color: #d1d5db; }
.pcm-cal__foot { margin-top: 10px; }
.pcm-cal__accent { font-size: 12px; color: #f2ca50; }
.pcm-cal__times { display: flex; align-items: center; gap: 10px; }
.pcm-cal__time-val { font-size: 15px; font-weight: 600; color: #fff; font-variant-numeric: tabular-nums; }
.pcm-cal__time-val--dim { color: #a1a1aa; }
.pcm-cal__time-label { font-size: 11px; color: #6b7280; margin-top: 2px; }
.pcm-cal__arrow { color: #6b7280; }
.pcm-cal__delta { margin-top: 8px; font-size: 13px; color: #f2ca50; }
.pcm-cal__note { margin-top: 6px; font-size: 11px; color: #9ca3af; line-height: 1.45; }
.pcm-term__head { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; color: #9ca3af; margin-top: 8px; }
.pcm-term__track { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.06); overflow: hidden; margin-top: 8px; }
.pcm-term__fill { height: 100%; width: var(--pcm-term-pct, 0%); background: linear-gradient(90deg, #d4af37, #f2ca50); border-radius: 3px; }
.pcm-energy { display: flex; flex-direction: column; gap: 14px; }
.pcm-energy__radar { display: flex; flex-direction: column; align-items: center; }
.pcm-radar__chart { display: flex; justify-content: center; padding: 8px 0; }
.pcm-energy__bottom { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 14px; }
.pcm-energy__rest { display: flex; flex-direction: column; gap: 14px; }
.pcm-bars__list { display: flex; flex-direction: column; gap: 10px; }
.pcm-bar__meta { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
.pcm-bar__name { color: #e5e7eb; }
.pcm-bar__value { color: #f2ca50; font-variant-numeric: tabular-nums; }
.pcm-bar__track { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.06); overflow: hidden; }
.pcm-bar__fill { height: 100%; width: var(--pcm-bar-pct, 0%); border-radius: 4px; }
.pcm-bar__fill--wood { background: linear-gradient(90deg, #166534, #4ade80); }
.pcm-bar__fill--fire { background: linear-gradient(90deg, #9a3412, #fb923c); }
.pcm-bar__fill--earth { background: linear-gradient(90deg, #854d0e, #facc15); }
.pcm-bar__fill--metal { background: linear-gradient(90deg, #64748b, #e2e8f0); }
.pcm-bar__fill--water { background: linear-gradient(90deg, #0e7490, #67e8f9); }
.pcm-bars__footer { margin-top: 12px; }
.pcm-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.pcm-chip {
  display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px;
  font-size: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #e5e7eb;
}
.pcm-chip--cyan { border-color: rgba(103,232,249,0.35); color: #a5f3fc; }
.pcm-chip--coral { border-color: rgba(251,146,60,0.35); color: #fdba74; }
.pcm-chip--gold { border-color: rgba(242,202,80,0.4); color: #fde047; }
.pcm-chip--neutral { color: #9ca3af; }
.pcm-chip--caps { text-transform: none; }
.pcm-vitality__title { margin: 0 0 12px; font-size: 16px; color: #fff; font-weight: 600; }
.pcm-vtrack { position: relative; height: 8px; border-radius: 4px; background: rgba(255,255,255,0.08); margin-bottom: 8px; }
.pcm-vtrack__pin {
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  width: 14px; height: 14px; border-radius: 50%; background: #fb923c;
  box-shadow: 0 0 10px rgba(251,146,60,0.55);
}
.pcm-vtrack__labels { display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; }
.pcm-eq__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pcm-eq__title { font-size: 14px; color: #fff; margin-bottom: 8px; }
.pcm-eq__pct { color: #f2ca50; }
.pcm-eq__hint { margin-top: 6px; font-size: 11px; }
.pcm-eq__hint--up { color: #4ade80; }
.pcm-eq__hint--down { color: #fb923c; }
.pcm__grid-12 { display: grid; grid-template-columns: 1fr 2fr; gap: 14px; }
.pcm-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pcm-facts-extra { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
.pcm-type-xl { font-size: 1.35rem; font-weight: 650; color: #fff; }
.pcm-type-lg { font-size: 1.05rem; font-weight: 600; color: #fff; }
.pcm-type-body { font-size: 13px; color: #9ca3af; line-height: 1.45; }
.pcm-timeline__list { display: flex; flex-direction: column; gap: 8px; }
.pcm-timeline-row {
  padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.02);
}
.pcm-timeline-row--now {
  border-color: rgba(242,202,80,0.35); background: rgba(242,202,80,0.08);
}
.pcm-timeline-row__range { font-size: 13px; color: #e5e7eb; font-weight: 500; }
.pcm-timeline-row__meta { margin-top: 4px; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; gap: 8px; }
.pcm-timeline-row__el { color: #f2ca50; }
.pcm-layer-stack { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.pcm-layer-row {
  display: grid; grid-template-columns: 4.5rem 1fr auto; gap: 8px; align-items: center;
  font-size: 12px; color: #9ca3af;
}
.pcm-layer-row.is-active { color: #fde047; }
.pcm-layer-row__track { height: 4px; border-radius: 2px; background: rgba(255,255,255,0.06); overflow: hidden; }
.pcm-layer-row__fill { height: 100%; background: linear-gradient(90deg, #d4af37, #fde047); }
.pcm-year-ring {
  margin-top: 10px; height: 8px; border-radius: 4px; background: rgba(255,255,255,0.06); overflow: hidden;
}
.pcm-year-ring__fill { height: 100%; background: linear-gradient(90deg, #0e7490, #67e8f9); }
.pcm-pillars { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 8px; }
.pcm-pl { display: flex; flex-direction: column; gap: 6px; min-height: 140px; }
.pcm-pl.pcm-card--glow { border-color: rgba(242,202,80,0.4); box-shadow: 0 0 18px rgba(242,202,80,0.12); }
.pcm-pl__slot { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #9ca3af; }
.pcm-pl__role { font-size: 13px; color: #f2ca50; }
.pcm-pl__stem { font-size: 1.25rem; font-weight: 700; color: #fff; }
.pcm-pl__stem.el-w { color: #4ade80; }
.pcm-pl__stem.el-f { color: #fb923c; }
.pcm-pl__stem.el-e { color: #facc15; }
.pcm-pl__stem.el-m { color: #e2e8f0; }
.pcm-pl__stem.el-water { color: #67e8f9; }
.pcm-pl__branch { font-size: 13px; color: #d1d5db; }
.pcm-pl__hidden { font-size: 11px; color: #6b7280; }
.pcm-pl__list { margin: 4px 0 0; padding: 0 0 0 1rem; font-size: 11px; color: #a1a1aa; }
.pcm-onset-rail { margin-top: 12px; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.06); position: relative; }
.pcm-onset-rail__mark {
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  width: 10px; height: 10px; border-radius: 50%; background: #fb923c;
}
@media (max-width: 900px) {
  .delivery-book-stage { --delivery-inset: 16px; }
  .delivery-book-stage__panes { grid-template-columns: 1fr; }
  .delivery-book-stage__left { max-height: 38%; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .delivery-book-stage__chrome { grid-template-columns: 1fr; }
  .delivery-book-stage__chrome-left, .delivery-book-stage__chrome-center, .delivery-book-stage__chrome-right { justify-content: center; }
  .delivery-book-stage__pane { padding: 20px 14px; }
  .pcm-cal__grid, .pcm-energy__bottom, .pcm__grid-12, .pcm-facts, .pcm-facts-extra, .pcm-pillars, .pcm-eq__grid {
    grid-template-columns: 1fr;
  }
  .pcm-calibration__top { grid-template-columns: 1fr; }
  .pcm-hero-strip { grid-template-rows: none; height: auto; }
}
`;

const CARD_JS = `
(function(){
  var panes = Array.prototype.slice.call(document.querySelectorAll("[data-slot-pane]"));
  var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-slot]"));
  var label = document.getElementById("dib-page-label");
  var prev = document.getElementById("dib-prev");
  var next = document.getElementById("dib-next");
  if (!panes.length) return;
  var ids = panes.map(function(p){ return p.getAttribute("data-slot-pane"); });
  function indexOf(id){
    var i = ids.indexOf(id);
    return i < 0 ? 0 : i;
  }
  function show(id){
    var idx = indexOf(id);
    id = ids[idx];
    panes.forEach(function(p){
      var on = p.getAttribute("data-slot-pane") === id;
      p.classList.toggle("is-active", on);
      p.hidden = !on;
    });
    buttons.forEach(function(b){
      var on = b.getAttribute("data-slot") === id;
      b.classList.toggle("is-active", on);
      b.classList.toggle("delivery-book-stage__toc-item--active", on);
      b.classList.toggle("delivery-book-stage__toc-item--ready", !on);
    });
    if (label) label.textContent = (idx + 1) + " / " + ids.length;
    if (prev) prev.disabled = idx <= 0;
    if (next) next.disabled = idx >= ids.length - 1;
    try {
      if (history.replaceState) history.replaceState(null, "", "#" + encodeURIComponent(id));
    } catch (e) {}
    var active = panes[idx];
    if (active) active.scrollTop = 0;
  }
  buttons.forEach(function(b){
    b.addEventListener("click", function(){
      var id = b.getAttribute("data-slot");
      if (id) show(id);
    });
  });
  if (prev) prev.addEventListener("click", function(){
    var cur = panes.findIndex(function(p){ return p.classList.contains("is-active"); });
    if (cur > 0) show(ids[cur - 1]);
  });
  if (next) next.addEventListener("click", function(){
    var cur = panes.findIndex(function(p){ return p.classList.contains("is-active"); });
    if (cur >= 0 && cur < ids.length - 1) show(ids[cur + 1]);
  });
  var hash = (location.hash || "").replace(/^#/, "");
  var start = hash ? decodeURIComponent(hash) : ids[0];
  if (ids.indexOf(start) < 0) start = ids[0];
  show(start);
})();
`;

function renderCalibrationPage(
  payload: PojuMatrixPayload,
  locale: string,
): string {
  const display = resolveMatrixDisplay(payload, locale);
  const zh = normalizeMatrixLocale(locale) === "zh";
  const profile = payload.user_profile;
  const tst = profile.tst_meta ?? profile.birth.tst_meta;
  const zodiacName = zh ? display.zodiac.han : display.zodiac.en;
  const emoji = ZODIAC_EMOJI[display.zodiac.han] ?? "";
  const gLabel = genderLabel(payload, locale);

  const solarAdj =
    tst && tst.diff_minutes !== 0
      ? `${tst.diff_minutes > 0 ? "+" : "−"}${Math.abs(Number(tst.diff_minutes.toFixed(1)))}m`
      : tst
        ? "0m"
        : "—";

  const termName = zh ? display.solar_term.name : display.solar_term.name_en;

  const hp = profile.birth.hour_period;
  const hpInfo = hp ? HOUR_PERIOD_INFO[hp] : null;
  const hpLabel = hpInfo ? (zh ? hpInfo.chinese_name : hpInfo.en_label) : "";

  const calDetails = `
  <div class="pcm-card pcm-cal">
    <div class="pcm-label pcm-label--gold">${escapeHtml(tc(locale, "details_summary"))}</div>
    <div class="pcm-cal__grid">
      <div class="pcm-cal__cell">
        <div class="pcm-cal__kicker">${escapeHtml(tc(locale, "calendar_alignment"))} · ${escapeHtml(tc(locale, "calendar_alignment_em"))}</div>
        <div class="pcm-cal__body">
          <div class="pcm-cal__value">${escapeHtml(display.calendar.gregorian)} <span class="pcm-cal__unit">${escapeHtml(tc(locale, "gregorian"))}</span></div>
          ${display.calendar.lunar ? `<div class="pcm-cal__sub">${escapeHtml(display.calendar.lunar)}</div>` : ""}
        </div>
        <div class="pcm-cal__foot">
          <div class="pcm-cal__accent">${escapeHtml(display.calendar.headline)}${gLabel ? ` ${escapeHtml(gLabel)}` : ""}</div>
        </div>
      </div>
      <div class="pcm-cal__cell">
        <div class="pcm-cal__kicker">${escapeHtml(tc(locale, "true_solar_time"))} · ${escapeHtml(tc(locale, "true_solar_time_em"))}</div>
        <div class="pcm-cal__body">
          ${
            tst
              ? `<div class="pcm-cal__times">
            <div>
              <div class="pcm-cal__time-val">${escapeHtml(tst.original_time)}</div>
              <div class="pcm-cal__time-label">${escapeHtml(tc(locale, "standard_time"))}</div>
            </div>
            <div class="pcm-cal__arrow">→</div>
            <div>
              <div class="pcm-cal__time-val pcm-cal__time-val--dim">${escapeHtml(tst.true_solar_time)}</div>
              <div class="pcm-cal__time-label">${escapeHtml(tc(locale, "true_solar"))}</div>
            </div>
          </div>
          ${
            tst.diff_minutes !== 0
              ? `<div class="pcm-cal__delta">${tst.diff_minutes > 0 ? "+" : "−"}${Math.abs(Number(tst.diff_minutes.toFixed(2)))}m</div>`
              : ""
          }
          <div class="pcm-cal__note">${escapeHtml(tc(locale, "longitude_correction"))} · ${escapeHtml(String(tst.longitude_diff_minutes ?? tst.diff_minutes))}m${
                tst.eq_of_time_minutes != null
                  ? ` · ${escapeHtml(tc(locale, "eq_of_time"))} ${tst.eq_of_time_minutes > 0 ? "+" : ""}${tst.eq_of_time_minutes}m`
                  : ""
              }${
                tst.longitude != null
                  ? ` · ${Math.abs(tst.longitude).toFixed(2)}°${tst.longitude >= 0 ? "E" : "W"}`
                  : ""
              }</div>`
              : `<div class="pcm-cal__value">—</div>`
          }
        </div>
        <div class="pcm-cal__foot">
          ${hpLabel ? `<div class="pcm-cal__accent">${escapeHtml(tc(locale, "birth_hour_period"))} · ${escapeHtml(hpLabel)}</div>` : ""}
        </div>
      </div>
      <div class="pcm-cal__cell">
        <div class="pcm-cal__kicker">${escapeHtml(tc(locale, "solar_term"))} · ${escapeHtml(tc(locale, "solar_term_em"))}</div>
        <div class="pcm-cal__body">
          <div class="pcm-cal__value">${escapeHtml(zh ? display.solar_term.name : display.solar_term.name_en)} <span class="pcm-cal__unit">${escapeHtml(zh ? display.solar_term.name_en : display.solar_term.name)}</span></div>
          <div class="pcm-cal__sub">${escapeHtml(display.solar_term.season)}</div>
          <div class="pcm-term__head">
            <span>${escapeHtml(tc(locale, "solar_term"))}</span>
            <span>${escapeHtml(tc(locale, "next_term"))}: ${escapeHtml(display.solar_term.next_name)}</span>
          </div>
        </div>
        <div class="pcm-cal__foot">
          <div class="pcm-term__track"><div class="pcm-term__fill" style="--pcm-term-pct:${display.solar_term.progress_pct}%"></div></div>
        </div>
      </div>
    </div>
  </div>`;

  return `
<section class="pcm__section pcm-calibration">
  <div class="pcm-calibration__top" aria-label="${escapeHtml(tMatrix(locale, "blocks.block_1"))}">
    <div class="pcm-zodiac">
      <div class="pcm-zodiac__art" aria-hidden="true">
        ${emoji ? `<span class="pcm-zodiac__emoji">${emoji}</span>` : `<span class="pcm-zodiac__glyph">${escapeHtml(display.zodiac.han)}</span>`}
      </div>
      <div class="pcm-zodiac__name">${escapeHtml(zodiacName)}</div>
      <div class="pcm-zodiac__pinyin">${escapeHtml(display.zodiac.pinyin)}</div>
      <div class="pcm-zodiac__year">${profile.birth.year}${zh ? "年" : ""}</div>
      <p class="pcm-zodiac__caption">${escapeHtml(tc(locale, "your_sign_tag"))}</p>
    </div>
    <div class="pcm-hero-strip">
      <div class="pcm-hero-strip__item">
        <div class="pcm-hero-strip__value">${escapeHtml(display.calendar.gregorian)}${display.calendar.lunar ? `<span class="pcm-cal__unit"> · ${escapeHtml(display.calendar.lunar)}</span>` : ""}</div>
        <div class="pcm-hero-strip__label">${escapeHtml(tc(locale, "hero_calendar"))}</div>
      </div>
      <div class="pcm-hero-strip__item">
        <div class="pcm-hero-strip__value">${escapeHtml(solarAdj)}</div>
        <div class="pcm-hero-strip__label">${escapeHtml(tc(locale, "hero_solar"))}</div>
      </div>
      <div class="pcm-hero-strip__item">
        <div class="pcm-hero-strip__value">${escapeHtml(termName)}<span class="pcm-cal__unit"> ${display.solar_term.progress_pct}%</span></div>
        <div class="pcm-hero-strip__label">${escapeHtml(tc(locale, "hero_term"))}</div>
      </div>
    </div>
  </div>
  ${calDetails}
</section>`;
}

function renderEnergyPage(payload: PojuMatrixPayload, locale: string): string {
  const display = resolveMatrixDisplay(payload, locale);
  const scores = payload.wuxing_scores;
  const maxCount = Math.max(...scores.map((s) => s.count), 1);
  const sorted = [...scores].sort((a, b) => b.pct - a.pct);
  const dominant = sorted[0];
  const deficit = sorted[sorted.length - 1];
  const yongshenChips = yongshenChipsForLocale(
    payload.structured.bazi_enrichment?.yongshen_analysis,
    locale,
  );

  const bars = scores
    .map((row) => {
      const pct = Math.round((row.count / maxCount) * 100);
      return `<div class="pcm-bar">
  <div class="pcm-bar__meta">
    <span class="pcm-bar__name">${escapeHtml(matrixElementSoft(row.element, locale) || row.element)}</span>
    <span class="pcm-bar__value">${row.count}</span>
  </div>
  <div class="pcm-bar__track"><div class="pcm-bar__fill ${barFillClass(row.element)}" style="--pcm-bar-pct:${pct}%"></div></div>
</div>`;
    })
    .join("\n");

  return `
<section class="pcm__section pcm-energy">
  <div class="pcm-card pcm-radar pcm-energy__radar">
    <div class="pcm-label pcm-label--cyan">${escapeHtml(tc(locale, "radar_matrix"))} · ${escapeHtml(tc(locale, "radar_matrix_em"))}</div>
    <div class="pcm-radar__chart">${radarSvgHtml(scores)}</div>
  </div>
  <div class="pcm-energy__bottom">
    <div class="pcm-card pcm-bars pcm-energy__bars">
      <div class="pcm-label pcm-label--cyan-soft">${escapeHtml(tc(locale, "elemental_signature"))} · ${escapeHtml(tc(locale, "elemental_signature_em"))}</div>
      <div class="pcm-bars__list">${bars}</div>
      ${
        yongshenChips.length
          ? `<div class="pcm-bars__footer"><div class="pcm-chips"><span class="pcm-chip pcm-chip--caps pcm-chip--neutral">${escapeHtml(tc(locale, "fact_anchor"))} · ${escapeHtml(yongshenChips.map((c) => c.label).join(" · "))}</span></div></div>`
          : ""
      }
      <p class="pcm-cal__note">${escapeHtml(tc(locale, "day_master"))} ${escapeHtml(matrixElementSoft(display.day_master.element, locale))}${dominant ? ` · ${escapeHtml(matrixElementSoft(dominant.element, locale))}` : ""}${deficit ? ` / ${escapeHtml(matrixElementSoft(deficit.element, locale))}` : ""}</p>
    </div>
    <div class="pcm-energy__rest">
      <div class="pcm-card pcm-vitality">
        <div class="pcm-label pcm-label--coral">${escapeHtml(tc(locale, "core_vitality"))}</div>
        <h3 class="pcm-vitality__title">${escapeHtml(tc(locale, "core_vitality"))}: ${escapeHtml(strengthLabel(payload.strength, locale))}</h3>
        <div class="pcm-vtrack"><div class="pcm-vtrack__pin" style="left:${vitalityPin(payload.strength)}"></div></div>
        <div class="pcm-vtrack__labels">
          <span>${escapeHtml(tc(locale, "vitality_receptive"))}</span>
          <span>${escapeHtml(tc(locale, "vitality_balance"))}</span>
          <span>${escapeHtml(tc(locale, "vitality_dominant"))}</span>
        </div>
      </div>
      <div class="pcm-card pcm-eq">
        <div class="pcm-label pcm-label--sand">${escapeHtml(tc(locale, "elemental_equilibrium"))}</div>
        <div class="pcm-eq__grid">
          ${
            dominant
              ? `<div class="pcm-eq__card">
            <div class="pcm-eq__title">${escapeHtml(matrixElementSoft(dominant.element, locale))} ${escapeHtml(tc(locale, "surplus"))} <span class="pcm-eq__pct">${dominant.pct}%</span></div>
            <div class="pcm-bar__track pcm-eq__bar"><div class="pcm-bar__fill ${barFillClass(dominant.element)}" style="--pcm-bar-pct:${Math.min(100, Math.max(0, dominant.pct))}%"></div></div>
            <div class="pcm-eq__hint pcm-eq__hint--up">▲ ${escapeHtml(tc(locale, "dominant_vector"))}</div>
          </div>`
              : ""
          }
          ${
            deficit
              ? `<div class="pcm-eq__card">
            <div class="pcm-eq__title">${escapeHtml(matrixElementSoft(deficit.element, locale))} ${escapeHtml(tc(locale, "deficit"))} <span class="pcm-eq__pct">${deficit.pct}%</span></div>
            <div class="pcm-bar__track pcm-eq__bar"><div class="pcm-bar__fill ${barFillClass(deficit.element)}" style="--pcm-bar-pct:${Math.min(100, Math.max(0, deficit.pct))}%"></div></div>
            <div class="pcm-eq__hint pcm-eq__hint--down">▼ ${escapeHtml(tc(locale, "key_gap"))}</div>
          </div>`
              : ""
          }
        </div>
      </div>
    </div>
  </div>
</section>`;
}

function renderTrajectoryPage(payload: PojuMatrixPayload, locale: string): string {
  const display = resolveMatrixDisplay(payload, locale);
  const zh = normalizeMatrixLocale(locale) === "zh";
  const fp = display.fact_panel;
  const emptyLinks = tc(locale, "fact_empty_links");
  const lifeSegment = activePillarByAge(display.current_age);
  const layerKeys = ["year", "month", "day", "hour"] as const;
  const layerIdx = layerKeys.indexOf(lifeSegment);
  const activePl = display.pillars[layerIdx >= 0 ? layerIdx : 0];
  const year = new Date().getFullYear();
  const transitProgress = computeYearTransitProgress();

  const daYun = payload.structured.da_yun ?? [];
  const timelineRows = daYun.slice(0, 8).map((entry, i) => {
    const next = daYun[i + 1];
    const end = next ? next.start_age - 1 : entry.start_age + 9;
    const range = `${entry.start_age}–${end}`;
    const isNow = i === display.current_dayun_index;
    const stemEl = getStemInfo(entry.ganzhi.charAt(0))?.element;
    const elSoft = stemEl ? matrixElementSoft(stemEl, locale) : "";
    if (isNow) {
      const here = zh
        ? `${display.current_age}岁 · ${year}年 · ${tc(locale, "dayun_you_are_here")}`
        : `Age ${display.current_age} · ${year} · ${tc(locale, "dayun_you_are_here")}`;
      return `<div class="pcm-timeline-row pcm-timeline-row--now">
  <div class="pcm-timeline-row__range">${escapeHtml(range)}${entry.start_year ? ` · ${entry.start_year}` : ""}</div>
  <div class="pcm-timeline-row__meta"><span>${escapeHtml(here)}</span>${elSoft ? `<span class="pcm-timeline-row__el">${escapeHtml(elSoft)}</span>` : ""}</div>
</div>`;
    }
    return `<div class="pcm-timeline-row">
  <div class="pcm-timeline-row__range">${escapeHtml(range)}${entry.start_year ? ` · ${entry.start_year}` : ""}</div>
  ${elSoft ? `<div class="pcm-timeline-row__meta"><span></span><span class="pcm-timeline-row__el">${escapeHtml(elSoft)}</span></div>` : ""}
</div>`;
  }).join("\n");

  const LAYER_BANDS: Array<{ key: (typeof layerKeys)[number]; band: string; progress: (a: number) => number }> = [
    { key: "year", band: "0–16", progress: (a) => Math.min(100, (a / 16) * 100) },
    { key: "month", band: "17–32", progress: (a) => Math.min(100, Math.max(0, ((a - 16) / 16) * 100)) },
    { key: "day", band: "33–48", progress: (a) => Math.min(100, Math.max(0, ((a - 32) / 16) * 100)) },
    { key: "hour", band: "49+", progress: (a) => Math.min(100, Math.max(0, ((a - 48) / 16) * 100)) },
  ];

  const layerStack = LAYER_BANDS.map((band) => {
    const active = band.key === lifeSegment;
    const pct = Math.round(band.progress(display.current_age));
    const label = tc(locale, `pillar_${band.key}`);
    return `<div class="pcm-layer-row${active ? " is-active" : ""}">
  <span>${escapeHtml(label)}</span>
  <div class="pcm-layer-row__track"><div class="pcm-layer-row__fill" style="width:${active ? pct : 0}%"></div></div>
  <span>${escapeHtml(band.band)}</span>
</div>`;
  }).join("\n");

  const roleSoft = activePl
    ? lifeSegment === "day"
      ? tc(locale, "day_master")
      : zh
        ? activePl.ten_god
        : activePl.ten_god_en
    : "";

  const bondChips =
    fp.structure.bonds.length > 0
      ? fp.structure.bonds.map((c) => chipHtml(c.soft, "cyan")).join("")
      : chipHtml(emptyLinks, "neutral");
  const tensionChips =
    fp.structure.tensions.length > 0
      ? fp.structure.tensions.map((c) => chipHtml(c.soft, "coral")).join("")
      : chipHtml(emptyLinks, "neutral");

  const pulseLinks =
    fp.year_pulse.links.length > 0
      ? fp.year_pulse.links
          .map((c) =>
            chipHtml(
              c.soft,
              c.polarity === "green" ? "cyan" : c.polarity === "red" ? "coral" : "gold",
            ),
          )
          .join("")
      : !fp.year_sign.zodiac_soft
        ? chipHtml(emptyLinks, "neutral")
        : "";

  const balanceChips = [
    ...fp.balance.xi.map((c) => chipHtml(c.soft, "cyan")),
    ...fp.balance.ji.map((c) => chipHtml(c.soft, "coral")),
  ].join("");

  return `
<section class="pcm__section">
  <div class="pcm__grid-12">
    <div class="pcm-card pcm-timeline">
      <div class="pcm-label pcm-label--gold">${escapeHtml(tc(locale, "macro_lifecycle"))} · ${escapeHtml(tc(locale, "macro_lifecycle_em"))}</div>
      <h3 class="pcm-type-lg" style="margin:0 0 1rem">${escapeHtml(tc(locale, "timeline_matrix"))}</h3>
      <div class="pcm-timeline__list">${timelineRows || `<p class="pcm-type-body">—</p>`}</div>
    </div>
    <div class="pcm-facts">
      <div class="pcm-card">
        <div class="pcm-label pcm-label--flush pcm-label--gold">${escapeHtml(tc(locale, "fact_era"))} · ${escapeHtml(tc(locale, "fact_era_em"))}</div>
        <div class="pcm-type-xl">${escapeHtml(tc(locale, `pillar_${lifeSegment}`))}</div>
        <div class="pcm-type-body" style="margin-top:0.35rem">${escapeHtml(tc(locale, "fact_layer_age", { age: String(display.current_age) }))}</div>
        <div class="pcm-chips" style="margin-top:1rem">
          ${activePl?.stem_element ? chipHtml(matrixElementSoft(activePl.stem_element, locale), "gold") : ""}
          ${roleSoft ? chipHtml(roleSoft, "cyan") : ""}
        </div>
        <div class="pcm-layer-stack">${layerStack}</div>
      </div>
      <div class="pcm-card">
        <div class="pcm-label pcm-label--flush pcm-label--cyan">${escapeHtml(tc(locale, "fact_year_pulse"))} · ${fp.year_pulse.year}</div>
        <div class="pcm-type-lg" style="margin-bottom:0.5rem">${escapeHtml(fp.year_pulse.stem_element_soft)} <span class="pcm-type-body">${escapeHtml(tc(locale, "fact_year_pulse_em"))}</span></div>
        <div class="pcm-chips" style="margin-bottom:0.5rem">
          ${fp.year_sign.zodiac_soft ? chipHtml(fp.year_sign.zodiac_soft, "gold") : ""}
          ${fp.year_sign.branch_element_soft ? chipHtml(fp.year_sign.branch_element_soft, "cyan") : ""}
          ${pulseLinks}
        </div>
        <div class="pcm-type-body" style="margin-bottom:0.35rem">${escapeHtml(
          tc(locale, "fact_year_pulse_hint", {
            bonds: String(fp.year_pulse.links.filter((c) => c.polarity === "green").length),
            tensions: String(fp.year_pulse.links.filter((c) => c.polarity === "red").length),
          }),
        )}</div>
        <div class="pcm-type-body">${escapeHtml(tc(locale, "transit_progress"))} · ${transitProgress}%</div>
        <div class="pcm-year-ring"><div class="pcm-year-ring__fill" style="width:${transitProgress}%"></div></div>
      </div>
      <div class="pcm-card">
        <div class="pcm-label pcm-label--flush pcm-label--sand">${escapeHtml(tc(locale, "fact_structure"))} · ${escapeHtml(tc(locale, "fact_structure_em"))}</div>
        <div style="display:flex;flex-direction:column;gap:0.85rem">
          <div>
            <div class="pcm-type-body" style="margin-bottom:0.4rem">${escapeHtml(tc(locale, "fact_bonds"))}</div>
            <div class="pcm-chips">${bondChips}</div>
          </div>
          <div>
            <div class="pcm-type-body" style="margin-bottom:0.4rem">${escapeHtml(tc(locale, "fact_tensions"))}</div>
            <div class="pcm-chips">${tensionChips}</div>
          </div>
        </div>
      </div>
      <div class="pcm-card">
        <div class="pcm-label pcm-label--flush pcm-label--coral">${escapeHtml(tc(locale, "fact_balance"))} · ${escapeHtml(tc(locale, "fact_balance_em"))}</div>
        <div class="pcm-type-lg" style="margin-bottom:0.75rem">${escapeHtml(fp.balance.strength_soft)}${
          fp.balance.yong_soft
            ? `<span class="pcm-type-body" style="margin-left:0.5rem">${escapeHtml(tc(locale, "fact_anchor"))} ${escapeHtml(fp.balance.yong_soft)}</span>`
            : ""
        }</div>
        <div class="pcm-chips">${balanceChips || chipHtml(emptyLinks, "neutral")}</div>
        ${
          fp.balance.status_soft
            ? `<div class="pcm-type-body" style="margin-top:0.65rem">${escapeHtml(tc(locale, "fact_balance_status"))} · ${escapeHtml(fp.balance.status_soft)}</div>`
            : ""
        }
      </div>
    </div>
  </div>
</section>`;
}

function renderMarkersPage(payload: PojuMatrixPayload, locale: string): string {
  const display = resolveMatrixDisplay(payload, locale);
  const fp = display.fact_panel;
  const emptyLinks = tc(locale, "fact_empty_links");

  const eraChips = [
    fp.era.stem_element_soft ? chipHtml(fp.era.stem_element_soft, "gold") : "",
    fp.era.ten_god_soft ? chipHtml(fp.era.ten_god_soft, "cyan") : "",
  ]
    .filter(Boolean)
    .join("") || chipHtml(emptyLinks, "neutral");

  const yearSignLinks =
    fp.year_sign.links.length > 0
      ? fp.year_sign.links
          .map((c) =>
            chipHtml(
              c.soft,
              c.polarity === "green" ? "cyan" : c.polarity === "red" ? "coral" : "gold",
            ),
          )
          .join("")
      : chipHtml(emptyLinks, "neutral");

  const shensha =
    fp.shensha_highlights.length > 0
      ? `<div class="pcm-chips">${fp.shensha_highlights.map((s) => chipHtml(s.label, "gold")).join("")}</div>`
      : chipHtml(emptyLinks, "neutral");

  const onsetAge =
    fp.luck_onset.start_age != null
      ? tc(locale, "fact_onset_age", { age: String(fp.luck_onset.start_age) })
      : emptyLinks;
  const onsetYear =
    fp.luck_onset.start_year != null
      ? tc(locale, "fact_onset_year", { year: String(fp.luck_onset.start_year) })
      : fp.luck_onset.raw_onset || fp.luck_onset.start_date || "—";

  let onsetPct = 0;
  if (fp.luck_onset.start_age != null && display.current_age > 0) {
    onsetPct = Math.min(
      100,
      Math.max(0, Math.round((fp.luck_onset.start_age / Math.max(display.current_age, 1)) * 100)),
    );
  }

  return `
<section class="pcm__section">
  <div class="pcm-label pcm-label--gold">${escapeHtml(tc(locale, "fact_extra_title"))} · ${escapeHtml(tc(locale, "fact_extra_em"))}</div>
  <div class="pcm-facts-extra">
    <div class="pcm-card">
      <div class="pcm-label pcm-label--flush pcm-label--gold">${escapeHtml(tc(locale, "fact_dayun"))} · ${escapeHtml(tc(locale, "fact_dayun_em"))}</div>
      <div class="pcm-type-xl" style="color:var(--pcm-primary,#f2ca50)">${escapeHtml(fp.era.age_range)}</div>
      <div class="pcm-type-body" style="margin-top:0.35rem">${fp.era.start_year} · ${escapeHtml(fp.era.theme)}</div>
      <div class="pcm-chips" style="margin-top:0.85rem">${eraChips}</div>
      <div class="pcm-year-ring" style="margin-top:12px"><div class="pcm-year-ring__fill" style="width:${Math.min(100, Math.max(0, fp.era.progress_pct))}%;background:linear-gradient(90deg,#d4af37,#fde047)"></div></div>
    </div>
    <div class="pcm-card">
      <div class="pcm-label pcm-label--flush pcm-label--cyan">${escapeHtml(tc(locale, "fact_year_sign"))} · ${escapeHtml(tc(locale, "fact_year_sign_em"))}</div>
      <div class="pcm-type-xl">${escapeHtml(fp.year_sign.zodiac_soft || "—")}</div>
      <div class="pcm-type-body" style="margin-top:0.35rem">${fp.year_sign.year}${fp.year_sign.branch_element_soft ? ` · ${escapeHtml(fp.year_sign.branch_element_soft)}` : ""}</div>
      <div class="pcm-chips" style="margin-top:0.85rem">${yearSignLinks}</div>
    </div>
    <div class="pcm-card">
      <div class="pcm-label pcm-label--flush pcm-label--sand">${escapeHtml(tc(locale, "fact_shensha"))} · ${escapeHtml(tc(locale, "fact_shensha_em"))}</div>
      <div class="pcm-type-lg" style="margin-bottom:0.5rem">${escapeHtml(tc(locale, "fact_shensha_count", { count: String(fp.shensha_highlights.length) }))}</div>
      ${shensha}
    </div>
    <div class="pcm-card">
      <div class="pcm-label pcm-label--flush pcm-label--coral">${escapeHtml(tc(locale, "fact_onset"))} · ${escapeHtml(tc(locale, "fact_onset_em"))}</div>
      <div class="pcm-type-xl">${escapeHtml(onsetAge)}</div>
      <div class="pcm-type-body" style="margin-top:0.35rem">${escapeHtml(onsetYear)}</div>
      ${fp.luck_onset.start_date ? `<div class="pcm-type-body" style="margin-top:0.25rem;font-size:0.75rem">${escapeHtml(fp.luck_onset.start_date)}</div>` : ""}
      <div class="pcm-onset-rail"><div class="pcm-onset-rail__mark" style="left:${onsetPct}%"></div></div>
    </div>
  </div>
</section>`;
}

function renderCorePage(payload: PojuMatrixPayload, locale: string): string {
  const display = resolveMatrixDisplay(payload, locale);
  const zh = normalizeMatrixLocale(locale) === "zh";
  const shenshaLocale = normalizeShenshaLocale(locale);
  const lifeSegment = activePillarByAge(display.current_age);
  const keys = ["year", "month", "day", "hour"] as const;

  const pillars = display.pillars
    .map((pl, idx) => {
      const key = keys[idx] ?? "year";
      const isDay = key === "day";
      const isLifeSegment = lifeSegment === key;
      const roleSoft = isDay
        ? tc(locale, "day_master")
        : zh
          ? pl.ten_god
          : pl.ten_god_en;
      const stageHan = pl.life_stage_han?.trim() || null;
      const stageSoft =
        pl.life_stage_label ||
        (stageHan ? matrixSoftTerm(stageHan, locale) : "");
      const stars = resolveShenshaList(pl.star_labels, shenshaLocale);
      return `<div class="pcm-card pcm-pl pcm-pl--${key}${isLifeSegment ? " pcm-card--glow" : ""}">
  <div class="pcm-pl__slot">${escapeHtml(tc(locale, `pillar_${key}`))}</div>
  <div class="pcm-pl__role">${escapeHtml(roleSoft || "—")}</div>
  <div class="pcm-pl__stem ${elementCssClass(pl.stem_element)}">${escapeHtml(pl.stem_element ? matrixElementSoft(pl.stem_element, locale) : "—")}</div>
  ${stageSoft ? `<div class="pcm-pl__branch">${escapeHtml(stageSoft)}</div>` : ""}
  <div class="pcm-pl__hidden">${escapeHtml(pl.hidden_display)}</div>
  ${
    stars.length
      ? `<ul class="pcm-pl__list">${stars.map((s) => `<li>${escapeHtml(s.label)}</li>`).join("")}</ul>`
      : ""
  }
</div>`;
    })
    .join("\n");

  return `
<section class="pcm__section">
  <div class="pcm-label pcm-label--white">${escapeHtml(tc(locale, "layers_title"))} · ${escapeHtml(tc(locale, "layers_em"))}</div>
  <div class="pcm-pillars">${pillars}</div>
</section>`;
}

/** B1–B5 page body HTML (no chrome). Used by fill-baseline + offline export. */
export function renderBaselinePageBody(
  blockId: (typeof BASELINE_EXPORT_BLOCKS)[number]["id"],
  payload: PojuMatrixPayload,
  locale: string,
): string {
  switch (blockId) {
    case "calibration":
      return renderCalibrationPage(payload, locale);
    case "energy":
      return renderEnergyPage(payload, locale);
    case "trajectory":
      return renderTrajectoryPage(payload, locale);
    case "markers":
      return renderMarkersPage(payload, locale);
    case "core":
      return renderCorePage(payload, locale);
    default:
      return "";
  }
}

/**
 * Offline HTML = delivery-book card shell + five baseline matrix pages (B1–B5).
 * Delegates to blank-template fill (HTML-first deliverables).
 */
export function buildBaselineInteractiveHtml(
  payload: PojuMatrixPayload,
  locale: string,
  opts?: BuildBaselineInteractiveHtmlOptions,
): string {
  // Lazy require avoids circular init with fill-baseline → this module.
  const { fillBaselineProfileHtml } = require("@/lib/deliverables/fill-baseline") as typeof import("@/lib/deliverables/fill-baseline");
  return fillBaselineProfileHtml(payload, locale, opts);
}

/** Plain-text email body companion (synopsis), for mail APIs that need text. */
export function buildBaselineExportPlainText(
  payload: PojuMatrixPayload,
  locale: string,
): string {
  const display = resolveMatrixDisplay(payload, locale);
  return getMatrixSynopsisPlainText(display, locale);
}
