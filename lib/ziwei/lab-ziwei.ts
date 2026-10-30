/**
 * Lab / session · resolve BirthInfo → ZiweiFactPack (stable chart only).
 * Sanitize strips birth from base_analysis; birth lives on LabSource.birth_info.
 */

import type { DeliveryLabSession, LabSource } from "@/lib/llm/pro/delivery/lab/types";
import type { BirthInfo, HourPeriod, TstMeta } from "@/lib/profile/types";
import { HOUR_PERIOD_INFO } from "@/lib/profile/types";
import { hourToHourPeriod } from "@/lib/profile/birth-info-utils";
import {
  buildZiweiDisplayFactPack,
  displayAtomLabel,
  joinDisplayLabels,
} from "@/lib/ziwei/display-fact-pack";
import {
  buildZiweiFactPack,
  type ZiweiFactPack,
} from "@/lib/ziwei/fact-pack";

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
  const tst = coerceTstMeta(raw.tst_meta);
  if (tst) birth.tst_meta = tst;
  return birth;
}

function coerceTstMeta(raw: unknown): TstMeta | null {
  if (!isRecord(raw)) return null;
  const original_date = typeof raw.original_date === "string" ? raw.original_date.trim() : "";
  const original_time = typeof raw.original_time === "string" ? raw.original_time.trim() : "";
  const true_solar_date =
    typeof raw.true_solar_date === "string" ? raw.true_solar_date.trim() : "";
  const true_solar_time =
    typeof raw.true_solar_time === "string" ? raw.true_solar_time.trim() : "";
  const timezone = typeof raw.timezone === "string" ? raw.timezone.trim() : "";
  const diff_minutes = Number(raw.diff_minutes);
  const longitude = Number(raw.longitude);
  const ver = raw.computation_version;
  if (
    !original_date ||
    !original_time ||
    !true_solar_date ||
    !true_solar_time ||
    !timezone ||
    Number.isNaN(diff_minutes) ||
    Number.isNaN(longitude) ||
    (ver !== "v1" && ver !== "v2_with_tst")
  ) {
    return null;
  }
  const out: TstMeta = {
    original_date,
    original_time,
    true_solar_date,
    true_solar_time,
    diff_minutes,
    longitude,
    timezone,
    computation_version: ver,
  };
  if (typeof raw.longitude_diff_minutes === "number") {
    out.longitude_diff_minutes = raw.longitude_diff_minutes;
  }
  if (typeof raw.eq_of_time_minutes === "number") {
    out.eq_of_time_minutes = raw.eq_of_time_minutes;
  }
  return out;
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

/** Closed-set lines for Call A / thesis / agenda (no prescriptions; soft labels only). */
export function formatZiweiClosedSetForPrompt(
  pack: ZiweiFactPack | null | undefined,
  locale: string = "zh",
): string {
  if (!pack) return "";
  const d = buildZiweiDisplayFactPack(pack, locale);
  const lines: string[] = [];
  const palace = displayAtomLabel(d.topicPalace.palace);
  if (palace) {
    const stars = joinDisplayLabels(d.topicPalace.majorStars);
    lines.push(
      `${palace}${d.topicPalace.earthlyBranch ? `(${d.topicPalace.earthlyBranch})` : ""}${stars ? ` · ${stars}` : ""}`,
    );
  }
  const core = displayAtomLabel(d.mingShen.coreDriverLabel);
  const action = displayAtomLabel(d.mingShen.actionDriverLabel);
  if (core || action) {
    const soul = displayAtomLabel(d.mingShen.soul) || "—";
    const body = displayAtomLabel(d.mingShen.body) || "—";
    lines.push(`${[core, action].filter(Boolean).join("/")}: ${soul} / ${body}`);
  }
  const longCycle = displayAtomLabel(d.daxian.label);
  if (longCycle) {
    const yearly = displayAtomLabel(d.daxian.liunian.label);
    const daxianPalace = displayAtomLabel(d.daxian.palace) || "—";
    lines.push(
      `${longCycle}: ${daxianPalace} ${d.daxian.startAge}–${d.daxian.endAge}` +
        (yearly
          ? ` · ${yearly}${d.daxian.liunian.year}${d.daxian.liunian.heavenlyStem}${d.daxian.liunian.earthlyBranch}`
          : ""),
    );
  }
  if (d.patternHitCount > 0) {
    lines.push(`结构格局命中数: ${d.patternHitCount}（名称内部保留，不进入用户可见层）`);
  }
  if (!lines.length) return "";
  return [
    "【紫微闭集事实 · 结构依据 · 自造术语 · 禁处方/解读长文】",
    ...lines,
    "（仅用已映射软标签作 chart_basis 锚；禁止传统宫星原名与药方散文。）",
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

/** S5 light trigger anchors — soft cycle labels + year only (no traditional palace/pattern names). */
export function ziweiCompanionTriggerAnchors(
  pack: ZiweiFactPack | null | undefined,
  locale: string = "zh",
): string[] {
  if (!pack) return [];
  const d = buildZiweiDisplayFactPack(pack, locale);
  const out: string[] = [];
  const longCycle = displayAtomLabel(d.daxian.label);
  if (longCycle) {
    out.push(`${longCycle}·${d.daxian.startAge}-${d.daxian.endAge}`);
  }
  const yearly = displayAtomLabel(d.daxian.liunian.label);
  if (yearly) {
    out.push(`${yearly}·${d.daxian.liunian.year}`);
  }
  if (d.patternHitCount > 0) {
    out.push(`patternHits·${d.patternHitCount}`);
  }
  return out;
}
