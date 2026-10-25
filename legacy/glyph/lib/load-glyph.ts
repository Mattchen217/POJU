import signsData from "@/lib/glyph/data/signs.json";
import { LEVEL_META } from "@/types/oracle";
import type { SignData } from "@/types/oracle";

const ALL_SIGNS = signsData as SignData[];

export async function loadGlyphById(signNumber: number): Promise<SignData | null> {
  return ALL_SIGNS.find((s) => s.sign_number === signNumber) ?? null;
}

export function loadGlyphBySignData(sign: SignData): SignData {
  return ALL_SIGNS.find((s) => s.sign_number === sign.sign_number) ?? sign;
}
