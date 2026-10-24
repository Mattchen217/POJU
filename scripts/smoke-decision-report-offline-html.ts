/**
 * Smoke: decision blank → filled offline HTML (SoT 16 path C).
 * Run: pnpm tsx scripts/smoke-decision-report-offline-html.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

import {
  buildDecisionReportBlankOpenHtml,
  buildDecisionReportProgressiveHtml,
  buildDeliveryInteractiveHtml,
  decisionReportOfflineFilename,
  getDecisionReportBlankTemplate,
} from "@/lib/poju/delivery-interactive-html";

const SAMPLE = `# 关于「是否该跳槽」的能量决策报告

## 目录

## 局势回声
你卡在去留之间，不是懒，是怕踏错一步。

### 依据
日主偏弱，动则耗。

## 主路径
先稳住现金流，再谈跃迁窗口。

### 依据
官杀混杂时不宜硬闯。

## 附录
（金词表见下）
`;

async function main() {
  const blank = getDecisionReportBlankTemplate();
  if (!blank.includes("{{SLOT_PANES}}") || !blank.includes("delivery-book-stage")) {
    throw new Error("blank template missing chrome/slots");
  }
  const openBlank = buildDecisionReportBlankOpenHtml("zh", {
    originalQuestion: "是否该跳槽",
    embed: true,
  });
  if (!openBlank.includes("delivery-book-stage")) {
    throw new Error("blank-open missing chrome");
  }
  if (openBlank.includes("{{SLOT_")) {
    throw new Error("unfilled slots in blank-open");
  }

  const progressive = buildDecisionReportProgressiveHtml(SAMPLE, "zh", {
    originalQuestion: "是否该跳槽",
    title: "能量决策报告",
    embed: true,
  });
  const fileHtml = buildDeliveryInteractiveHtml(SAMPLE, "zh", {
    originalQuestion: "是否该跳槽",
    embed: false,
  });
  if (progressive.includes("{{SLOT_")) throw new Error("unfilled slots in progressive");
  if (fileHtml.includes("{{SLOT_")) throw new Error("unfilled slots in file html");
  if (!fileHtml.includes("data-slot-pane=")) throw new Error("missing panes");
  if (!fileHtml.includes("Eastern OS") && !fileHtml.includes("delivery-book-stage")) {
    throw new Error("missing Eastern OS / stage chrome");
  }
  if (fileHtml.length < 50_000) throw new Error(`filled too small: ${fileHtml.length}`);
  if (fileHtml.length > 2_500_000) throw new Error(`filled too large: ${fileHtml.length}`);

  const dir = join(process.cwd(), "temp");
  mkdirSync(dir, { recursive: true });
  const name = decisionReportOfflineFilename();
  const outFile = join(dir, name);
  const outBlank = join(dir, "eastern-os-decision-report-blank-open.html");
  const stable = join(dir, "eastern-os-decision-report-smoke.html");
  writeFileSync(outBlank, openBlank, "utf8");
  writeFileSync(outFile, fileHtml, "utf8");
  writeFileSync(stable, fileHtml, "utf8");
  console.log("READY decision offline html");
  console.log("blank_bytes", blank.length);
  console.log("blank_open_bytes", openBlank.length);
  console.log("filled_bytes", fileHtml.length);
  console.log("out", outFile);
  console.log("stable", stable);
  console.log("blank_open", outBlank);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
