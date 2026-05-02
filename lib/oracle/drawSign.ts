import type { SignData, GlyphLevel, UserInput, DrawResult } from "@/types/oracle";
import signsData from "../../public/oracle/data/signs.json";

const ALL_SIGNS = signsData as SignData[];

const GLYPH_LEVELS: GlyphLevel[] = [
  "divine_tailwind",
  "fair_sky",
  "still_water",
  "crosswind",
  "eye_of_storm",
];

/**
 * 抽签 — 在全部签中均匀随机（不按等级加权）
 */
export function drawSign(): SignData {
  if (ALL_SIGNS.length === 0) {
    throw new Error("No signs data found. Make sure signs.json is generated.");
  }
  const totalSigns = ALL_SIGNS.length;
  const randomIndex = Math.floor(Math.random() * totalSigns);
  return ALL_SIGNS[randomIndex];
}

export function drawSignWithContext(userInput: UserInput): DrawResult {
  return {
    sign: drawSign(),
    drawnAt: Date.now(),
    userInput,
  };
}

/** 测试用:强制抽某个等级的签 */
export function drawSignByLevel(level: GlyphLevel): SignData {
  const signsOfLevel = ALL_SIGNS.filter((s) => s.level === level);
  if (signsOfLevel.length === 0) {
    throw new Error(`No signs found for level: ${level}. Check your signs.json data.`);
  }
  const randomIndex = Math.floor(Math.random() * signsOfLevel.length);
  return signsOfLevel[randomIndex];
}

/** 测试用:强制抽指定签号 */
export function drawSignByNumber(signNumber: number): SignData {
  const sign = ALL_SIGNS.find((s) => s.sign_number === signNumber);
  if (!sign) {
    throw new Error(`Sign #${signNumber} not found in signs.json.`);
  }
  return sign;
}

export function getLevelDistribution(): Record<GlyphLevel, number> {
  const distribution: Record<GlyphLevel, number> = {
    divine_tailwind: 0,
    fair_sky: 0,
    still_water: 0,
    crosswind: 0,
    eye_of_storm: 0,
  };
  ALL_SIGNS.forEach((sign) => {
    distribution[sign.level]++;
  });
  return distribution;
}

export function validateSignsData(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (ALL_SIGNS.length !== 100) {
    errors.push(`Expected 100 signs, found ${ALL_SIGNS.length}`);
  }

  const signNumbers = ALL_SIGNS.map((s) => s.sign_number).sort((a, b) => a - b);
  for (let i = 1; i <= 100; i++) {
    if (!signNumbers.includes(i)) {
      errors.push(`Missing sign number: ${i}`);
    }
  }

  ALL_SIGNS.forEach((sign) => {
    if (!sign.verse_lines_en || sign.verse_lines_en.length !== 4) {
      errors.push(`Sign ${sign.sign_number}: verse_lines_en must have 4 lines`);
    }
    if (!sign.summary_line_en) {
      errors.push(`Sign ${sign.sign_number}: missing summary_line_en`);
    }
    if (!sign.level || !GLYPH_LEVELS.includes(sign.level)) {
      errors.push(`Sign ${sign.sign_number}: invalid level "${sign.level}"`);
    }
    if (!sign.raw_md_content) {
      errors.push(`Sign ${sign.sign_number}: missing raw_md_content (needed for LLM)`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
