/**
 * Lab soft-stage → decision-report reader exit.
 * Soft four-stage dump stays Lab-only; mergeReaderEvidenceProse is the report UI surface
 * (no 【能量配置】/【科学】/【交汇】 chrome).
 */
import assert from "node:assert/strict";
import { mergeLabSoftStageReaderProse } from "../lib/llm/pro/delivery/lab/lab-reader-evidence-preview";
import {
  mergeReaderEvidenceProse,
  readerEvidenceHasTrackChrome,
} from "../lib/llm/pro/delivery/page-schema/reader-evidence-prose";
import { toSoftTranslatedPlainText } from "../lib/llm/sanitize/compliance-terms";
import { encodeTermMarker } from "../lib/llm/sanitize/term-marking";

const softStages = {
  "02": [
    { title: "destiny_reason", evidence: "【能量配置】日主偏弱，印星牵制本案窗口。" },
    { title: "science_mechanism", evidence: "【科学】工作记忆负荷过高时，你会推迟收集事实。" },
    { title: "convergence", evidence: "【交汇】命盘窗口与认知负荷同向：先缩小决策面再验证。" },
    { title: "verifiable_anchors", evidence: "【能量配置】本周可核对：是否仍把核对拖到会后。" },
  ],
};

const prose = mergeLabSoftStageReaderProse(softStages, "zh");
assert.ok(prose.length > 0, "merged prose non-empty");
assert.equal(readerEvidenceHasTrackChrome(prose), false, "no track chrome helper");
assert.equal(prose.includes("【能量配置】"), false, "no 能量配置 chrome");
assert.equal(prose.includes("【科学】"), false, "no 科学 chrome");
assert.equal(prose.includes("【交汇】"), false, "no 交汇 chrome");
assert.ok(prose.includes("日主偏弱") || prose.includes("印星"), "destiny kept");
assert.ok(prose.includes("工作记忆") || prose.includes("负荷"), "science kept");
assert.ok(prose.includes("同向") || prose.includes("决策"), "convergence kept");
assert.ok(prose.includes("可核对") || prose.includes("会后"), "D anchors kept");

// Same SoT as report: direct merge must also strip chrome.
const direct = mergeReaderEvidenceProse({
  metaphysics: softStages["02"][0]!.evidence,
  science: softStages["02"][1]!.evidence,
  convergence: softStages["02"][2]!.evidence,
  locale: "zh",
});
assert.equal(readerEvidenceHasTrackChrome(direct), false);
assert.equal(direct.includes("【能量配置】"), false);
assert.equal(direct.includes("【科学】"), false);
assert.equal(direct.includes("【交汇】"), false);


// --- Bug A: hard-paste after marker strip (adjacent softs need connective) ---
{
  const mJi = encodeTermMarker("unfavorable_element", "耗元");
  const mYong = encodeTermMarker("yong_shen", "锚元");
  const adjacentMarked = `金土${mJi}${mYong}再看窗口`;
  const softAdjacent = toSoftTranslatedPlainText(adjacentMarked, "zh");
  assert.ok(softAdjacent.includes("耗元"), `soft has 耗元: ${softAdjacent}`);
  assert.ok(softAdjacent.includes("锚元"), `soft has 锚元: ${softAdjacent}`);
  assert.equal(softAdjacent.includes("耗元锚元"), false, `no hard-paste 耗元锚元: ${softAdjacent}`);

  const alreadyPasted = "金土耗元锚元再看窗口";
  const repaired = mergeReaderEvidenceProse({ text: alreadyPasted, locale: "zh" });
  assert.equal(repaired.includes("耗元锚元"), false, `merge repairs hard-paste: ${repaired}`);
  assert.ok(repaired.includes("耗元") && repaired.includes("锚元"), `merge keeps softs: ${repaired}`);
}

