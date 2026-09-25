/**
 * Delivery P4 · Qimen lock-pan Fact-pack (Step 1).
 *
 * Spec: `.cursor/docs/P4-东方谋略-规格锁.md`
 * - Cast once at first successful delivery pan → `qimen_cast_at`
 * - Persist on ChartPrimaryPreallocMap; later reads are idempotent (never recast)
 * - Fail hard after retries — no bazi-only half delivery
 *
 * Engine: `lib/qimen` (same as Syncro). Soft-translate stays in glossary SSOT; this
 * module only emits structure lines for assign cite / fill feed.
 */

import { Lunar } from "lunar-typescript";
import { QimenUtil } from "@/lib/qimen/QimenUtil";
import { QimenFormatUtil } from "@/lib/qimen/FormatUtil";
import type { QimenPan } from "@/lib/qimen/type";
import {
  EIGHT_DOORS_NATURE,
} from "@/lib/syncro/qimen-direction-map";
import {
  STEM_TO_WUXING,
  getWuXingRelation,
  type WuXing,
} from "@/lib/syncro/wuxing-utils";

export const DELIVERY_QIMEN_FACT_PACK_HEADER = "【奇门锁盘·交付起局】";

export type DeliveryQimenStance =
  | "attack"
  | "hold"
  | "hide"
  | "retreat"
  | "display";

export type DeliveryQimenFactPack = {
  /** ISO timestamp of first successful cast (lock key). */
  qimen_cast_at: string;
  ju_name: string;
  zhi_fu_star: string;
  zhi_fu_palace: string;
  zhi_shi_door: string;
  zhi_shi_palace: string;
  /** 主=值符遁干侧 · 客=时干 · 生克白话（结构句，非处方）. */
  host_guest: string;
  stance: DeliveryQimenStance;
  stance_zh: string;
  door_meaning_zh: string;
  wang_xiang: string;
  /** Compact nine-palace structure lines (citeable). */
  palace_lines: string[];
  /** Full section appended into chart_fact_pack. */
  text: string;
};

