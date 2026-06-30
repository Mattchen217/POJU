/**
 * Block 49 — bare term marker repair (t:shen_sha:gua_su|… without ⟦⟧)
 */
import {
  repairChatTermMarkers,
  parseTermMarkers,
} from "@/lib/llm/sanitize/compliance-terms";

function assert(label: string, ok: boolean): void {
  if (!ok) {
    console.error("FAIL:", label);
    process.exit(1);
  }
  console.log("OK:", label);
}

const locale = "zh";

const bareLeak =
  "时柱那颗 t:shen_sha:gua_su|独立倾向|它让你在独处时反而更自在，久了就变成一道自动门";
const repaired = repairChatTermMarkers(bareLeak, locale);
assert("repairChatTermMarkers wraps gua_su", repaired.includes("⟦t:gua_su|"));
assert("repairChatTermMarkers no bare leak", !repaired.includes("t:shen_sha:gua_su"));
assert("repair keeps following Chinese prose", repaired.includes("它让你在独处时"));
const markers = parseTermMarkers(repaired);
assert("parseTermMarkers normalizes id to gua_su", markers.some((m) => m.id === "gua_su"));

const bracketWrongId = "你的 ⟦t:shen_sha:gua_su|独立倾向（寡宿）|独处时更自在⟧ 能量";
const fixedBracket = repairChatTermMarkers(bracketWrongId, locale);
assert("repair bracketed colon id", fixedBracket.includes("⟦t:gua_su|") && !fixedBracket.includes("shen_sha:gua_su"));

console.log("\nBlock 49 acceptance: all passed");
