import { drawSign } from "@/lib/oracle/drawSign";
import type { SignData } from "@/types/oracle";

/** Server/client shared: uniform random draw from `public/oracle/data/signs.json`. */
export function drawGlyphFromPool(): SignData {
  return drawSign();
}
