/**
 * #9 Template voice — prompt duties + gate detector regression.
 *   pnpm exec tsx scripts/test-template-voice-ban.ts
 */
import assert from "node:assert/strict";
import {
  detectTemplateWallpaper,
  templateVoicePromptBlock,
  TEMPLATE_VOICE_DUTY_LINE,
  TEMPLATE_VOICE_RULE_ID,
} from "@/lib/llm/pro/delivery/pipeline-v3/template-voice";
import {
  buildBodyGateAvoidanceBlockForPolish,
  gateBodyCategoryB,
} from "@/lib/llm/pro/delivery/pipeline-v3/gate-body-category";
import { buildV3BodyPrompt } from "@/lib/llm/pro/delivery/pipeline-v3/body-prompt";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";

// --- detector: banned wallpaper ---
assert.equal(
  detectTemplateWallpaper("Hold this mantra tonight and breathe.")?.kind,
  "mantra",
);
assert.equal(
  detectTemplateWallpaper("easy surface · sting underneath always")?.kind,
  "surface_sting",
);
assert.equal(
  detectTemplateWallpaper("Your Energy Structure explains the week.")?.kind,
  "energy_title",
);
assert.equal(
  detectTemplateWallpaper("Energy Retune Plan for Monday")?.kind,
  "energy_title",
);
assert.equal(
  detectTemplateWallpaper("your energy is leaking into the room")?.kind,
  "energy_stack",
);
assert.equal(
  detectTemplateWallpaper("Your current state is unsettled and vague.")?.kind,
  "fortune_opener",
);
assert.equal(
  detectTemplateWallpaper("能量结构决定了你的选择，再做能量调频。")?.kind,
  "energy_title",
);
assert.equal(
  detectTemplateWallpaper("表面轻松、底下刺痛，这就是关系。")?.kind,
  "surface_sting",
);

// --- detector: allowed energy picture / case-specific ---
assert.equal(
  detectTemplateWallpaper(
    "Based on your energy picture—the pattern of forces shaping how you choose—defend the full-time boundary your partner already set.",
  ),
  null,
);
assert.equal(
  detectTemplateWallpaper(
    "围着你「谈妥书面权益再全职」的期望：主路守硬门槛，辅路按次顾问；对方已拒兼职就别再试水。",
  ),
  null,
);

// --- prompt blocks ---
const en = templateVoicePromptBlock("en");
assert.ok(en.includes("Template voice ban (#9"));
assert.ok(en.includes("mantra"));
assert.ok(en.includes("easy surface"));
assert.ok(en.includes("energy structure"));
const zh = templateVoicePromptBlock("zh");
assert.ok(zh.includes("能量结构"));
assert.ok(zh.includes("口头禅") || zh.includes("箴言"));
assert.ok(TEMPLATE_VOICE_DUTY_LINE.includes("#9"));

// --- body prompt mounts #9 ---
const { system, user } = buildV3BodyPrompt({
  key: "decision_brief",
  locale: "zh",
  core_conclusion: "宜守硬门槛",
  judgment_lock: "path=primary",
  user_feed: "期望：谈妥书面权益再全职。对方已拒兼职。",
});
assert.ok(
  system.includes("模板腔") || system.includes("能量结构"),
  "BODY_SYSTEM should carry #9 template voice ban",
);
assert.ok(
  user.includes("#9") || user.includes("模板腔") || user.includes("能量结构"),
  "P1 duty should carry #9 line",
);
assert.ok(user.includes("期望钉死") || user.includes("围期望") || user.includes("#9"));

// --- polish avoidance ---
const avoid = buildBodyGateAvoidanceBlockForPolish("decision_brief");
assert.ok(avoid.includes(TEMPLATE_VOICE_RULE_ID));

// --- gate fails wallpaper on P1 ---
const wallpaperPage = {
  page: "decision_brief",
  page_title: "Your Energy Structure",
  page_subtitle: "Energy Retune Plan",
  core_judgment: "Hold this mantra when energy is leaking.",
  primary: {
    name: "Main",
    core_logic: "easy surface · sting underneath",
    why: "your current state is foggy",
    when: "now",
  },
  backup: { name: "Backup", core_logic: "wait", why: "x", when: "later" },
} as unknown as DeliveryPageData;

const fail = gateBodyCategoryB({
  key: "decision_brief",
  page_schema: wallpaperPage,
  surface: "full",
});
assert.ok(fail && fail.passed === false);
assert.equal(fail!.failed_rule, TEMPLATE_VOICE_RULE_ID);

// --- gate passes case-specific (no wallpaper) ---
const cleanPage = {
  page: "decision_brief",
  page_title: "Why the full-time boundary sticks",
  page_subtitle: "Main path vs backup advisor path",
  core_judgment:
    "Partner already refused part-time; lock written equity before going full-time.",
  primary: {
    name: "Hold the hard gate",
    core_logic:
      "Based on your energy picture—the pattern of forces shaping how you choose—keep the full-time ask and write down vesting terms they already floated.",
    why: "Matches their stated expectation: equity in writing first.",
    when: "This week, before resigning.",
  },
  backup: {
    name: "Hourly advisory only",
    core_logic:
      "If they won't put terms in writing, switch to billed advisory and keep your job.",
    why: "Protects income while pressure stays high.",
    when: "If written terms slip past Friday.",
  },
} as unknown as DeliveryPageData;

const pass = gateBodyCategoryB({
  key: "decision_brief",
  page_schema: cleanPage,
  surface: "full",
});
assert.equal(pass, null);

// substance_only should NOT fire wallpaper (deferred to polish full)
const deferred = gateBodyCategoryB({
  key: "decision_brief",
  page_schema: wallpaperPage,
  surface: "substance_only",
});
assert.equal(deferred, null);

console.log("ok: template-voice #9 prompt + gate");
