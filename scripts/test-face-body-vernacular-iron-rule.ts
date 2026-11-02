/**
 * Face body vernacular iron rule (2026-11-01 Max).
 * Lab Face 02 #6 lab_mvteq2kh: machine PASS / human FAIL on soft projections + elemental jargon.
 */
import assert from "node:assert/strict";
import {
  FACE_BODY_SURFACE_RULE_ID,
  faceVisibleBodyBlob,
  findFaceBodySurfaceHit,
  gateFaceBodySurface,
} from "../lib/llm/pro/delivery/pipeline-v3/gate-face-body-surface";
import { gateBodyCategoryB } from "../lib/llm/pro/delivery/pipeline-v3/gate-body-category";

function face02(over: Record<string, unknown> = {}) {
  return {
    page: "02",
    face: "02",
    page_title: "为何如此",
    page_subtitle: "把张力说清楚",
    destiny_reason:
      "你现在更吃得住慢热铺垫：先把范围收窄，再谈放大，节奏跟得上才站得住。",
    science_mechanism:
      "负荷高时注意力变窄，容易把临时缺口当成必须立刻铺开的信号。",
    convergence:
      "两边同向：先稳住可核对的一小步，再决定要不要加码。",
    verifiable_anchors: ["命宫·紫微", "核心定位域", "化禄→资源转化"],
    ...over,
  };
}

// --- soft coined in visible A ---
{
  const page = face02({
    destiny_reason: "你的核心定位域偏紧，资源流转不畅，先别扩面。",
  });
  const hit = findFaceBodySurfaceHit(faceVisibleBodyBlob("02", page));
  assert.ok(hit, "expected soft hit");
  assert.equal(hit!.kind, "soft_coined");
  assert.ok(
    hit!.hit.includes("核心定位") || hit!.hit.includes("资源流转"),
    hit!.hit,
  );
  const g = gateFaceBodySurface({ key: "02", page_schema: page, surface: "full" });
  assert.ok(g && !g.passed);
  assert.equal(g!.failed_rule, FACE_BODY_SURFACE_RULE_ID);
}

// --- 资源转化 in body ---
{
  const page = face02({
    destiny_reason: "眼下资源转化偏慢，先把交付做成可核对样例。",
  });
  const hit = findFaceBodySurfaceHit(faceVisibleBodyBlob("02", page));
  assert.ok(hit && hit.kind === "soft_coined");
  assert.ok(hit!.hit.includes("资源转化"), hit!.hit);
}

// --- elemental 金土 / 木性 / 截伐 ---
{
  const page = face02({
    destiny_reason: "金土相碍，木性被截伐，推进容易发闷。",
  });
  const hit = findFaceBodySurfaceHit(faceVisibleBodyBlob("02", page));
  assert.ok(hit, "expected elemental/destiny hit");
  assert.equal(hit!.kind, "destiny_jargon");
}

// --- clean vernacular body PASS; soft OK in D anchors ---
{
  const page = face02();
  const blob = faceVisibleBodyBlob("02", page);
  assert.ok(!blob.includes("核心定位域"), "D anchors must not enter visible blob");
  assert.ok(!blob.includes("资源转化"), "D anchors must not enter visible blob");
  assert.equal(findFaceBodySurfaceHit(blob), null);
  assert.equal(
    gateFaceBodySurface({ key: "02", page_schema: page, surface: "full" }),
    null,
  );
}

// --- gateBodyCategoryB surface_clean path for faces ---
{
  const dirty = face02({
    convergence: "对照定位域和资源流转域拧在一起。",
  });
  const full = gateBodyCategoryB({
    key: "02" as never,
    page_schema: dirty as never,
    surface: "full",
  });
  assert.ok(full && !full.passed, "full surface must fail soft in body");
  assert.equal(full!.failed_rule, FACE_BODY_SURFACE_RULE_ID);

  const substance = gateBodyCategoryB({
    key: "02" as never,
    page_schema: dirty as never,
    surface: "substance_only",
  });
  assert.equal(
    substance,
    null,
    "substance_only must defer soft/destiny (not hard-fail content_body)",
  );
  const preview = gateBodyCategoryB({
    key: "02" as never,
    page_schema: dirty as never,
    surface: "full",
  });
  assert.ok(
    preview && !preview.passed,
    "full surfacePreview must catch soft so run-step labels surface_deferred",
  );
  assert.equal(preview!.failed_rule, FACE_BODY_SURFACE_RULE_ID);

  const clean = gateBodyCategoryB({
    key: "02" as never,
    page_schema: face02() as never,
    surface: "full",
  });
  assert.equal(clean, null, "clean vernacular → null (surface_clean)");
}

// --- Face 01 main_recommendation ---
{
  const page = {
    page: "01",
    face: "01",
    page_title: "本题断语",
    page_subtitle: "",
    main_recommendation: "先把范围收小，做成一次可核对交付。",
    conditions: "对方反馈仍按约定节奏回来。",
    not_choosing: "此刻不把摊子铺满。",
    evidence_pointer: "详见 02 依据；命宫·核心定位域",
  };
  assert.equal(
    gateFaceBodySurface({ key: "01", page_schema: page, surface: "full" }),
    null,
    "soft in evidence_pointer OK",
  );
  const dirty = {
    ...page,
    main_recommendation: "先稳住核心定位域再谈资源转化。",
  };
  const g = gateFaceBodySurface({ key: "01", page_schema: dirty, surface: "full" });
  assert.ok(g && !g.passed);
}

// --- EN soft Field ---
{
  const page = face02({
    destiny_reason:
      "Your CoreIdentityField is tight; Resource Flow Field is slow — keep the next step small.",
  });
  const hit = findFaceBodySurfaceHit(faceVisibleBodyBlob("02", page));
  assert.ok(hit && hit.kind === "soft_coined", hit);
}

console.log("ok: face body vernacular iron rule (Face 02 soft+elemental + anchors dual-layer)");
