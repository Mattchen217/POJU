/**
 * Smoke: shape-example chrome strip for page_title / page_subtitle display.
 * Run: pnpm exec tsx scripts/test-display-chrome-strip.ts
 */

import assert from "node:assert/strict";
import { stripShapeExampleChrome } from "../lib/llm/pro/delivery/display-chrome-strip";

assert.equal(
  stripShapeExampleChrome("贴本案科学打法名：先把最紧的感情雷拆成可核对清单"),
  "先把最紧的感情雷拆成可核对清单",
);

assert.equal(stripShapeExampleChrome("贴本案科学打法名"), "");

assert.equal(
  stripShapeExampleChrome(
    "Ponle nombre al método de este caso: primero separa la tensión afectiva en una lista que puedas revisar",
  ),
  "primero separa la tensión afectiva en una lista que puedas revisar",
);

assert.equal(
  stripShapeExampleChrome("贴主辅节奏与可落实行动（零专名）"),
  "",
);

assert.equal(
  stripShapeExampleChrome(
    "A science-based way to start: first break the biggest relationship pressure into a checklist",
  ),
  "A science-based way to start: first break the biggest relationship pressure into a checklist",
);

assert.equal(
  stripShapeExampleChrome("先把最紧的感情雷拆成可核对清单"),
  "先把最紧的感情雷拆成可核对清单",
);

console.log("test-display-chrome-strip: ok");
