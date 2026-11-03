"use client";

/**
 * S6 LAB — Stage/Input/Context/Prompt/Model/Response/Transform/Validation/Render.
 */

import type { ReactNode } from "react";

type Obs = {
  stage?: string;
  step_key?: string;
  page?: string | null;
  session_id?: string | null;
  lab_id?: string | null;
  job_id?: string | null;
  generation_id?: string | null;
  call_id?: string | null;
  context?: {
    binding?: {
      context_id: string;
      context_version: number;
      context_hash: string;
    } | null;
    has_snapshot?: boolean;
    status?: string | null;
    feed_injected?: boolean | null;
  };
  prompt?: {
    system_chars?: number;
    user_chars?: number;
    user_feed_chars?: number;
    has_formal_dc?: boolean;
  };
  model?: {
    name?: string | null;
    thinking_effort?: string | null;
    latency_ms?: number | null;
  };
  response?: {
    raw_chars?: number;
    parsed_present?: boolean;
    finish_reason?: string | null;
  };
  transform?: Array<{ action: string; detail?: string }>;
  validation?: {
    passed?: boolean;
    failed_rule?: string | null;
    detail?: string | null;
  };
  render?: {
    preview_kind?: string | null;
    preview_chars?: number | null;
  };
};

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <>
      <dt className="text-[#71717a]">{k}</dt>
      <dd className="break-all text-[#e4e4e7]">{v ?? "—"}</dd>
    </>
  );
}

export function LabObservationPanel({ observation }: { observation?: Obs | null }) {
  if (!observation) {
    return (
      <div className="rounded border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-[#a1a1aa]">
        本步尚无 S6/S7 observation（旧 attempt、非 v3 步，或 Chat full_pipeline 尚未写入）。
      </div>
    );
  }
  const b = observation.context?.binding;
  return (
    <div className="rounded border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs">
      <div className="font-medium text-sky-200">S6 Observation · 全链路</div>
      <dl className="mt-2 grid grid-cols-[7.5rem_1fr] gap-x-2 gap-y-1 font-mono text-[11px]">
        <Row k="Stage" v={observation.stage} />
        <Row k="step" v={observation.step_key} />
        <Row k="page" v={observation.page} />
        <Row k="session_id" v={observation.session_id} />
        <Row k="lab_id" v={observation.lab_id} />
        <Row k="generation_id" v={observation.generation_id} />
        <Row
          k="Context"
          v={
            b
              ? `${b.context_id}@v${b.context_version} · ${b.context_hash.slice(0, 12)}… · snap=${observation.context?.has_snapshot ? "y" : "n"} · feed=${observation.context?.feed_injected ? "y" : "n"}`
              : `none · snap=${observation.context?.has_snapshot ? "y" : "n"}`
          }
        />
        <Row
          k="Prompt"
          v={
            observation.prompt
              ? `sys=${observation.prompt.system_chars} user=${observation.prompt.user_chars} feed=${observation.prompt.user_feed_chars} dc=${observation.prompt.has_formal_dc ? "y" : "n"}`
              : "—"
          }
        />
        <Row
          k="Model"
          v={
            observation.model
              ? `${observation.model.name ?? "?"} · effort=${observation.model.thinking_effort ?? "?"} · ${observation.model.latency_ms ?? "?"}ms`
              : "—"
          }
        />
        <Row
          k="Response"
          v={
            observation.response
              ? `raw=${observation.response.raw_chars} parsed=${observation.response.parsed_present ? "y" : "n"} finish=${observation.response.finish_reason ?? "?"}`
              : "—"
          }
        />
        <Row
          k="Transform"
          v={
            (observation.transform ?? [])
              .map((t) => `${t.action}${t.detail ? `(${t.detail})` : ""}`)
              .join(" · ") || "—"
          }
        />
        <Row
          k="Validation"
          v={
            observation.validation
              ? `${observation.validation.passed ? "PASS" : "FAIL"} ${observation.validation.failed_rule ?? ""} ${observation.validation.detail ?? ""}`
              : "—"
          }
        />
        <Row
          k="Render"
          v={
            observation.render
              ? `${observation.render.preview_kind ?? "?"} chars=${observation.render.preview_chars ?? "?"}`
              : "—"
          }
        />
      </dl>
      <p className="mt-2 text-[10px] text-[#a1a1aa]">
        对照下方 call_trace 原文。发现问题时先分：数据源 / Prompt / 模型 / Transform / Render。
      </p>
    </div>
  );
}
