/**
 * W0 · PageFeedMatrix skeleton, legacy remap, scare lexicon, empty rule cards.
 * Run: pnpm exec tsx scripts/test-page-feed-matrix-w0.ts
 */
import {
  textHitsScareRedline,
  CLEAR_RECOMMENDATION_ALLOWED_STEMS,
} from "../lib/llm/compliance/audit-output";
import { resolveDeliveryPipeline } from "../lib/llm/pro/delivery/pipeline-v3/flag";
import {
  APPENDIX_PAGE_ID,
  DECISION_PAGE_IDS,
  FEED,
  MAIN_NARRATIVE_PAGE_ORDER,
  PAGE_SEGMENT_ALLOWLISTS,
  PAGE_UNION_ALLOWLISTS,
  REQUIRED_MAIN_PAGE_IDS,
  sliceForPage,
  type DecisionPageId,
  type FeedFieldCode,
} from "../lib/llm/pro/delivery/page-feed-matrix";
import {
  FILL_DUTY_FILE_REMAP,
  LEGACY_PAGE_REMAP,
  contentPageIdForLegacyKey,
  remapRowForLegacyKey,
} from "../lib/llm/pro/delivery/page-id-remap";
import { contentPageForFillDuty } from "../lib/llm/pro/delivery/page-prompts";
import { RULE_CARDS } from "../lib/llm/pro/delivery/rule-card";
import { DeliveryPageSchemaByKey } from "../lib/llm/pro/delivery/page-schema/types";
import { canonicalizeDeliverySegmentKey, V1_DELIVERY_SEGMENT_KEYS } from "../lib/llm/pro/delivery/segment-key-alias";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function codes(list: readonly string[]): string {
  return [...list].sort().join("|");
}

assert(DECISION_PAGE_IDS.join(",") === "01,02,03,04,05,06,07,08", "eight page ids");
assert(MAIN_NARRATIVE_PAGE_ORDER.join(",") === "01,02,04,05,06,07,08", "main order skips 03");
assert(APPENDIX_PAGE_ID === "03", "03 is appendix");
assert(REQUIRED_MAIN_PAGE_IDS.join(",") === "01,02,04,05,06,08", "six required narrative pages");

const u01 = PAGE_UNION_ALLOWLISTS["01"];
assert(codes(u01.user) === codes([FEED.User.Q, FEED.User.expect]), "01 user");
assert(
  codes(u01.cfp) === codes([FEED.CFP.pathTags, FEED.CFP.yongJi, FEED.CFP.dayunNow, FEED.CFP.conflictAnchors]),
  "01 cfp",
);
assert(codes(u01.zfp) === codes([FEED.ZFP.topicPalace, FEED.ZFP.daxian]), "01 zfp");
assert(u01.sci === false, "01 sci off");

assert(PAGE_UNION_ALLOWLISTS["02"].sci === "yes", "02 sci");
assert(PAGE_UNION_ALLOWLISTS["04"].sci === "fold", "04 sci fold");
assert(PAGE_UNION_ALLOWLISTS["05"].sci === "optional", "05 sci optional");
assert(PAGE_UNION_ALLOWLISTS["03"].user.length === 0, "03 has no user fields");
assert(PAGE_UNION_ALLOWLISTS["03"].zfp.includes(FEED.ZFP.mingShen), "03 zfp mingShen");

const segmentUnion = (pageId: DecisionPageId): Set<FeedFieldCode> => {
  const allow = PAGE_UNION_ALLOWLISTS[pageId];
  return new Set<FeedFieldCode>([...allow.user, ...allow.cfp, ...allow.zfp, ...(allow.sci ? [FEED.Sci.hooks] : [])]);
};

for (const pageId of DECISION_PAGE_IDS) {
  const allowed = segmentUnion(pageId);
  for (const segment of PAGE_SEGMENT_ALLOWLISTS[pageId]) {
    for (const field of segment.fields) {
      assert(allowed.has(field), `${pageId}-${segment.id} field ${field} outside union`);
    }
    for (const field of segment.optionalFields) {
      assert(segment.fields.includes(field), `${pageId}-${segment.id} optional ${field} missing from fields`);
    }
  }
}

assert(
  PAGE_SEGMENT_ALLOWLISTS["05"].find((s) => s.id === "D")?.facts === "required",
  "05-D switch/stop required",
);
assert(PAGE_SEGMENT_ALLOWLISTS["03"].find((s) => s.id === "B")?.facts === "optional", "03-B skippable");

