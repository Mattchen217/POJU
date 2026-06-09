import { liChunYearForDate } from "@/lib/llm/prompts/oriental-counselor-base";
import type { BirthInfo } from "@/lib/profile/types";

const ZODIAC_ANIMALS = [
  { zh: "鼠", en: "Rat" },
  { zh: "牛", en: "Ox" },
  { zh: "虎", en: "Tiger" },
  { zh: "兔", en: "Rabbit" },
  { zh: "龙", en: "Dragon" },
  { zh: "蛇", en: "Snake" },
  { zh: "马", en: "Horse" },
  { zh: "羊", en: "Goat" },
  { zh: "猴", en: "Monkey" },
  { zh: "鸡", en: "Rooster" },
  { zh: "狗", en: "Dog" },
  { zh: "猪", en: "Pig" },
] as const;

type SunSign = { zh: string; en: string };

const SUN_SIGNS: Array<{ start: [number, number]; sign: SunSign }> = [
  { start: [1, 20], sign: { zh: "水瓶座", en: "Aquarius" } },
  { start: [2, 19], sign: { zh: "双鱼座", en: "Pisces" } },
  { start: [3, 21], sign: { zh: "白羊座", en: "Aries" } },
  { start: [4, 20], sign: { zh: "金牛座", en: "Taurus" } },
  { start: [5, 21], sign: { zh: "双子座", en: "Gemini" } },
  { start: [6, 21], sign: { zh: "巨蟹座", en: "Cancer" } },
  { start: [7, 23], sign: { zh: "狮子座", en: "Leo" } },
  { start: [8, 23], sign: { zh: "处女座", en: "Virgo" } },
  { start: [9, 23], sign: { zh: "天秤座", en: "Libra" } },
  { start: [10, 23], sign: { zh: "天蝎座", en: "Scorpio" } },
  { start: [11, 22], sign: { zh: "射手座", en: "Sagittarius" } },
  { start: [12, 22], sign: { zh: "摩羯座", en: "Capricorn" } },
];

/** Age in full years from birth date (ground truth). */
export function computeAgeYears(birth: Pick<BirthInfo, "year" | "month" | "day">, now = new Date()): number {
  let age = now.getFullYear() - birth.year;
  const month = now.getMonth() + 1;
  const day = now.getDate();
  if (month < birth.month || (month === birth.month && day < birth.day)) {
    age -= 1;
  }
  return Math.max(0, age);
}

export function chineseZodiacAnimal(
  birth: Pick<BirthInfo, "year" | "month" | "day">,
): { zh: string; en: string } {
  const birthDate = new Date(birth.year, birth.month - 1, birth.day);
  const liChunYear = liChunYearForDate(birthDate);
  const branchIndex = ((liChunYear - 1984) % 12 + 12) % 12;
  return ZODIAC_ANIMALS[branchIndex] ?? ZODIAC_ANIMALS[0];
}

export function westernSunSign(birth: Pick<BirthInfo, "month" | "day">): SunSign {
  const md = birth.month * 100 + birth.day;
  let sign = SUN_SIGNS[SUN_SIGNS.length - 1]!.sign;
  for (let i = 0; i < SUN_SIGNS.length; i++) {
    const [m, d] = SUN_SIGNS[i]!.start;
    if (md >= m * 100 + d) sign = SUN_SIGNS[i]!.sign;
  }
  return sign;
}

export type BirthIdentityLabels = {
  age_years: number;
  zodiac_zh: string;
  zodiac_en: string;
  sun_sign_zh: string;
  sun_sign_en: string;
};

export function buildBirthIdentityLabels(
  birth: Pick<BirthInfo, "year" | "month" | "day">,
  now = new Date(),
): BirthIdentityLabels {
  const zodiac = chineseZodiacAnimal(birth);
  const sun = westernSunSign(birth);
  return {
    age_years: computeAgeYears(birth, now),
    zodiac_zh: zodiac.zh,
    zodiac_en: zodiac.en,
    sun_sign_zh: sun.zh,
    sun_sign_en: sun.en,
  };
}

/** Prompt block: age / zodiac / sun sign from birth date — not user verbal age. */
export function buildBirthIdentityGroundTruthBlock(
  birth: Pick<BirthInfo, "year" | "month" | "day">,
  locale: string,
  now = new Date(),
): string {
  const id = buildBirthIdentityLabels(birth, now);
  const zh = locale.startsWith("zh");

  if (zh) {
    return `# 客观身份信息（ground truth — 必须以此为准）

- 当前年龄：**${id.age_years} 岁**（按出生 ${birth.year}-${String(birth.month).padStart(2, "0")}-${String(birth.day).padStart(2, "0")} 计算）
- 生肖：**属${id.zodiac_zh}**（身份标签 only）
- 星座：**${id.sun_sign_zh}**（身份标签 only）

⚠️ 规则：
- 用户口述年龄（如「47 岁」）若与上表冲突，**仍以上表为准**；可温和纠正，勿采信口述岁数
- 生肖/星座仅作身份描述（像姓名/年龄），**禁止**用于犯太岁/运势吉凶/预测断言`;
  }

  return `# Objective identity (ground truth — always use this)

- Current age: **${id.age_years} years old** (from birth date ${birth.year}-${String(birth.month).padStart(2, "0")}-${String(birth.day).padStart(2, "0")})
- Chinese zodiac: **${id.zodiac_en}** (identity label only)
- Sun sign: **${id.sun_sign_en}** (identity label only)

⚠️ Rules:
- If the user states a different age verbally, **still use the table above**; you may gently correct — do not adopt their stated age
- Zodiac / sun sign are identity labels only — **never** use them for fortune predictions (e.g. "Snake year clashes with Tai Sui")`;
}