// --- Bug B: traditional+soft stack 命宫核心定位域 must not leak to reader ---
{
  const stack = "本案关键看命宫核心定位域的落点。";
  const softStack = toSoftTranslatedPlainText(stack, "zh");
  assert.equal(softStack.includes("命宫核心定位域"), false, `no trad+soft stack: ${softStack}`);
  assert.equal(softStack.includes("命宫"), false, `no bare 命宫: ${softStack}`);
  assert.ok(softStack.includes("核心定位域"), `soft-only 核心定位域: ${softStack}`);

  const bareMing = "本案关键看命宫的落点。";
  const softMing = toSoftTranslatedPlainText(bareMing, "zh");
  assert.equal(softMing.includes("命宫"), false, `bare 命宫 soft-translated: ${softMing}`);
  assert.ok(softMing.includes("核心定位域"), `bare 命宫 → 核心定位域: ${softMing}`);
}


// --- Max 2026-11-02 production fragments: must not survive soft/reader exit ---
{
  const mash = "把这些合在一起看，金土耗元截伐锚元与损失厌恶同向";
  const softMash = toSoftTranslatedPlainText(mash, "zh");
  assert.equal(softMash.includes("截伐"), false, `reader soft no 截伐: ${softMash}`);
  assert.equal(softMash.includes("耗元截伐锚元"), false, `reader soft no jam: ${softMash}`);
  assert.ok(softMash.includes("耗元") && softMash.includes("锚元"), softMash);
  // Soft labels may remain; traditional+own-soft STACKS and EN/ZH mixed stacks must not.
  assert.equal(softMash.includes("命宫核心定位域"), false);

  const stackZh = "核心定位域与流动切换域对拱令显隐冲突放大";
  // Coined soft-only is OK; trad+soft stack is not.
  const softOnly = toSoftTranslatedPlainText("命宫核心定位域与流动切换域", "zh");
  assert.equal(softOnly.includes("命宫核心定位域"), false, `no trad+soft: ${softOnly}`);
  assert.equal(softOnly.includes("命宫"), false, `no bare 命宫: ${softOnly}`);
  assert.ok(softOnly.includes("核心定位域"), `keeps soft 核心定位域: ${softOnly}`);

  const softEnStack = toSoftTranslatedPlainText("命宫核心定位域", "en");
  assert.equal(
    softEnStack.includes("CoreIdentityField核心定位域"),
    false,
    `no EN+ZH soft stack: ${softEnStack}`,
  );
  assert.equal(softEnStack.includes("核心定位域"), false, `EN soft drops zh soft: ${softEnStack}`);
  assert.equal(softEnStack.includes("命宫"), false, `EN soft drops 命宫: ${softEnStack}`);
  assert.ok(
    softEnStack.includes("CoreIdentityField") || softEnStack.includes("Core Identity"),
    `EN soft identity field: ${softEnStack}`,
  );

  // Exact Max mash with markers → soft must not hard-paste 耗元锚元; EN must not be zh-connective-only table swap proof via polish elsewhere.
  const mJi = encodeTermMarker("unfavorable_element", "耗元");
  const mYong = encodeTermMarker("yong_shen", "锚元");
  const markedMash = `金土${mJi}截伐${mYong}`;
  const softMarkedZh = toSoftTranslatedPlainText(markedMash, "zh");
  assert.ok(softMarkedZh.includes("耗元") && softMarkedZh.includes("锚元"), softMarkedZh);
  assert.equal(softMarkedZh.includes("耗元锚元"), false, `no abut hard-paste: ${softMarkedZh}`);
  assert.equal(softMarkedZh.includes("截伐"), false, `marked mash rewrites 截伐: ${softMarkedZh}`);
  assert.equal(
    softMarkedZh.includes("耗元截伐锚元"),
    false,
    `marked mash no classical jam: ${softMarkedZh}`,
  );

  const mCai = encodeTermMarker("zw_resource_flow_field", "资源流转域");
  const mTu = encodeTermMarker("earth", "承托");
  const echoPlain = toSoftTranslatedPlainText(`${mCai}资源流转${mTu}偏薄`, "zh");
  assert.equal(
    echoPlain.includes("资源流转域资源流转"),
    false,
    `no prefix echo: ${echoPlain}`,
  );

  const anchors = toSoftTranslatedPlainText(
    "日主庚充沛而用木，月令巳火本有调候偏燥，气口不在强弱",
    "zh",
  );
  assert.equal(anchors.includes("庚") || anchors.includes("巳火") || anchors.includes("用木"), false, anchors);
  const mergedAnchors = mergeReaderEvidenceProse({ text: anchors, locale: "zh" });
  assert.equal(
    mergedAnchors.includes("庚") || mergedAnchors.includes("巳火") || mergedAnchors.includes("用木"),
    false,
    mergedAnchors,
  );
  const softMarkedEn = toSoftTranslatedPlainText(markedMash, "en");
  assert.equal(
    softMarkedEn.includes("CoreIdentityField核心定位域"),
    false,
    softMarkedEn,
  );
}


