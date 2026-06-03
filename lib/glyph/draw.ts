import { drawSign } from "@/lib/oracle/drawSign";
import type { SignData } from "@/types/oracle";

/** Server/client shared: uniform random draw from `lib/glyph/data/signs.json`. */
export function drawGlyphFromPool(): SignData {
  return drawSign();
}
