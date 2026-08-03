/**
 * DeliveryReportV2 split helpers — label-based body/evidence (not gold-mark heuristics).
 *
 *   pnpm exec tsx scripts/test-delivery-report-v2.ts
 */
import { buildDeliveryBookPages } from "@/lib/poju/delivery-book-pages";
import {
  splitProseWithH3,
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

  const h3Parts = splitProseWithH3("### 论点一\n\n你需要养习惯。\n\n### 论点二\n\n下一步行动。");
  assert("h3 split yields 4 parts", h3Parts.length === 4);
  assert("first h3 title", h3Parts[0]?.kind === "h3" && h3Parts[0]?.text === "论点一");
  assert("first prose", h3Parts[1]?.kind === "p" && Boolean(h3Parts[1]?.text.includes("养习惯")));
  assert("second h3", h3Parts[2]?.kind === "h3" && h3Parts[2]?.text === "论点二");

  const inlineH3 = splitProseWithH3("前文。 ### 内联标题\n后文");
  assert(
    "inline ### normalized",
    inlineH3.some((p) => p.kind === "h3" && p.text === "内联标题"),
  );

  // Single newline between evidence and next ### body must NOT swallow body into evidence.
  const noBlank = [
    "正文A",
    "**依据与推理:**",
    "依据一句。",
    "### 下一论点",
    "正文B应在折叠外。",
  ].join("\n");
  const noBlankBlocks = splitSectionBlocks(noBlank);
  assert("no-blank: 3 blocks (body/ev/body)", noBlankBlocks.length === 3);
  assert(
    "no-blank: body B outside evidence",
    noBlankBlocks[2]?.kind === "body" && Boolean(noBlankBlocks[2]?.text.includes("正文B")),
  );
  assert(
    "no-blank: evidence stops before ###",
    noBlankBlocks[1]?.kind === "evidence" && !noBlankBlocks[1]?.text.includes("正文B"),
  );

  // Rail book pages = same splitSections as center DeliveryReportV2.
  const longEv =
    "⟦t:stem_yi|柔蔓|gloss⟧是根基。接着⟦t:weak_self|需养|g⟧说明敏感。再补一句承重。";
  const bookMd = [
    "# 报告",
    "",
    "## 第一部分 · 你的能量结构",
    "",
    "正文短句。",
    "",
    "**依据与推理:**",
    longEv,
  ].join("\n");
  const pages = buildDeliveryBookPages(bookMd);
  const centerSecs = splitSections(bookMd);
  assert("rail page count = center section count", pages.length === centerSecs.length);
  const energy = pages.find((p) => p.id === "energy" || p.title.includes("第一部分"));
  const railBlocks = splitSectionBlocks(energy?.body ?? "");
  const centerBlocks = splitSectionBlocks(
    centerSecs.find((s) => s.title.includes("第一部分"))?.body ?? "",
  );
  assert("rail energy page exists", Boolean(energy));
  assert(
    "rail vs center same block kinds",
    railBlocks.map((b) => b.kind).join(",") === centerBlocks.map((b) => b.kind).join(","),
  );
  assert(
    "rail evidence keeps full chain (no reflow split)",
    railBlocks.some((b) => b.kind === "evidence" && b.text.includes("需养")),
  );

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All DeliveryReportV2 split checks passed.\n");
}

main();
