/**
 * Fill baseline-profile blank template from PojuMatrixPayload (slots only).
 */

import {
  assertSkeletonUnchanged,
  fillDeliverableHtml,
} from "@/lib/deliverables/fill-html";
import { BASELINE_PROFILE_TEMPLATE } from "@/lib/deliverables/templates/baseline-profile";
import {
  BASELINE_EXPORT_BLOCKS,
  renderBaselinePageBody,
  type BuildBaselineInteractiveHtmlOptions,
} from "@/lib/poju/baseline-interactive-html";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { normalizeMatrixLocale, tMatrix } from "@/lib/poju/poju-matrix-i18n";

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
  return loc?.name || profile.birth?.timezone || tMatrix(locale, "card.default_timezone");
}

const BODY_SLOT_BY_ID: Record<
  (typeof BASELINE_EXPORT_BLOCKS)[number]["id"],
  string
> = {
  calibration: "SLOT_BODY_CALIBRATION",
  energy: "SLOT_BODY_ENERGY",
  trajectory: "SLOT_BODY_TRAJECTORY",
  markers: "SLOT_BODY_MARKERS",
  core: "SLOT_BODY_CORE",
};

function maybeAssertSkeleton(before: string, after: string): void {
  if (process.env.NODE_ENV === "production") return;
  try {
    assertSkeletonUnchanged(before, after);
  } catch (e) {
    console.warn("[fill-baseline] skeleton assert:", e);
  }
}

export function buildBaselineSlotMap(
  payload: PojuMatrixPayload,
  locale: string,
  opts?: BuildBaselineInteractiveHtmlOptions,
): Record<string, string> {
  const zh = normalizeMatrixLocale(locale) === "zh";
  const coverTitle = opts?.title?.trim() || tMatrix(locale, "main_title");
  const subtitle = opts?.subtitle?.trim() || tMatrix(locale, "main_description");
  const bornLine = formatBornLine(payload);
  const placeLine = opts?.profileLine?.trim() || formatPlaceLine(payload, locale);
  const subject = (opts?.subjectLabel || "").trim();

  const privacy = zh
    ? "本文件保存在你的设备上；打开无需登录。"
    : "This file stays on your device; no sign-in required.";
  const disclaimer = zh
    ? "内容供决策参考，不构成医疗、法律或投资建议。"
    : "For decision support only — not medical, legal, or investment advice.";
  const readingHint = zh
    ? "点目录切换章节（B1–B5）。"
    : "Use the TOC to switch pages (B1–B5).";

  const metaBorn = bornLine
    ? `${tMatrix(locale, "born")} ${bornLine}`
    : subject || "—";

  const slots: Record<string, string> = {
    SLOT_LANG: langAttr(locale),
    SLOT_TITLE: escapeHtml(coverTitle),
    SLOT_SUBTITLE: escapeHtml(subtitle),
    SLOT_META_BORN: escapeHtml(metaBorn),
    SLOT_META_PLACE: escapeHtml(placeLine || "—"),
    SLOT_META_LOCALE: escapeHtml(localeDisplay(locale)),
    SLOT_READING_HINT: escapeHtml(readingHint),
    SLOT_PRIVACY: escapeHtml(privacy),
    SLOT_DISCLAIMER: escapeHtml(disclaimer),
    SLOT_PAGE_LABEL: `1 / ${BASELINE_EXPORT_BLOCKS.length}`,
    SLOT_GLOSSARY_JSON: "[]",
  };

  BASELINE_EXPORT_BLOCKS.forEach((block, i) => {
    const tocKey = `SLOT_TOC_${i + 1}`;
    slots[tocKey] = escapeHtml(tMatrix(locale, `blocks.${block.labelKey}`));
    slots[BODY_SLOT_BY_ID[block.id]] = renderBaselinePageBody(
      block.id,
      payload,
      locale,
    );
  });

  return slots;
}

export function fillBaselineProfileHtml(
  payload: PojuMatrixPayload,
  locale: string,
  opts?: BuildBaselineInteractiveHtmlOptions,
): string {
  const slots = buildBaselineSlotMap(payload, locale, opts);
  const html = fillDeliverableHtml(BASELINE_PROFILE_TEMPLATE, slots);
  maybeAssertSkeleton(BASELINE_PROFILE_TEMPLATE, html);
  return html;
}