// --- Max 2026-11-02: hide ZFP pattern closed refs from reader soft/merge ---
{
  const sample =
    "本案窗口（hit:e044e7cdde6d:good）与负荷同向 (hit:abc123:weak)。";
  const soft = toSoftTranslatedPlainText(sample, "zh");
  assert.equal(soft.includes("hit:"), false, `soft no hit: ${soft}`);
  assert.equal(soft.includes("e044e7cdde6d"), false, `soft no id: ${soft}`);
  assert.equal(soft.includes("（）"), false, `soft no empty fullwidth parens: ${soft}`);
  assert.equal(soft.includes("()"), false, `soft no empty ascii parens: ${soft}`);
  assert.ok(soft.includes("本案窗口"), `soft keeps 本案窗口: ${soft}`);
  assert.ok(soft.includes("与负荷同向"), `soft keeps 与负荷同向 (must not eat CJK after paren): ${soft}`);

  const merged = mergeReaderEvidenceProse({ text: sample, locale: "zh" });
  assert.equal(merged.includes("hit:"), false, `merge no hit: ${merged}`);
  assert.equal(merged.includes("e044e7cdde6d"), false, `merge no id: ${merged}`);

  const lab = mergeLabSoftStageReaderProse(
    {
      "02": [
        { title: "destiny_reason", evidence: "日主偏弱（hit:e044e7cdde6d:good）。" },
        { title: "science_mechanism", evidence: "负荷过高。" },
        { title: "convergence", evidence: "同向。" },
      ],
    },
    "zh",
  );
  assert.equal(lab.includes("hit:"), false, `lab preview no hit: ${lab}`);
  assert.equal(lab.includes("e044e7cdde6d"), false, `lab preview no id: ${lab}`);
  assert.ok(lab.includes("日主偏弱"), `lab keeps destiny prose: ${lab}`);
}


