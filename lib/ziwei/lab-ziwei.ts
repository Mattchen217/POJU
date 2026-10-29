/**
 * Lab / session · resolve BirthInfo → ZiweiFactPack (stable chart only).
 * Sanitize strips birth from base_analysis; birth lives on LabSource.birth_info.
 */

import type { DeliveryLabSession, LabSource } from "@/lib/llm/pro/delivery/lab/types";
import type { BirthInfo, HourPeriod } from "@/lib/profile/types";
import { HOUR_PERIOD_INFO } from "@/lib/profile/types";
import { hourToHourPeriod } from "@/lib/profile/birth-info-utils";
import {
  buildZiweiFactPack,
  type ZiweiFactPack,
} from "@/lib/ziwei/fact-pack";
import { formatPatternHitsSummary } from "@/lib/ziwei/doushu-adapter";

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function asHourPeriod(raw: unknown): HourPeriod | null {
  if (typeof raw !== "string") return null;
  return Object.prototype.hasOwnProperty.call(HOUR_PERIOD_INFO, raw)
    ? (raw as HourPeriod)
    : null;
}

/** Coerce a loose birth object (form / stored profile / API) into BirthInfo. */
export function coerceBirthInfo(raw: unknown): BirthInfo | null {
  if (!isRecord(raw)) return null;
  const year = Number(raw.year);
  const month = Number(raw.month);
  const day = Number(raw.day);
  if (!year || !month || !day) return null;
  const genderRaw = raw.gender;
  const gender =
    genderRaw === "M" || genderRaw === "male"
      ? "M"
      : genderRaw === "F" || genderRaw === "female"
        ? "F"
        : null;
  if (!gender) return null;
  const hour =
    typeof raw.hour === "number"
      ? raw.hour
      : typeof raw.hour === "string" && raw.hour.trim()
        ? Number(raw.hour)
        : undefined;
  const minute =
    typeof raw.minute === "number"
      ? raw.minute
      : typeof raw.minute === "string" && raw.minute.trim()
        ? Number(raw.minute)
        : undefined;
  const period =
    asHourPeriod(raw.hour_period) ??
    (typeof hour === "number" && !Number.isNaN(hour) ? hourToHourPeriod(hour) : null);
  if (!period) return null;
  const timezone =
    typeof raw.timezone === "string" && raw.timezone.trim()
      ? raw.timezone.trim()
      : "Asia/Shanghai";
  const birth: BirthInfo = {
    year,
    month,
    day,
    hour_period: period,
    gender,
    timezone,
  };
  if (typeof hour === "number" && !Number.isNaN(hour)) birth.hour = hour;
  if (typeof minute === "number" && !Number.isNaN(minute)) birth.minute = minute;
  if (isRecord(raw.birth_location)) {
    const loc = raw.birth_location;
    const name = typeof loc.name === "string" ? loc.name : "";
    const longitude = Number(loc.longitude);
    const locTz =
      typeof loc.timezone === "string" && loc.timezone.trim()
        ? loc.timezone.trim()
        : timezone;
    if (name && !Number.isNaN(longitude)) {
      birth.birth_location = {
        name,
        longitude,
        timezone: locTz,
        ...(typeof loc.latitude === "number" ? { latitude: loc.latitude } : {}),
        ...(loc.use_defaults === true ? { use_defaults: true } : {}),
      };
    }
  }
  if (isRecord(raw.tst_meta)) {
    birth.tst_meta = raw.tst_meta as BirthInfo["tst_meta"];
  }
  return birth;
}

/** Prefer explicit LabSource.birth_info; fall back to rare nested shapes. */
export function resolveLabBirthInfo(source: LabSource): BirthInfo | null {
  const direct = coerceBirthInfo(source.birth_info);
  if (direct) return direct;
  if (!isRecord(source.base_analysis)) return null;
  const ba = source.base_analysis;
  return (
    coerceBirthInfo(ba.birth_info) ??
    coerceBirthInfo(ba.birth) ??
    (isRecord(ba.user_profile) ? coerceBirthInfo(ba.user_profile.birth) : null)
  );
}

