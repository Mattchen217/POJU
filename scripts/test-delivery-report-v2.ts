/**
 * DeliveryReportV2 split helpers — label-based body/evidence (not gold-mark heuristics).
 *
 *   pnpm exec tsx scripts/test-delivery-report-v2.ts
 */
import {
  splitSectionBlocks,
  splitSections,
} from "@/lib/poju/delivery-report-v2-split";

const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== DeliveryReportV2 splits ==========\n");

  const section = [
    "你现在的状态像电量不足。",
    "",
    "**依据与推理:**",
    "⟦t:weak_self||你现在的状态像电量不足的电池⟧ 一直很弱，所以⟦t:day_master||你身上最核心的生命力⟧被拖累。",
    "",
    "下一步先补补给。",
    "",
    "**依据与推理:**",
    "无金字也要整段留在依据里：生于失令之月。",
  ].join("\n");

  const blocks = splitSectionBlocks(section);
  assert("body / evidence / body / evidence", blocks.length === 4);
  assert("first is body", blocks[0]?.kind === "body");
  assert(
    "second is evidence with marker",
    blocks[1]?.kind === "evidence" && Boolean(blocks[1]?.text.includes("⟦t:weak_self")),
  );
  assert("third is body", blocks[2]?.kind === "body" && Boolean(blocks[2]?.text.includes("下一步")));
  assert(
    "unmarked evidence stays in evidence block",
    blocks[3]?.kind === "evidence" && Boolean(blocks[3]?.text.includes("生于失令之月")),
  );

  const md = [
    "# Cover title",
    "",
    "blurb",
    "",
    "## 第一部分 · 能量",
    "",
    "正文A",
    "",
    "**依据与推理:**",
    "依据A",
    "",
    "## 附录 · 数据",
    "",
    "附录正文",
  ].join("\n");

  const sections = splitSections(md);
  assert("has cover-ish + 2 H2 sections", sections.length >= 3);
  assert(
    "H2 title preserved",
    sections.some((s) => s.title.includes("第一部分")),
  );
  const part1 = sections.find((s) => s.title.includes("第一部分"));
  assert(
    "evidence not split by missing marks",
    splitSectionBlocks(part1?.body ?? "").length === 2,
  );

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All DeliveryReportV2 split checks passed.\n");
}

main();
