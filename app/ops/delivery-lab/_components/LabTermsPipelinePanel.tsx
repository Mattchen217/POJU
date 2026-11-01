"use client";

import { useMemo, useState } from "react";
import {
  prepareTextForGlossaryRender,
  toSoftTranslatedPlainText,
  type Locale,
} from "@/lib/terms/prepare-display-pipeline";

/**
 * Delivery Lab harness for TERMS-PIPELINE-SPEC-v1.
 *
 * Dual-layer product rule (Max):
 * - 正文 / narrative: vernacular only — no traditional 命理 terms.
 * - 依据 / evidence: free traditional → autoMark → locale polish → soft.
 *
 * When `liveStages` is passed (from a real evidence_soft attempt call_trace.parsed.stages),
 * the left column shows the live Lab run dump. Otherwise falls back to the editable sample.
 */

export type LiveEvidenceSoftStages = {
  bare?: unknown;
  mark?: unknown;
  locale_polish?: unknown;
  soft?: unknown;
};

const SAMPLE_EVIDENCE_BARE =
  "依据：今天讨论驿马和天德贵人，还有月德；取舍需先立边界。";
const SAMPLE_BODY_VERNACULAR =
  "你最近在工作上容易把精力撒得太开。先把一件事做完，再谈下一件。";

const LOCALES: Locale[] = ["zh", "en", "es", "fr"];

function pretty(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

/** Flatten first non-empty evidence string from a DeliveryArgumentTree-like dump. */
function firstEvidenceText(tree: unknown): string {
  if (typeof tree === "string") return tree;
  if (!tree || typeof tree !== "object") return "";
  for (const args of Object.values(tree as Record<string, unknown>)) {
    if (!Array.isArray(args)) continue;
    for (const a of args) {
      if (!a || typeof a !== "object") continue;
      const ev = (a as { evidence?: unknown }).evidence;
      if (typeof ev === "string" && ev.trim()) return ev.trim();
    }
  }
  return pretty(tree);
}

export function LabTermsPipelinePanel({
  liveStages,
  liveLocale,
}: {
  /** Real Lab run stages from evidence_soft call_trace.parsed.stages */
  liveStages?: LiveEvidenceSoftStages | null;
  liveLocale?: string | null;
} = {}) {
  const [evidenceBare, setEvidenceBare] = useState(SAMPLE_EVIDENCE_BARE);
  const [bodyBare, setBodyBare] = useState(SAMPLE_BODY_VERNACULAR);

  const hasLive = Boolean(
    liveStages &&
      (liveStages.bare != null ||
        liveStages.mark != null ||
        liveStages.soft != null),
  );

  const evidenceMarked = useMemo(
    () => prepareTextForGlossaryRender(evidenceBare, "zh"),
    [evidenceBare],
  );
  const evidenceSoft = useMemo(() => {
    const out: Partial<Record<Locale, string>> = {};
    for (const loc of LOCALES) {
      out[loc] = toSoftTranslatedPlainText(evidenceMarked, loc);
    }
    return out;
  }, [evidenceMarked]);

  const bodyMarked = useMemo(
    () => prepareTextForGlossaryRender(bodyBare, "zh"),
    [bodyBare],
  );
  const bodySoftZh = useMemo(
    () => toSoftTranslatedPlainText(bodyMarked, "zh"),
    [bodyMarked],
  );

  return (
    <section className="border-b border-white/10 px-4 py-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#e4e4e7]">
          Terms pipeline（SPEC-v1 · bare → mark → locale_polish → soft）
        </h2>
        <p className="text-[11px] text-[#71717a]">
          {hasLive
            ? `Live Lab dump · locale=${liveLocale ?? "?"} · 来自本步 evidence_soft attempt`
            : "正文禁裸命理词 · 依据可出传统词再软译 · 样本试玩（跑「依据软译」后此处切 Live）"}
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div
          className={
            hasLive
              ? "rounded-md border border-amber-400/40 bg-[#0f1418] p-3"
              : "rounded-md border border-emerald-500/30 bg-[#0f1418] p-3"
          }
        >
          <h3 className="mb-2 text-xs uppercase tracking-wider text-emerald-300/90">
            {hasLive
              ? "依据层 · LIVE Lab run（四阶段）"
              : "依据层 · sample · free traditional → mark → soft"}
          </h3>

          {hasLive ? (
            <>
              <Step
                label="1 · bare（依据层模型自由输出 · 传统词）"
                text={firstEvidenceText(liveStages!.bare)}
              />
              <Step
                label="2 · mark（代码打标 · prepareTextForGlossaryRender）"
                text={firstEvidenceText(liveStages!.mark)}
              />
              <Step
                label="3 · locale_polish（模型多语润色 / zh=identity）"
                text={firstEvidenceText(liveStages!.locale_polish ?? liveStages!.mark)}
              />
              <Step
                label="4 · soft（代码替换 · toSoftTranslatedPlainText）"
                text={firstEvidenceText(liveStages!.soft)}
              />
              <details className="mt-2">
                <summary className="cursor-pointer text-[10px] text-[#71717a]">
                  完整 tree JSON（四阶段）
                </summary>
                <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border border-white/5 bg-black/30 p-2 font-mono text-[10px] text-[#a1a1aa]">
                  {pretty(liveStages)}
                </pre>
              </details>
            </>
          ) : (
            <>
              <textarea
                value={evidenceBare}
                onChange={(e) => setEvidenceBare(e.target.value)}
                rows={3}
                className="mb-2 w-full rounded border border-white/10 bg-[#0b0f12] p-2 font-mono text-[11px] text-[#e4e4e7]"
              />
              <Step label="1 · bare（模型可出传统词）" text={evidenceBare} />
              <Step
                label="2 · mark（prepareTextForGlossaryRender）"
                text={evidenceMarked}
              />
              <Step
                label="3 · locale_polish zh（identity）"
                text={evidenceMarked}
              />
              {LOCALES.map((loc) => (
                <Step
                  key={loc}
                  label={`4 · soft ${loc}（toSoftTranslatedPlainText）`}
                  text={evidenceSoft[loc] ?? ""}
                />
              ))}
            </>
          )}
        </div>

        <div className="rounded-md border border-white/15 bg-[#101417] p-3">
          <h3 className="mb-2 text-xs uppercase tracking-wider text-[#9cf0ff]">
            正文层 · vernacular only（不应长出命理真词）
          </h3>
          <textarea
            value={bodyBare}
            onChange={(e) => setBodyBare(e.target.value)}
            rows={3}
            className="mb-2 w-full rounded border border-white/10 bg-[#0b0f12] p-2 font-mono text-[11px] text-[#e4e4e7]"
          />
          <Step label="bare body" text={bodyBare} />
          <Step label="after prepare（应近似不变）" text={bodyMarked} />
          <Step label="soft zh" text={bodySoftZh} />
          <p className="mt-2 text-[11px] text-[#71717a]">
            若正文误入传统真词，这里会出⟦t:⟧/soft——那是泄漏，不是产品意图。
          </p>
        </div>
      </div>
    </section>
  );
}

function Step({ label, text }: { label: string; text: string }) {
  return (
    <div className="mb-2">
      <div className="mb-0.5 text-[10px] uppercase tracking-wide text-[#71717a]">
        {label}
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded border border-white/5 bg-black/30 p-2 font-mono text-[11px] text-[#d4d4d8]">
        {text || "（空）"}
      </pre>
    </div>
  );
}