export function tryBuildLabZiweiFactPack(
  source: LabSource,
  opts?: { asOf?: string | Date },
): ZiweiFactPack | null {
  const birth = resolveLabBirthInfo(source);
  if (!birth) return null;
  try {
    return buildZiweiFactPack(birth, { asOf: opts?.asOf });
  } catch (e) {
    console.warn("[lab-ziwei] buildZiweiFactPack failed", {
      err: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

/** Ensure artifacts.ziwei_fact_pack when birth is stable; return pack or null. */
export function ensureLabZiweiFactPack(
  lab: DeliveryLabSession,
  opts?: { asOf?: string | Date },
): ZiweiFactPack | null {
  const existing = lab.artifacts.ziwei_fact_pack;
  if (existing && typeof existing === "object" && "topicPalace" in existing) {
    return existing as ZiweiFactPack;
  }
  const pack = tryBuildLabZiweiFactPack(lab.source, opts);
  if (pack) lab.artifacts.ziwei_fact_pack = pack;
  return pack;
}

/** Closed-set lines for Call A / thesis / agenda (no prescriptions). */
export function formatZiweiClosedSetForPrompt(pack: ZiweiFactPack | null | undefined): string {
  if (!pack) return "";
  const lines: string[] = [];
  const t = pack.topicPalace;
  if (t?.palace) {
    const stars = (t.majorStars ?? []).join("、");
    lines.push(
      `命宫锚：${t.palace}${t.earthlyBranch ? `(${t.earthlyBranch})` : ""}${stars ? ` · ${stars}` : ""}`,
    );
  }
  if (pack.mingShen?.soul || pack.mingShen?.body) {
    lines.push(`命主/身主：${pack.mingShen.soul ?? "—"} / ${pack.mingShen.body ?? "—"}`);
  }
  if (pack.daxian?.palace) {
    lines.push(
      `大限：${pack.daxian.palace} ${pack.daxian.startAge}–${pack.daxian.endAge}` +
        (pack.daxian.liunian
          ? ` · 流年${pack.daxian.liunian.year}${pack.daxian.liunian.heavenlyStem}${pack.daxian.liunian.earthlyBranch}@${pack.daxian.liunian.palace}`
          : ""),
    );
  }
  const hits = formatPatternHitsSummary(pack.patternHits ?? [], 8);
  if (hits) lines.push(`格局命中：${hits}`);
  if (!lines.length) return "";
  return [
    "【紫微闭集事实 · 结构依据 · 禁处方/解读长文】",
    ...lines,
    "（可用格局名/宫星作 chart_basis 锚；禁止据此开药方或灌散文。）",
  ].join("\n");
}

/** Build closed-set prompt block from BirthInfo (prod Call A/B). */
export function ziweiClosedSetFromBirth(
  birth: BirthInfo | null | undefined,
  opts?: { asOf?: string | Date },
): string {
  if (!birth) return "";
  try {
    return formatZiweiClosedSetForPrompt(buildZiweiFactPack(birth, { asOf: opts?.asOf }));
  } catch (e) {
    console.warn("[lab-ziwei] ziweiClosedSetFromBirth failed", {
      err: e instanceof Error ? e.message : String(e),
    });
    return "";
  }
}

/** S5 light trigger anchors — daxian/liunian or top pattern names only. */
export function ziweiCompanionTriggerAnchors(pack: ZiweiFactPack | null | undefined): string[] {
  if (!pack) return [];
  const out: string[] = [];
  if (pack.daxian?.palace) {
    out.push(`大限·${pack.daxian.palace}`);
  }
  if (pack.daxian?.liunian?.palace) {
    out.push(
      `流年·${pack.daxian.liunian.year}@${pack.daxian.liunian.palace}`,
    );
  }
  for (const hit of (pack.patternHits ?? []).slice(0, 3)) {
    out.push(`格局·${hit.name}`);
  }
  return out;
}
