import { calculateProfileWithShunshi } from "@/lib/calculations/shunshi-adapter";
import { buildStreamLocalDataFromProfile } from "@/lib/base-analysis/build-stream-local-data";
import { buildZiweiFactPack } from "@/lib/ziwei/fact-pack";
import { formatZiweiClosedSetForPrompt } from "@/lib/ziwei/lab-ziwei";

async function main() {
  const birth = { year: 1990, month: 6, day: 15, hour: 9, minute: 30, gender: "M" as const, city: "Shanghai" };
  const t0 = Date.now();
  const profile = await calculateProfileWithShunshi(birth as never);
  const local = buildStreamLocalDataFromProfile(profile);
  const pack = buildZiweiFactPack(birth as never, { asOf: "2026-11-01T00:00:00.000Z" });
  const z = formatZiweiClosedSetForPrompt(pack);
  console.log(JSON.stringify({
    source: profile.source,
    day_master: local.structured.day_master,
    has_pillars: Boolean(local.structured.pillars_detail),
    da_yun: local.structured.da_yun.length,
    ziwei_len: z.length,
    ms: Date.now() - t0,
  }));
}
main().catch((e) => { console.error("ERR", e instanceof Error ? e.message : e); process.exit(1); });
