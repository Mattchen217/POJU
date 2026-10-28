/**
 * P4 quoted-script is a surface class: body substance_only defers it.
 * Full surface (polish / skip) still fails real quotes and 心里稿.
 * Plural possessives and in-word apostrophes are not quote characters.
 * Production polish may schedule one acceptance continue; Lab must not.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { polishQuotedScriptMayRetryOnce } from "../lib/llm/pro/delivery/pipeline-v3/acceptance-retry";
import { buildV3BodyPrompt } from "../lib/llm/pro/delivery/pipeline-v3/body-prompt";
import { gateBodyCategoryB } from "../lib/llm/pro/delivery/pipeline-v3/gate-body-category";
import type { DeliveryPageData } from "../lib/llm/pro/delivery/page-schema/types";

function p4(strategy: string): DeliveryPageData {
  return {
    page: "self_regulation",
    page_title: "先收再看",
    page_subtitle: "窗口未开",
    dimensions: [
      {
        name: "局势",
        strategy,
        means: ["先把重大决定放下，因为此刻还太燥。"],
        chart_anchors: [],
      },
    ],
  } as unknown as DeliveryPageData;
}

const quoted = "先把「出活的人」这个标签放下，再看窗口是否真的开了。";
const possessive =
  "Hold the partners' pace and don't chase the offer while it's still only talk.";
const inner = "气口未开时先别动，心里默念一句再出手。";

const deferred = gateBodyCategoryB({
  key: "self_regulation",
  page_schema: p4(quoted),
  surface: "substance_only",
});
assert.equal(deferred, null, "body substance_only defers quoted script to polish");

const fullQuote = gateBodyCategoryB({
  key: "self_regulation",
  page_schema: p4(quoted),
  surface: "full",
});
assert.equal(fullQuote?.failed_rule, "gate_p4_body_quoted_script");

const englishQuote = gateBodyCategoryB({
  key: "self_regulation",
  page_schema: p4('Pause and do not say "not yet" out loud.'),
  surface: "full",
});
assert.equal(englishQuote?.failed_rule, "gate_p4_body_quoted_script");

const poss = gateBodyCategoryB({
  key: "self_regulation",
  page_schema: p4(possessive),
  surface: "full",
});
assert.equal(poss, null, "partners' / don't / it's are not quoted scripts");

const curlyPoss = gateBodyCategoryB({
  key: "self_regulation",
  page_schema: p4("Hold the partners’ pace until the window opens."),
  surface: "full",
});
assert.equal(curlyPoss, null, "curly plural possessive is not a quote shell");

const unquoted = gateBodyCategoryB({
  key: "self_regulation",
  page_schema: p4(inner),
  surface: "full",
});
assert.equal(unquoted?.failed_rule, "gate_p4_body_quoted_script");

const unquotedBody = gateBodyCategoryB({
  key: "self_regulation",
  page_schema: p4(inner),
  surface: "substance_only",
});
assert.equal(unquotedBody, null, "心里稿 also defers at body");

const clean = gateBodyCategoryB({
  key: "self_regulation",
  page_schema: p4("窗口还没熟，先别跟着虚高往前冲，把底线收住再看下一步。"),
  surface: "full",
});
assert.equal(clean, null);

const partTime = gateBodyCategoryB({
  key: "self_regulation",
  page_schema: p4("先用兼职试水过渡，等对方松口。"),
  reality_blob: "对方拒绝兼职，必须全职",
  surface: "substance_only",
});
assert.equal(partTime?.failed_rule, "gate_p4_body_rejected_path_as_primary");

const ritual = gateBodyCategoryB({
  key: "self_regulation",
  page_schema: p4("先深呼吸，再看这扇窗口。"),
  surface: "substance_only",
});
assert.equal(ritual?.failed_rule, "gate_p4_body_ritual_boilerplate");

assert.equal(
  polishQuotedScriptMayRetryOnce({
    ops_user: "production",
    acceptance_armed: false,
    failed_rule: "gate_p4_body_quoted_script",
  }),
  true,
);
assert.equal(
  polishQuotedScriptMayRetryOnce({
    ops_user: "production",
    acceptance_armed: true,
    failed_rule: "gate_p4_body_quoted_script",
  }),
  false,
);
assert.equal(
  polishQuotedScriptMayRetryOnce({
    ops_user: "ops",
    acceptance_armed: false,
    failed_rule: "gate_p4_body_quoted_script",
  }),
  false,
);
assert.equal(
  polishQuotedScriptMayRetryOnce({
    ops_user: "production",
    acceptance_armed: false,
    failed_rule: "gate_p4_body_ritual_boilerplate",
  }),
  false,
);

const duty = buildV3BodyPrompt({
  key: "self_regulation",
  locale: "en",
  user_feed: "",
});
assert.match(duty.user, /开口稿/);
assert.match(duty.user, /间接叙述/);

const step = readFileSync(
  new URL("../lib/llm/pro/delivery/lab/run-step-v3.ts", import.meta.url),
  "utf8",
);
assert.match(step, /polishQuotedScriptMayRetryOnce/);
assert.match(step, /p4_quoted_script_1plus1/);

console.log("test-p4-quoted-script-gate: ok");
