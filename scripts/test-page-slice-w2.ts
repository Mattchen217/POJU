/**
 * W2 · sliceForPage allowlist, omit rules, 01–08 schema bridge.
 * Run: pnpm test:page-slice-w2
 */
import type { BirthInfo } from "../lib/profile/types";
import type { ChartFactPack } from "../lib/llm/pro/delivery/page-schema/chart-fact-pack";
import {
  DECISION_PAGE_IDS,
  PAGE_SEGMENT_ALLOWLISTS,
  sliceDumpKeys,
  sliceFieldCodes,
  sliceForPage,
  sliceStaysInAllowlist,
  type DecisionPageId,
  type PageSliceResult,
} from "../lib/llm/pro/delivery/page-feed-matrix";
import { page07Applies, readingOrderForTopic } from "../lib/llm/pro/delivery/slice-for-page";
import { DECISION_PAGE_SCHEMAS } from "../lib/llm/pro/delivery/page-schema/decision-pages";
import {
  primaryShelfKeyForPage,
  resolveDecisionPage,
  shelfKeysForPage,
} from "../lib/llm/pro/delivery/decision-page-bridge";
import { DELIVERY_SHELF_SLOT_IDS } from "../lib/poju/delivery-shelf-slots";
import { buildZiweiFactPack } from "../lib/ziwei/fact-pack";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const GOLDEN_BIRTH: BirthInfo = {
  year: 2000,
  month: 8,
  day: 16,
  hour: 4,
  minute: 30,
  hour_period: "yin",
  gender: "F",
  timezone: "Asia/Shanghai",
};

const chart: ChartFactPack = {
  day_master: "甲木",
  ganzhi: ["甲子", "丙午"],
  shen_sha: ["天乙"],
  text: [
    "日主：甲木（身强）",
    "用神：水",
    "喜神：金",
    "忌神：火",
    "用神水",
    "喜金",
    "忌火",
    "年柱 甲子 天干甲 地支子 十神比肩 藏干癸 神煞天乙 FULLCHART_CANARY",
    "本盘合冲刑害：子午相冲",
    "当前大运：庚午（30岁起）",
    "当前流年：丙午",
    "当前流月：壬辰",
  ].join("\n"),
};

const ziwei = buildZiweiFactPack(GOLDEN_BIRTH, { asOf: "2026-10-27" });

const packs = {
  chart,
  cfp: {
    pathTags: ["换城", "留守"],
    conflictAnchors: "留守会拖主线",
    shishenHit: "比肩争",
  },
  zfp: ziwei,
  user: { Q: "要不要换城", expect: "两年内稳定", detail: "不能裸辞" },
  sci: { hooks: ["选择负荷"] },
  topic: "general" as const,
};

function keysOf(group: object | undefined): string[] {
  return group ? Object.keys(group).sort() : [];
}

function summarize(result: PageSliceResult): string {
  const slice = result.slice;
  const topic = slice.zfp?.topicPalace;
  const palace = topic && typeof topic === "object" ? `${topic.palace}:${topic.majorStars.join("/")}` : "—";
  const daxian = slice.zfp?.daxian;
  const limit = daxian && typeof daxian === "object" ? `${daxian.palace}:${daxian.majorStars.join("/")}` : "—";
  const dayun = typeof slice.cfp?.dayunNow === "string" ? slice.cfp.dayunNow : "—";
  return [
    result.pageId,
    `cfp[${keysOf(slice.cfp).join(",") || "—"}]`,
    `zfp[${keysOf(slice.zfp).join(",") || "—"}]`,
    `user[${keysOf(slice.user).join(",") || "—"}]`,
    `sci[${slice.sci ? "hooks" : "—"}]`,
    `topic=${palace}`,
    `daxian=${limit}`,
    `dayun=${dayun}`,
  ].join(" ");
}

function banned(result: PageSliceResult): void {
  const json = JSON.stringify(result.slice);
  assert(!json.includes("FULLCHART_CANARY"), `${result.pageId} leaked pillar canary`);
  assert(!json.includes("当前流年"), `${result.pageId} leaked 流年 line`);
  assert(!json.includes("当前流月"), `${result.pageId} leaked 流月 line`);
  assert(!json.includes("子午相冲"), `${result.pageId} leaked 合冲 line`);
  assert(!json.includes("用神水"), `${result.pageId} leaked compact 用神 line`);
  assert(sliceDumpKeys(result.slice).length === 0, `${result.pageId} dump keys ${sliceDumpKeys(result.slice).join(",")}`);
  assert(sliceStaysInAllowlist(result.pageId, result.slice), `${result.pageId} left the allowlist`);
  const topic = result.slice.zfp?.topicPalace;
  if (topic && typeof topic === "object") {
    assert(!("role" in topic), `${result.pageId} topicPalace kept role`);
  }
}

