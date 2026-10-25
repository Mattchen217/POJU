/**
 * #11 Invented user-absent numbers — detector + gate + scrub regression.
 *   pnpm exec tsx scripts/test-invented-user-number.ts
 */
import assert from "node:assert/strict";
import {
  findInventedUserAbsentNumber,
  inventedUserNumberPromptBlock,
  scrubInventedPercentPlaceholders,
  scrubInventedPercentPlaceholdersInTree,
  INVENTED_USER_NUMBER_DUTY_LINE,
  INVENTED_USER_NUMBER_RULE_ID,
  P1_INVENTED_NUMBER_RULE_ID,
} from "@/lib/llm/pro/delivery/pipeline-v3/invented-user-number";
import {
  buildBodyGateAvoidanceBlockForPolish,
  gateBodyCategoryB,
} from "@/lib/llm/pro/delivery/pipeline-v3/gate-body-category";
import { buildV3BodyPrompt } from "@/lib/llm/pro/delivery/pipeline-v3/body-prompt";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";

// --- detector: invent fixtures ---
assert.equal(
  findInventedUserAbsentNumber("先留出三个月观察期再谈全职", "")?.kind,
  "schedule",
);
assert.equal(
  findInventedUserAbsentNumber("每周不超过15小时试水", "")?.kind,
  "schedule",
);
assert.equal(
  findInventedUserAbsentNumber("within 3 months lock equity", "")?.kind,
  "schedule",
);
assert.equal(
  findInventedUserAbsentNumber("ask for $50k signing bonus", "")?.kind,
  "money",
);
assert.equal(
  findInventedUserAbsentNumber("年薪80万才值得辞", "")?.kind,
  "money",
);
assert.equal(
  findInventedUserAbsentNumber("对方已经35岁", "")?.kind,
  "age",
);
assert.equal(
  findInventedUserAbsentNumber("给到30%股权", "")?.kind,
  "percent_claim",
);
assert.equal(
  findInventedUserAbsentNumber("写明 X% 行权", "")?.kind,
  "percent_placeholder",
);
assert.equal(
  findInventedUserAbsentNumber("四年成熟期一年 cliff", "")?.kind,
  "contract",
);

// --- detector: allowed by reality / collecting ---
assert.equal(
  findInventedUserAbsentNumber(
    "按你说的半年缓冲再看",
    "积蓄：半年到六个月 runway",
  ),
  null,
);
assert.equal(
  findInventedUserAbsentNumber(
    "对方要年薪80万才谈",
    "期望：年薪80万；对方已拒兼职",
  ),
  null,
);
assert.equal(
  findInventedUserAbsentNumber(
    "书面约定给到30%股权",
    "收集：对方口头提过30%股权",
  ),
  null,
);
assert.equal(
  findInventedUserAbsentNumber(
    "每周不超过15小时顾问",
    "收集：每周不超过15小时",
  ),
  null,
);

// Case-specific prose without concrete invent
assert.equal(
  findInventedUserAbsentNumber(
    "对方已拒兼职；主路守全职硬门槛，辅路改按次顾问。",
    "对方已拒兼职；必须全职",
  ),
  null,
);

// --- light scrub ---
{
  const r = scrubInventedPercentPlaceholders("股权写 X% 与 Y%");
  assert.equal(r.scrubbed, true);
  assert.ok(!r.text.includes("X%"));
  assert.ok(r.text.includes("按书面约定比例"));
}
{
  const r = scrubInventedPercentPlaceholdersInTree({
    means: ["给 X%"],
    chart_anchors: ["X%留锚"],
  });
  assert.equal(r.scrubbed, true);
  assert.equal((r.value as { means: string[] }).means[0], "给 按书面约定比例");
  assert.equal(
    (r.value as { chart_anchors: string[] }).chart_anchors[0],
    "X%留锚",
  );
}

// --- prompt blocks ---
const zh = inventedUserNumberPromptBlock("zh");
assert.ok(zh.includes("#11"));
assert.ok(zh.includes("缓冲月数") || zh.includes("具体量"));
assert.ok(INVENTED_USER_NUMBER_DUTY_LINE.includes("#11"));
const en = inventedUserNumberPromptBlock("en");
assert.ok(en.includes("Invented numbers ban (#11"));

