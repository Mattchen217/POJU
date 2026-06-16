/**
 * Run: pnpm tsx scripts/test-element-pillar-map.ts
 */
import { buildElementPillarMap } from "@/lib/poju/build-element-pillar-map";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";

const pillars: ProfileStructured["pillars_detail"] = {
  year: { ganzhi: "丁巳", stem: "丁", branch: "巳", ten_god: "x", hidden_stems: [], shen_sha: [] },
  month: { ganzhi: "壬寅", stem: "壬", branch: "寅", ten_god: "x", hidden_stems: [], shen_sha: [] },
  day: { ganzhi: "乙卯", stem: "乙", branch: "卯", ten_god: "x", hidden_stems: [], shen_sha: [] },
  hour: { ganzhi: "庚辰", stem: "庚", branch: "辰", ten_god: "x", hidden_stems: [], shen_sha: [] },
};

const zh = buildElementPillarMap(pillars, "zh");
const metal = zh.find((r) => r.element === "Metal");
const wood = zh.find((r) => r.element === "Wood");

if (!metal?.assignments.some((a) => a.slot === "hour_stem" && a.han === "庚")) {
  console.error("FAIL: Metal hour stem 庚");
  process.exit(1);
}
if (!wood?.assignments.some((a) => a.slot === "month_branch" && a.han === "寅")) {
  console.error("FAIL: Wood month branch 寅");
  process.exit(1);
}

console.log("OK: element pillar map", zh);
console.log("All element pillar map checks passed.");