for (const pageId of DECISION_PAGE_IDS) {
  const schema = DECISION_PAGE_SCHEMAS[pageId];
  const allowIds = PAGE_SEGMENT_ALLOWLISTS[pageId].map((segment) => segment.id).join(",");
  assert(schema.segments.map((segment) => segment.id).join(",") === allowIds, `${pageId} segment ids`);
  const sliced = sliceForPage(pageId, packs);
  banned(sliced);
  assert(sliceFieldCodes(sliced.slice).length > 0, `${pageId} slice empty`);
}

const page01 = sliceForPage("01", packs);
const page02 = sliceForPage("02", packs);
const page05 = sliceForPage("05", packs);
const page06 = sliceForPage("06", packs);
const page08 = sliceForPage("08", packs);
const page03 = sliceForPage("03", packs);
const page07 = sliceForPage("07", { ...packs, topic: "relationship" });

assert(keysOf(page01.slice.cfp).join(",") === "conflictAnchors,dayunNow,pathTags,yongJi", "01 cfp keys");
assert(page01.slice.cfp?.dayMaster === undefined, "01 omits dayMaster");
assert(keysOf(page01.slice.zfp).join(",") === "daxian,topicPalace", "01 zfp keys");
assert(keysOf(page01.slice.user).join(",") === "Q,expect", "01 user keys");
assert(page01.slice.sci === undefined, "01 omits sci");
const topic01 = page01.slice.zfp?.topicPalace;
assert(typeof topic01 === "object" && topic01.majorStars.includes("紫微"), "01 topic 紫微");
assert(!JSON.stringify(page01.slice).includes("破军"), "01 omits mingShen");
assert(!JSON.stringify(page01.slice).includes("木三局"), "01 omits 五行局");
assert(String(page01.slice.cfp?.dayunNow).includes("庚午"), "01 dayun");
assert(!String(page01.slice.cfp?.dayunNow).includes("丙午"), "01 dayun is not 流年");

assert(page02.slice.cfp?.dayMaster === "甲木", "02 dayMaster");
assert(page02.slice.cfp?.shishenHit === "比肩争", "02 shishen override");
assert(String(page02.slice.cfp?.yongJi).includes("用神：水"), "02 yongJi");
const topic02 = page02.slice.zfp?.topicPalace;
assert(typeof topic02 === "object" && topic02.palace === "命宫", "02 topic palace");
assert(JSON.stringify(page02.slice.zfp?.sihua).includes("天同"), "02 sihua");
assert(!JSON.stringify(page02.slice).includes("破军"), "02 omits 命主");
assert(page02.slice.sci?.hooks === "选择负荷" || (Array.isArray(page02.slice.sci?.hooks) && page02.slice.sci.hooks[0] === "选择负荷"), "02 sci");
assert(page02.slice.user?.detail === "不能裸辞", "02 detail");

assert(page05.slice.user?.Q === undefined, "05 omits Q");
assert(page05.slice.user?.detail === "不能裸辞", "05 detail");
assert(Array.isArray(page05.slice.cfp?.pathTags), "05 pathTags");
assert(page05.slice.cfp?.conflictAnchors === "留守会拖主线", "05 conflict");
assert(keysOf(page05.slice.zfp).join(",") === "daxian,sihua,topicPalace", "05 zfp keys");
assert(page05.slice.sci !== undefined, "05 keeps optional sci when provided");
assert(PAGE_SEGMENT_ALLOWLISTS["05"].some((segment) => segment.id === "D" && segment.facts === "required"), "05-D");

assert(keysOf(page06.slice.cfp).join(",") === "dayunNow", "06 only dayunNow");
assert(!JSON.stringify(page06.slice).includes("甲木"), "06 omits dayMaster");
assert(keysOf(page06.slice.zfp).join(",") === "daxian", "06 only daxian");
const daxian06 = page06.slice.zfp?.daxian;
assert(typeof daxian06 === "object" && daxian06.majorStars.includes("七杀"), "06 daxian 七杀");
assert(!JSON.stringify(page06.slice).includes("紫微"), "06 omits 命宫主星");
assert(page06.slice.user?.Q === "要不要换城" && page06.slice.user.detail === "不能裸辞", "06 user");
assert(page06.slice.sci !== undefined, "06 sci");

