"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";

import { DeliveryPageSlots } from "@/components/poju/delivery-pages/DeliveryPageSlots";
import {
  DELIVERY_SEGMENT_KEYS,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { deliverySectionHeading } from "@/lib/llm/pro/delivery/delivery-locale";
import {
  mockEvidenceForPreview,
  mockPageForPreview,
} from "@/lib/llm/pro/delivery/page-schema/mock-preview-zh";

import "@/styles/delivery-book-stage.css";
import "@/styles/delivery-report-v2.css";
import "@/styles/evidence-block.css";
import "@/styles/delivery-slots-preview.css";

export function DeliverySlotsPreviewClient() {
  const locale = useLocale();
  const [key, setKey] = useState<DeliverySegmentKey>("direct_answer");
  const [showEvidence, setShowEvidence] = useState(true);

  const page = useMemo(() => mockPageForPreview(key, "zh"), [key]);
  const slotEvidence = useMemo(
    () => (showEvidence ? mockEvidenceForPreview(key, "zh") : []),
    [key, showEvidence],
  );

  return (
    <div className="dps-preview">
      <header className="dps-preview__bar">
        <div className="dps-preview__brand">
          <strong>Delivery slots preview</strong>
          <span>本地 UI · 无需四阶段 · mock 预填</span>
        </div>
        <label className="dps-preview__toggle">
          <input
            type="checkbox"
            checked={showEvidence}
            onChange={(e) => setShowEvidence(e.target.checked)}
          />
          显示卡内依据
        </label>
      </header>

      <div className="dps-preview__shell">
        <nav className="dps-preview__nav" aria-label="Pages">
          <ol>
            {DELIVERY_SEGMENT_KEYS.map((k, i) => {
              const active = k === key;
              return (
                <li key={k}>
                  <button
                    type="button"
                    className={active ? "is-active" : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setKey(k)}
                  >
                    <span className="dps-preview__nav-idx">P{i + 1}</span>
                    <span className="dps-preview__nav-title">
                      {deliverySectionHeading(k, locale)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <main className="dps-preview__main">
          <h1 className="dps-preview__page-title">
            {deliverySectionHeading(key, locale)}
          </h1>
          <div className="dps-preview__paper delivery-book-stage">
            <DeliveryPageSlots
              markdown=""
              locale={locale}
              pageSchema={page}
              slotEvidence={slotEvidence}
            />
          </div>
          <p className="dps-preview__hint">
            改 UI：
            <code>components/poju/delivery-pages/DeliveryPageSlots.tsx</code> +{" "}
            <code>styles/delivery-book-stage.css</code>
            <br />
            改预填文案：
            <code>lib/llm/pro/delivery/page-schema/mock-preview-zh.ts</code>
          </p>
        </main>
      </div>
    </div>
  );
}