const omitted = sliceForPage("02");
assert(omitted.zfpOmitted === true, "missing zfp omits the group");
assert(!("zfp" in omitted.slice), "zfp key absent");
assert(!("cfp" in omitted.slice), "empty cfp group omitted");
assert(!("user" in omitted.slice), "empty user group omitted");
assert(!("sci" in omitted.slice), "sci omitted when hooks are missing");

const stable = sliceForPage("03", {
  zfp: {},
  cfp: { dayMaster: "甲木" },
});
assert(stable.zfpOmitted === true, "empty zfp object omits the group");
assert(!("zfp" in stable.slice), "empty zfp does not keep null slots");
assert(stable.slice.cfp?.dayMaster === "甲木", "explicit dayMaster is kept");
assert(stable.slice.cfp?.yongJi === undefined, "sibling cfp keys stay omitted");
assert(stable.slice.sci === undefined, "03 has no sci slot");

const keys = new Set(LEGACY_PAGE_REMAP.map((row) => row.legacyKey));
assert(keys.size === LEGACY_PAGE_REMAP.length, "remap keys unique");

for (const key of V1_DELIVERY_SEGMENT_KEYS) {
  const pageId = contentPageIdForLegacyKey(key);
  assert(pageId !== null, `v1 key ${key} maps to a page`);
}
assert(contentPageIdForLegacyKey("decision_brief") === "01", "brief → 01");
assert(contentPageIdForLegacyKey("direct_answer") === "01", "direct_answer → 01");
assert(contentPageIdForLegacyKey("foundation") === "02", "foundation → 02");
assert(contentPageIdForLegacyKey("science_action") === "06", "science_action → 06");
assert(contentPageIdForLegacyKey("metaphysics_action") === "06", "metaphysics_action → 06-C page");
assert(remapRowForLegacyKey("metaphysics_action")?.segment === "C", "metaphysics segment C");
assert(contentPageIdForLegacyKey("personal_decision_patterns") === "02", "patterns primary 02");
assert(remapRowForLegacyKey("personal_decision_patterns")?.alsoFeeds.includes("04") === true, "patterns also 04");
assert(contentPageIdForLegacyKey("appendix") === "03", "appendix → 03");
assert(contentPageIdForLegacyKey("thirty_day") === null, "thirty_day retired");
assert(contentPageIdForLegacyKey("rhythm") === null, "rhythm retired");
assert(contentPageIdForLegacyKey("preface") === "01", "preface → 01");
assert(remapRowForLegacyKey("a")?.pageId === "02", "letter a is old book key");

for (const schemaKey of Object.keys(DeliveryPageSchemaByKey)) {
  assert(remapRowForLegacyKey(schemaKey) !== null, `schema key ${schemaKey} is in remap`);
}

for (const duty of FILL_DUTY_FILE_REMAP) {
  assert(contentPageForFillDuty(duty.runtimeKey) === duty.pageId, `duty ${duty.file}`);
}

assert(canonicalizeDeliverySegmentKey("direct_answer") === "decision_brief", "runtime alias unchanged");
assert(canonicalizeDeliverySegmentKey("science_action") === "execution_guidance", "runtime science alias unchanged");
const pipelineEnv = { ...process.env };
delete pipelineEnv.DELIVERY_PIPELINE;
assert(resolveDeliveryPipeline(pipelineEnv) === "legacy", "pipeline default stays legacy");

assert(textHitsScareRedline("这段关系必散") === true, "必散");
assert(textHitsScareRedline("此年必死") === true, "必死");
assert(textHitsScareRedline("某年大祸") === true, "大祸");
assert(textHitsScareRedline("不听就败") === true, "不听就败");
assert(textHitsScareRedline("if you don't listen, you fail") === true, "en coercion");
assert(textHitsScareRedline("si no escuchas, fracasas") === true, "es coercion");
assert(textHitsScareRedline("本题更宜先稳住，条件是对方给出书面范围。") === false, "clear zh recommendation");
assert(textHitsScareRedline("Prefer path A when the budget holds.") === false, "clear en recommendation");
assert(textHitsScareRedline("硬扛成本高，更宜降档。") === false, "cost without scare");
assert(textHitsScareRedline("更宜降档，否则必死。") === true, "scare still hits beside 更宜");
for (const stem of CLEAR_RECOMMENDATION_ALLOWED_STEMS) {
  assert(textHitsScareRedline(stem) === false, `allowed stem ${stem}`);
}

assert(RULE_CARDS.length === 0, "rule cards empty");

console.log("page-feed-matrix W0 ok");