// --- Max 2026-11-02: EN/ES/FR labeled soft tracks → one prose + D fold (no 【chrome】) ---
{
  const enSoft = {
    "02": [
      {
        title: "destiny_reason",
        evidence:
          "【life trajectory analysis】Anchor Wood is under the metal energy of Transit and is cut down by the Drainer metal. Its need to grow into visible form is strong, but the resource flow in Resource Flow Field is too thin to support it. CoreIdentityField and Mobility Field oppose each other, which magnifies the open-versus-hidden conflict.",
      },
      {
        title: "science_mechanism",
        evidence:
          "【Science】The user reports being caught between a stable career and an unverified direction. The two-system conflict makes the safety signal overvalued and the growth signal discounted as a distant payoff.",
      },
      {
        title: "convergence",
        evidence:
          "【Intersection】Metal and earth, the Drainer, cut down the Anchor wood. This runs in the same direction as loss aversion, so reluctance to act shows up as overvaluing current security and undervaluing unverified opportunities.",
      },
      {
        title: "verifiable_anchors",
        evidence:
          "【life trajectory analysis】Checkable anchor: Core, Geng, is Abundant and uses wood. In the MonthLead, the Kindle has an inherent Climatic Alignment that is dry.",
      },
    ],
  };
  const en = mergeLabSoftStageReaderProse(enSoft, "en");
  assert.ok(en.length > 0, `EN prose non-empty: ${en}`);
  assert.equal(readerEvidenceHasTrackChrome(en), false, `EN no track chrome: ${en}`);
  assert.equal(en.includes("【"), false, `EN no 【 chrome: ${en}`);
  assert.equal(en.includes("】"), false, `EN no 】 chrome: ${en}`);
  assert.equal(/life trajectory analysis/i.test(en), false, `EN no raw track title: ${en}`);
  assert.equal(/\bIntersection\b/.test(en), false, `EN no Intersection title: ${en}`);
  assert.equal(/Checkable anchor/i.test(en), false, `EN no Checkable anchor chrome: ${en}`);
  assert.ok(en.includes("Anchor Wood"), `EN keeps destiny prose: ${en}`);
  assert.ok(en.includes("stable career") || en.includes("safety signal"), `EN keeps science: ${en}`);
  assert.ok(en.includes("loss aversion") || en.includes("Anchor wood"), `EN keeps convergence: ${en}`);
  assert.ok(en.includes("At the same time") || en.includes("at the same time"), `EN mid joiner: ${en}`);
  assert.ok(en.includes("Taken together") || en.includes("taken together"), `EN close joiner: ${en}`);
  assert.ok(en.includes("\n\n"), `EN D is second paragraph: ${en}`);
  const enParas = en.split(/\n\n+/);
  assert.ok(enParas.length >= 2, `EN A/B/C + D paragraphs: ${en}`);
  assert.ok(
    enParas[1]!.includes("Core") || enParas[1]!.includes("Abundant") || enParas[1]!.includes("MonthLead"),
    `EN D anchors body: ${enParas[1]}`,
  );
  // Soft coined terms may remain (dual-layer).
  assert.ok(
    en.includes("CoreIdentityField") || en.includes("Resource Flow Field") || en.includes("Mobility Field"),
    `EN soft coined terms kept: ${en}`,
  );

  const esSoft = {
    "02": [
      { title: "destiny_reason", evidence: "【Base metafísica】La madera ancla está bajo presión." },
      { title: "science_mechanism", evidence: "【Base científica】El usuario valora demasiado la seguridad actual." },
      { title: "convergence", evidence: "【Convergencia】Ambas pistas empujan a posponer la verificación." },
      { title: "verifiable_anchors", evidence: "【Anclas verificables】Núcleo abundante; revisar el flujo este mes." },
    ],
  };
  const es = mergeLabSoftStageReaderProse(esSoft, "es");
  assert.equal(readerEvidenceHasTrackChrome(es), false, `ES no chrome: ${es}`);
  assert.equal(es.includes("【"), false, `ES no 【: ${es}`);
  assert.equal(/Base metafísica|Base científica|Convergencia|Anclas verificables/i.test(es), false, es);
  assert.ok(es.includes("Al mismo tiempo") || es.includes("madera ancla"), `ES joiner/body: ${es}`);
  assert.ok(es.includes("\n\n"), `ES D second para: ${es}`);

  const frSoft = {
    "02": [
      { title: "destiny_reason", evidence: "【Fondement métaphysique】Le bois d'ancrage est sous pression." },
      { title: "science_mechanism", evidence: "【Fondement scientifique】L'utilisateur surestime la sécurité actuelle." },
      { title: "convergence", evidence: "【Convergence】Les deux pistes poussent à différer la vérification." },
      { title: "verifiable_anchors", evidence: "【Ancres vérifiables】Noyau abondant; vérifier le flux ce mois-ci." },
    ],
  };
  const fr = mergeLabSoftStageReaderProse(frSoft, "fr");
  assert.equal(readerEvidenceHasTrackChrome(fr), false, `FR no chrome: ${fr}`);
  assert.equal(fr.includes("【"), false, `FR no 【: ${fr}`);
  assert.equal(
    /Fondement métaphysique|Fondement scientifique|Ancres vérifiables/i.test(fr),
    false,
    fr,
  );
  assert.ok(fr.includes("En même temps") || fr.includes("bois d'ancrage"), `FR joiner/body: ${fr}`);
  assert.ok(fr.includes("\n\n"), `FR D second para: ${fr}`);

  // Legacy combined EN string (single text) must also merge without chrome.
  const combined = mergeReaderEvidenceProse({
    text:
      "【life trajectory analysis】Wood is pressured.\n【Science】Safety is overvalued.\n【Intersection】Both point to delay.",
    locale: "en",
  });
  assert.equal(readerEvidenceHasTrackChrome(combined), false, combined);
  assert.equal(combined.includes("【"), false, combined);
  assert.ok(combined.includes("Wood is pressured"), combined);
  assert.ok(combined.includes("At the same time"), combined);
  assert.ok(combined.includes("Taken together"), combined);
}


console.log("test-lab-reader-evidence-preview: ok");