assert(keysOf(page08.slice.cfp).join(",") === "dayunNow,shishenHit", "08 cfp keys");
assert(keysOf(page08.slice.zfp).join(",") === "sihua", "08 sihua only");
assert(page08.slice.sci === undefined, "08 omits sci");
assert(page08.slice.user?.detail === undefined, "08 omits detail");
assert(!JSON.stringify(page08.slice).includes("紫微"), "08 sihua has no 命宫主星");
assert(!JSON.stringify(page08.slice).includes("丙午"), "08 does not carry 流年干支");

const ming = page03.slice.zfp?.mingShen;
assert(typeof ming === "object" && ming.soul === "破军" && ming.fiveElementsClass === "木三局", "03 mingShen");
assert(page03.slice.sci === undefined, "03 omits sci");
assert(page03.slice.user === undefined, "03 omits user");

assert(page07.slice.zfp?.otherChart === undefined, "07 omits null otherChart");
const topic07 = page07.slice.zfp?.topicPalace;
assert(typeof topic07 === "object" && topic07.palace === "夫妻", "07 relationship retargets 夫妻");

const career = sliceForPage("01", { ...packs, topic: "career_move" });
const careerTopic = career.slice.zfp?.topicPalace;
assert(
  typeof careerTopic === "object" && careerTopic !== null && careerTopic.palace === "官禄" && careerTopic.oppositePalace.length > 0,
  "career_move → 官禄",
);

for (const pageId of ["01", "02", "05", "06", "08"] as const) {
  const bare = sliceForPage(pageId, { chart, user: packs.user });
  assert(bare.zfpOmitted === true && !("zfp" in bare.slice), `${pageId} omits missing zfp`);
  const empty = sliceForPage(pageId, { zfp: {} });
  assert(empty.zfpOmitted === true, `${pageId} empty zfp object omits`);
}

const noSci = sliceForPage("02", { chart, zfp: ziwei, sci: { hooks: "  " } });
assert(noSci.slice.sci === undefined, "blank hooks omitted");
const forced = sliceForPage("01", { ...packs, sci: { hooks: ["不该出现"] } });
assert(forced.slice.sci === undefined, "sci false drops hooks");

assert(readingOrderForTopic("general").join(",") === "01,02,04,05,06,08,03", "general order");
assert(readingOrderForTopic("relationship").join(",") === "01,02,04,05,06,07,08,03", "relationship inserts 07");
assert(page07Applies("career_move") && page07Applies("迁移") && page07Applies("joint"), "07 topics");
assert(!page07Applies("general") && !page07Applies("官禄") && !page07Applies(null), "07 stays shut");

assert(DECISION_PAGE_SCHEMAS["07"].topicGated === true, "07 gated");
assert(DECISION_PAGE_SCHEMAS["03"].placement === "appendix" && DECISION_PAGE_SCHEMAS["03"].dualTrack === "appendix", "03 appendix");
assert(DECISION_PAGE_SCHEMAS["01"].dualTrack === "pointer", "01 pointer");
assert(DECISION_PAGE_SCHEMAS["02"].dualTrack === "abc", "02 abc");
assert(DECISION_PAGE_SCHEMAS["06"].dualTrack === "reality", "06 reality");
assert(DECISION_PAGE_SCHEMAS["08"].dualTrack === "reality", "08 reality");

const brief = resolveDecisionPage("decision_brief");
assert(brief?.pageId === "01" && brief.primaryShelfKey === "decision_brief", "brief → 01");
assert(resolveDecisionPage("thirty_day") === null, "thirty_day stays retired");
assert(resolveDecisionPage("01")?.pageId === "01", "page id resolves");
assert(resolveDecisionPage("self_regulation")?.segment === "C", "调频 → 06-C");
assert(primaryShelfKeyForPage("06") === "execution_guidance", "06 primary shelf key");
assert(shelfKeysForPage("06").includes("self_regulation"), "06 still has the regulation paper");
assert(shelfKeysForPage("07").length === 0, "07 has no shelf slot");
assert(DELIVERY_SHELF_SLOT_IDS[0] === "cover", "shelf still starts at cover");
assert(DELIVERY_SHELF_SLOT_IDS.includes("decision_brief"), "shelf still uses v1 keys");
assert(!(DELIVERY_SHELF_SLOT_IDS as readonly string[]).includes("01"), "shelf is not renumbered");

for (const pageId of ["01", "02", "05", "06", "08"] as const satisfies readonly DecisionPageId[]) {
  console.log(summarize(sliceForPage(pageId, packs)));
}
console.log(`career01 ${summarize(career)}`);
console.log("page-slice W2 ok");