export class DeliveryQimenCastError extends Error {
  readonly attempts: number;
  constructor(message: string, attempts: number, cause?: unknown) {
    super(message);
    this.name = "DeliveryQimenCastError";
    this.attempts = attempts;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

const STANCE_ZH: Record<DeliveryQimenStance, string> = {
  attack: "宜进取开创",
  hold: "宜守养休整",
  hide: "宜藏隐试探",
  retreat: "宜退避防损",
  display: "宜显名不宜强结",
};

function doorToStance(door: string): DeliveryQimenStance {
  if (door === "開門" || door === "生門") return "attack";
  if (door === "休門") return "hold";
  if (door === "杜門") return "hide";
  if (door === "景門") return "display";
  return "retreat";
}

function hostGuestLine(pan: QimenPan): string {
  const hostStem = String(pan.遁干 ?? "").trim();
  const hourPillar = pan.八字?.[3];
  const guestStem = hourPillar ? String(hourPillar[0] ?? "").trim() : "";
  const hostEl = STEM_TO_WUXING[hostStem] as WuXing | undefined;
  const guestEl = STEM_TO_WUXING[guestStem] as WuXing | undefined;
  if (!hostStem || !guestStem || !hostEl || !guestEl) {
    return `主客：值符遁干${hostStem || "?"} · 时干${guestStem || "?"}（五行未全）`;
  }
  const rel = getWuXingRelation(hostEl, guestEl);
  const relZh =
    rel === "same"
      ? "比和"
      : rel === "shengSelf"
        ? "主生客"
        : rel === "shengOther"
          ? "客生主"
          : rel === "keSelf"
            ? "主克客"
            : "客克主";
  return `主客：值符遁干${hostStem}(${hostEl}) · 时干${guestStem}(${guestEl}) → ${relZh}`;
}

function palaceLines(pan: QimenPan): string[] {
  const out: string[] = [];
  for (const cell of pan.九宮 ?? []) {
    if (!cell?.宮位 || cell.宮位 === "中五宮") continue;
    const door = cell.八門 ? String(cell.八門) : "";
    const god = cell.八神 ? String(cell.八神) : "";
    const star = cell.九星 ? String(cell.九星) : "";
    const bits = [cell.宮位, door, god, star].filter(Boolean);
    if (bits.length >= 2) out.push(bits.join(" "));
  }
  return out;
}

function buildText(pack: Omit<DeliveryQimenFactPack, "text">): string {
  const lines = [
    DELIVERY_QIMEN_FACT_PACK_HEADER,
    `锁盘时刻: ${pack.qimen_cast_at}`,
    `局: ${pack.ju_name}`,
    `值符: ${pack.zhi_fu_star}落${pack.zhi_fu_palace}`,
    `值使: ${pack.zhi_shi_door}落${pack.zhi_shi_palace}`,
    pack.host_guest,
    `局势取向: ${pack.stance_zh}（${pack.zhi_shi_door} · ${pack.door_meaning_zh}）`,
    `旺相休囚死: ${pack.wang_xiang}`,
  ];
  if (pack.palace_lines.length > 0) {
    lines.push(`九宫摘要: ${pack.palace_lines.slice(0, 8).join("；")}`);
  }
  const fuPalaceLine = pack.palace_lines.find((l) =>
    l.includes(pack.zhi_fu_palace),
  );
  if (fuPalaceLine?.includes("九天")) {
    lines.push("值符宫临九天：声势易虚高、画饼场偏强");
  }
  return lines.join("\n");
}

function summarizePan(pan: QimenPan, castAt: Date): DeliveryQimenFactPack {
  const ju_name = QimenFormatUtil.局名(pan.遁, pan.局數);
  const zhi_fu_star = String(pan.值符星 ?? "").trim();
  const zhi_fu_palace = String(pan.值符落宮 ?? "").trim();
  const zhi_shi_door = String(pan.值使門 ?? "").trim();
  const zhi_shi_palace = String(pan.值使落宮 ?? "").trim();
  if (!ju_name || !zhi_fu_star || !zhi_shi_door) {
    throw new Error("qimen pan missing 局/值符/值使");
  }
  const stance = doorToStance(zhi_shi_door);
  const doorNat = EIGHT_DOORS_NATURE[zhi_shi_door];
  const wang = Array.isArray(pan.旺相休囚死)
    ? `旺${pan.旺相休囚死[0]}相${pan.旺相休囚死[1]}休${pan.旺相休囚死[2]}囚${pan.旺相休囚死[3]}死${pan.旺相休囚死[4]}`
    : "";
  const base: Omit<DeliveryQimenFactPack, "text"> = {
    qimen_cast_at: castAt.toISOString(),
    ju_name,
    zhi_fu_star,
    zhi_fu_palace,
    zhi_shi_door,
    zhi_shi_palace,
    host_guest: hostGuestLine(pan),
    stance,
    stance_zh: STANCE_ZH[stance],
    door_meaning_zh: doorNat?.meaning_zh ?? zhi_shi_door,
    wang_xiang: wang,
    palace_lines: palaceLines(pan),
  };
  return { ...base, text: buildText(base) };
}

export function isValidDeliveryQimenFactPack(
  raw: unknown,
): raw is DeliveryQimenFactPack {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as DeliveryQimenFactPack;
  return (
    typeof o.qimen_cast_at === "string" &&
    o.qimen_cast_at.length >= 10 &&
    typeof o.text === "string" &&
    o.text.includes(DELIVERY_QIMEN_FACT_PACK_HEADER) &&
    typeof o.ju_name === "string" &&
    o.ju_name.length >= 2 &&
    typeof o.zhi_shi_door === "string" &&
    o.zhi_shi_door.length >= 2
  );
}

/**
 * Idempotent cast: if `existing` is valid, return it unchanged.
 * Otherwise cast at `castAt` (default now) with retries; throw on final failure.
 */
export function castDeliveryQimenFactPack(opts?: {
  castAt?: Date;
  existing?: DeliveryQimenFactPack | null;
  maxAttempts?: number;
}): DeliveryQimenFactPack {
  if (isValidDeliveryQimenFactPack(opts?.existing ?? null)) {
    return opts!.existing!;
  }
  const maxAttempts = Math.max(1, opts?.maxAttempts ?? 3);
  const castAt = opts?.castAt ?? new Date();
  if (Number.isNaN(castAt.getTime())) {
    throw new DeliveryQimenCastError("invalid castAt", 0);
  }
  let lastErr: unknown;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const lunar = Lunar.fromDate(castAt);
      const pan = QimenUtil.create(lunar);
      return summarizePan(pan, castAt);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new DeliveryQimenCastError(
    `delivery qimen cast failed after ${maxAttempts} attempts`,
    maxAttempts,
    lastErr,
  );
}

/** Merge qimen section into chart fact-pack text (replace prior qimen block if any). */
export function mergeQimenIntoChartFactPackText(
  chartFactPack: string | null | undefined,
  qimen: DeliveryQimenFactPack,
): string {
  const base = String(chartFactPack ?? "").trim();
  const withoutOld = base
    .replace(
      new RegExp(
        `${escapeRegExp(DELIVERY_QIMEN_FACT_PACK_HEADER)}[\\s\\S]*?(?=\\n【|$)`,
        "g",
      ),
      "",
    )
    .trim();
  if (!withoutOld) return qimen.text.trim();
  return `${withoutOld}\n\n${qimen.text.trim()}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function preallocHasQimen(
  map: { qimen?: unknown; chart_fact_pack?: string | null } | null | undefined,
): boolean {
  if (!map) return false;
  if (isValidDeliveryQimenFactPack(map.qimen)) return true;
  return Boolean(
    map.chart_fact_pack?.includes(DELIVERY_QIMEN_FACT_PACK_HEADER),
  );
}
