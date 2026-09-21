/**
 * Global P2 discovery gates — a different chart from the lab partnership case.
 *   pnpm exec tsx scripts/test-discovery-claim-gate.ts
 */
import assert from "node:assert/strict";
import { foundationDiscoveryFailReason, repairDiscoveryCites } from "../lib/llm/pro/delivery/page-schema/discovery-claim-gate";

const pack = [
  "日主甲",
  "身强",
  "用神金",
  "喜水",
  "忌火土",
  "年柱 丙寅 天干丙 地支寅 十神食神 藏干甲、丙、戊 神煞无",
  "月柱 庚午 天干庚 地支午 十神七杀 藏干丁、己 神煞无",
  "日柱 甲子 天干甲 地支子 十神日主自身 藏干癸 神煞无",
  "时柱 乙亥 天干乙 地支亥 十神劫财 藏干壬、甲 神煞无",
  "本盘合冲刑害：子午相冲",
  "当前大运：戊辰（28岁起）",
  "当前流年：辛酉",
].join("\n");

const citeMonth = "月柱 庚午 天干庚 地支午 十神七杀 藏干丁、己 神煞无";
const citeClash = "本盘合冲刑害：子午相冲";
const citeLuck = "当前大运：戊辰（28岁起）";
const citeYear = "当前流年：辛酉";

{
  const reason = foundationDiscoveryFailReason(
    [
      {
        path: "why_cards[0]",
        unit_claim: "月柱天干庚为七杀，克日主甲",
        calc_cite: citeMonth,
      },
      {
        path: "why_cards[1]",
        unit_claim: "日支子与月支午相冲",
        calc_cite: citeClash,
      },
    ],
    pack,
  );
  assert.equal(reason, null);
}

{
  const reason = foundationDiscoveryFailReason(
    [
      {
        path: "why_cards[0]",
        unit_claim: "月柱天干庚为七杀，克日主甲，因此夜里一直睡不着",
        calc_cite: citeMonth,
      },
    ],
    pack,
  );
  assert.equal(reason, "assign:claim_life_tail:why_cards[0]");
}

{
  const reason = foundationDiscoveryFailReason(
    [
      {
        path: "why_cards[0]",
        unit_claim: "月柱天干庚为七杀，克日主甲",
        calc_cite: "月柱庚七杀克身，所以工作压得很重",
      },
    ],
    pack,
  );
  assert.equal(reason, "assign:cite_not_in_pack:why_cards[0]");
}

{
  const reason = foundationDiscoveryFailReason(
    [
      {
        path: "why_cards[0]",
        unit_claim: citeMonth,
        calc_cite: citeMonth,
      },
    ],
    pack,
  );
  assert.equal(reason, "assign:cite_equals_claim:why_cards[0]");
}

{
  const reason = foundationDiscoveryFailReason(
    [
      {
        path: "why_cards[0]",
        unit_claim: "大运戊辰七杀当令，克日主甲",
        calc_cite: citeLuck,
      },
    ],
    pack,
  );
  assert.equal(reason, "assign:luck_ten_god_collapse:why_cards[0]:戊辰");
}

{
  const sharedPack = [
    pack,
    "月柱 丙午 天干丙 地支午 十神正印 藏干丁、己 神煞无",
    "当前流年：丙午",
  ].join("\n");
  const reason = foundationDiscoveryFailReason(
    [
      {
        path: "why_cards[0]",
        unit_claim: "月柱丙午正印，地支午与日支子相冲",
        calc_cite: "月柱 丙午 天干丙 地支午 十神正印 藏干丁、己 神煞无",
      },
    ],
    sharedPack,
  );
  assert.equal(reason, null);
  const collapsed = foundationDiscoveryFailReason(
    [
      {
        path: "why_cards[0]",
        unit_claim: "流年丙午正印，克日主甲",
        calc_cite: "当前流年：丙午",
      },
    ],
    sharedPack,
  );
  assert.equal(collapsed, "assign:luck_ten_god_collapse:why_cards[0]:丙午");
}

