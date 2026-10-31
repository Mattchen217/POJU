"use client";

import { useMemo, useState } from "react";
import {
  prepareTextForGlossaryRender,
  toSoftTranslatedPlainText,
  type Locale,
} from "@/lib/terms/prepare-display-pipeline";

/**
 * Delivery Lab harness for TERMS-PIPELINE-SPEC-v1 (code path only).
 * Dual-layer product rule (Max):
 * - 正文 / narrative: vernacular only — no traditional 命理 terms.
 * - 依据 / evidence: model may emit free traditional → autoMark → soft → coined.
 * Production evidence_soft step still teaches model connective+encode; this panel
 * validates the code soft-translate path Lab should reconnect to.
 */
const SAMPLE_EVIDENCE_BARE =
  "依据：命盘中紫微坐命宫，化禄入财帛，主事业与资源的取舍需先立边界。";
const SAMPLE_BODY_VERNACULAR =
  "你最近在工作上容易把精力撒得太开。先把一件事做完，再谈下一件。";

const LOCALES: Locale[] = ["zh", "en", "es", "fr"];

export function LabTermsPipelinePanel() {
  const [evidenceBare, setEvidenceBare] = useState(SAMPLE_EVIDENCE_BARE);
  const [bodyBare, setBodyBare] = useState(SAMPLE_BODY_VERNACULAR);

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
          Terms pipeline（代码路径 · SPEC-v1）
        </h2>
        <p className="text-[11px] text-[#71717a]">
          正文禁裸命理词 · 依据可出传统词再软译 · bare → mark → soft
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-emerald-500/30 bg-[#0f1418] p-3">
          <h3 className="mb-2 text-xs uppercase tracking-wider text-emerald-300/90">
            依据层 · free traditional → mark → soft
          </h3>
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
          {LOCALES.map((loc) => (
            <Step
              key={loc}
              label={`3 · soft ${loc}（toSoftTranslatedPlainText）`}
              text={evidenceSoft[loc] ?? ""}
            />
          ))}
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