// --- body prompt mounts #11 ---
const { system, user } = buildV3BodyPrompt({
  key: "decision_brief",
  locale: "zh",
  core_conclusion: "宜守硬门槛",
  judgment_lock: "path=primary",
  user_feed: "期望：谈妥书面权益再全职。对方已拒兼职。",
});
assert.ok(
  system.includes("#11") || system.includes("发明数字"),
  "BODY_SYSTEM should carry #11 invented-number ban",
);
assert.ok(
  user.includes("#11") || user.includes("发明数字"),
  "P1 duty should carry #11 invented-number line",
);

// --- polish avoidance ---
const avoid = buildBodyGateAvoidanceBlockForPolish("decision_brief");
assert.ok(avoid.includes(P1_INVENTED_NUMBER_RULE_ID) || avoid.includes("#11"));
assert.ok(avoid.includes(INVENTED_USER_NUMBER_RULE_ID) || avoid.includes("#11"));

// --- gate fails invented numbers on P1 (substance_only too) ---
const inventPage = {
  page: "decision_brief",
  page_title: "先缓冲",
  page_subtitle: "观察再定",
  core_judgment: "先留出三个月观察期，再谈全职。",
  primary: {
    name: "主路",
    core_logic: "每周不超过15小时试水，年薪80万再辞。",
    why: "看起来稳",
    when: "三个月内",
  },
  backup: { name: "辅", core_logic: "等", why: "x", when: "later" },
} as unknown as DeliveryPageData;

const failSub = gateBodyCategoryB({
  key: "decision_brief",
  page_schema: inventPage,
  reality_blob: "对方已拒兼职；必须全职。未谈年薪数字。",
  surface: "substance_only",
});
assert.ok(failSub && failSub.passed === false);
assert.equal(failSub!.failed_rule, P1_INVENTED_NUMBER_RULE_ID);

const failFull = gateBodyCategoryB({
  key: "decision_brief",
  page_schema: inventPage,
  reality_blob: "",
  surface: "full",
});
assert.ok(failFull && failFull.passed === false);
assert.equal(failFull!.failed_rule, P1_INVENTED_NUMBER_RULE_ID);

// --- gate passes when reality lists the amounts ---
const allowedPage = {
  page: "decision_brief",
  page_title: "半年缓冲内守门槛",
  page_subtitle: "主全职 vs 辅顾问",
  core_judgment: "按你说的半年缓冲守全职硬门槛。",
  primary: {
    name: "守全职",
    core_logic: "对方已拒兼职；半年缓冲内把书面权益谈清。",
    why: "对齐收集事实",
    when: "半年缓冲用尽前",
  },
  backup: {
    name: "按次顾问",
    core_logic: "若书面权益拖过半年缓冲，改按次顾问。",
    why: "止损",
    when: "半年缓冲见底时",
  },
} as unknown as DeliveryPageData;

const pass = gateBodyCategoryB({
  key: "decision_brief",
  page_schema: allowedPage,
  reality_blob: "积蓄：半年缓冲；对方已拒兼职；必须全职。",
  surface: "substance_only",
});
assert.equal(pass, null);

// P3 money invent still hard-fails via shared #11 rule
const p3Invent = {
  page: "execution_guidance",
  page_title: "打法",
  page_subtitle: "主辅",
  primary_toolkit: {
    title: "主",
    angles: [
      {
        name: "a",
        strategy: "要年薪80万签字费",
        means: ["开价"],
        chart_anchors: [],
      },
    ],
  },
  backup_toolkit: { title: "辅", angles: [] },
} as unknown as DeliveryPageData;
const p3Fail = gateBodyCategoryB({
  key: "execution_guidance",
  page_schema: p3Invent,
  reality_blob: "对方已拒兼职",
  surface: "substance_only",
});
assert.ok(p3Fail && p3Fail.passed === false);
assert.equal(p3Fail!.failed_rule, INVENTED_USER_NUMBER_RULE_ID);

console.log("ok: invented-user-number #11 detector + gate + scrub");