{
  const reason = foundationDiscoveryFailReason(
    [
      {
        path: "why_cards[0]",
        unit_claim: "日支子为配偶宫，与月支午相冲",
        calc_cite: citeClash,
      },
    ],
    pack,
  );
  assert.equal(reason, "assign:palace_not_in_pack:why_cards[0]:配偶宫");
}

{
  const reason = foundationDiscoveryFailReason(
    [
      {
        path: "why_cards[0]",
        unit_claim: "流年天干辛为七杀，克时柱乙劫财",
        calc_cite: citeYear,
      },
      {
        path: "why_cards[1]",
        unit_claim: "流年天干辛为七杀，克时柱劫财",
        calc_cite: "时柱 乙亥 天干乙 地支亥 十神劫财 藏干壬、甲 神煞无",
      },
    ],
    pack,
  );
  assert.equal(reason, "assign:claim_same_relation:why_cards[0]:why_cards[1]");
}

{
  const reason = foundationDiscoveryFailReason(
    [
      {
        path: "why_cards[0]",
        unit_claim: "月柱天干庚为七杀，克日主甲",
        calc_cite: citeMonth,
      },
      {
        path: "why_cards[1]",
        unit_claim: "时柱天干乙为劫财，帮日主甲",
        calc_cite: "时柱 乙亥 天干乙 地支亥 十神劫财 藏干壬、甲 神煞无",
      },
    ],
    pack,
  );
  assert.equal(reason, null);
}

{
  const reason = foundationDiscoveryFailReason(
    [
      {
        path: "why_cards[0]",
        unit_claim: "月柱天干丙为食神，生藏干中的偏财",
        calc_cite: "年柱 丙寅 天干丙 地支寅 十神食神 藏干甲、丙、戊 神煞无",
      },
      {
        path: "why_cards[1]",
        unit_claim: "时柱天干乙为食神，生藏干中的偏财",
        calc_cite: "时柱 乙亥 天干乙 地支亥 十神劫财 藏干壬、甲 神煞无",
      },
    ],
    pack,
  );
  assert.equal(reason, null);
}

{
  const duplicated = "日支子与月支午相冲，子午相冲，日主甲受月支所冲。";
  const repaired = repairDiscoveryCites(
    [
      {
        path: "why_cards[0]",
        unit_claim: duplicated,
        calc_cite: duplicated,
      },
    ],
    pack,
  );
  assert.equal(repaired[0]?.calc_cite, "子午相冲");
  assert.equal(
    foundationDiscoveryFailReason(repaired, pack),
    null,
  );
}

{
  const waterPack = ["用神：水", "忌神：火、土", "本盘合冲刑害：子午相冲"].join("\n");
  const units = repairDiscoveryCites(
    [
      {
        path: "why_cards[0]",
        unit_claim: "火旺为忌神，克制用神水，子午相冲",
        calc_cite: "火旺为忌神，克制用神水，子午相冲",
      },
    ],
    waterPack,
  );
  assert.equal(
    foundationDiscoveryFailReason(units, waterPack),
    "assign:cycle_reversed:element:why_cards[0]",
  );
}

{
  const metalPack = ["用神：金", "本盘合冲刑害：子午相冲"].join("\n");
  const units = [
    {
      path: "why_cards[0]",
        unit_claim: "食神生偏财，财星克正印",
      calc_cite: "本盘合冲刑害：子午相冲",
    },
  ];
  assert.equal(foundationDiscoveryFailReason(units, metalPack), null);
  const reversed = [
    {
      path: "why_cards[0]",
      unit_claim: "食神克正印",
      calc_cite: "本盘合冲刑害：子午相冲",
    },
  ];
  assert.equal(
    foundationDiscoveryFailReason(reversed, metalPack),
    "assign:cycle_reversed:ten_god:why_cards[0]",
  );
}

console.log("test-discovery-claim-gate: ok");
