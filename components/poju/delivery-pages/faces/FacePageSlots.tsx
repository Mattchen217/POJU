/**
 * Face-native decision report slots (01–08).
 * dualTrack mounts: pointer | abc | fold | reality | appendix.
 * slotEvidence[i] aligns 1:1 with FACE_SEGMENT_FIELDS[face] order
 * (same order as pageSchemaToArgumentBodies / extractFaceSchemaSlices).
 */

"use client";

import type { ReactNode } from "react";
import { EvidenceBlock } from "@/components/cross-product/EvidenceBlock";
import { DualEvidenceBody } from "@/components/poju/delivery-pages/DualEvidenceBody";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { DECISION_PAGE_SCHEMAS } from "@/lib/llm/pro/delivery/page-schema/decision-pages";
import type { FacePageData } from "@/lib/llm/pro/delivery/page-schema/face-types";
import { FACE_SEGMENT_FIELDS } from "@/lib/llm/pro/delivery/page-schema/face-types";
import { faceSegmentLabel } from "@/lib/llm/pro/delivery/face-segment-locale";
import { deliveryEvidenceLabelPlain } from "@/lib/llm/pro/delivery/delivery-locale";

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((x) => asText(x)).filter(Boolean).join("\n");
  }
  if (value == null) return "";
  return String(value);
}

function evAt(slotEvidence: string[] | undefined, index: number): string {
  return (slotEvidence?.[index] ?? "").trim();
}

/**
 * Face 02 packs are single-track per segment. Soft text may drop markers —
 * re-tag by segment so DualEvidenceBody does not mislabel science as destiny.
 */
function tagFace02Evidence(faceId: DecisionPageId, segmentId: string, raw: string): string {
  const ev = raw.trim();
  if (!ev || faceId !== "02") return ev;
  if (/【命理】|【科学】|【交汇】/.test(ev)) return ev;
  if (segmentId === "B") return "【科学】" + ev;
  if (segmentId === "C") return "【交汇】" + ev;
  if (segmentId === "A") return "【命理】" + ev;
  return ev;
}

function SlotCard({
  title,
  children,
  fold,
  locale,
  evidence,
}: {
  title: string;
  children: ReactNode;
  fold?: boolean;
  locale: string;
  evidence?: string;
}) {
  const evidenceLabel = deliveryEvidenceLabelPlain(locale);
  const ev = (evidence ?? "").trim();
  const body = (
    <>
      {children}
      {ev ? (
        <EvidenceBlock
          label={evidenceLabel}
          locale={locale}
          defaultOpen={false}
          toggleIcon="play"
          className="delivery-book-stage__evidence dps-face-evidence"
        >
          <div className="poju-delivery-v2__evidence-body">
            <DualEvidenceBody text={ev} locale={locale} />
          </div>
        </EvidenceBlock>
      ) : null}
    </>
  );
  if (fold) {
    return (
      <details className="delivery-book-stage__modules dps-page dps-face-fold">
        <summary className="dps-face-fold__summary">{title || evidenceLabel}</summary>
        <div className="delivery-book-stage__section-card dps-face-section">{body}</div>
      </details>
    );
  }
  return (
    <div className="delivery-book-stage__modules dps-page dps-face-section">
      <div className="delivery-book-stage__section-head">
        <span className="delivery-book-stage__section-dot" aria-hidden />
        <h3 className="delivery-book-stage__section-title">{title}</h3>
      </div>
      <div className="delivery-book-stage__section-card">{body}</div>
    </div>
  );
}

function Prose({ text, locale }: { text: string; locale: string }) {
  const body =
    text.trim() ||
    (locale.toLowerCase().startsWith("zh") ? "（待写入）" : "(pending)");
  return body.split(/\n+/).map((p, i) => (
    <p key={i} className="dps-face-prose">
      {p}
    </p>
  ));
}

function ListBlock({ items, locale }: { items: string[]; locale: string }) {
  const list = items.map((x) => x.trim()).filter(Boolean);
  if (!list.length) {
    return <Prose text="" locale={locale} />;
  }
  return (
    <ul className="dps-face-list">
      {list.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function fieldValue(page: FacePageData, key: string): unknown {
  return (page as unknown as Record<string, unknown>)[key];
}

function isFoldSegment(faceId: DecisionPageId, segmentId: string): boolean {
  const dual = DECISION_PAGE_SCHEMAS[faceId].dualTrack;
  if (
    dual === "fold" &&
    (segmentId === "D" || (segmentId === "C" && faceId === "07"))
  ) {
    return true;
  }
  if (faceId === "07" && segmentId === "C") return true;
  if (faceId === "04" && segmentId === "D") return true;
  // Face 02 D = verifiable_anchors — foldable anchors under open A/B/C tracks.
  if (faceId === "02" && segmentId === "D") return true;
  if (faceId === "05" && segmentId === "D") return false; // switch_or_stop always visible
  if (faceId === "05" && segmentId === "E") return false;
  return false;
}

/** Evidence-style fold for dualTrack=fold evidence segments. */
function shouldFold(
  faceId: DecisionPageId,
  segmentId: string,
  key: string,
): boolean {
  if (key === "evidence_fold" || key === "evidence_pointer") {
    if (key === "evidence_pointer") return false; // pointer stays visible one-liner
    return true;
  }
  return isFoldSegment(faceId, segmentId);
}

export function FacePageSlots({
  page,
  locale,
  faceId,
  slotEvidence,
}: {
  page: FacePageData;
  locale: string;
  faceId?: DecisionPageId;
  /** 1:1 with FACE_SEGMENT_FIELDS order (destiny / science / convergence / …). */
  slotEvidence?: string[];
}) {
  const id = (faceId ??
    ("face" in page ? page.face : undefined) ??
    page.page) as DecisionPageId;
  const dual = DECISION_PAGE_SCHEMAS[id]?.dualTrack ?? "reality";
  const fields = FACE_SEGMENT_FIELDS[id] ?? [];

  return (
    <div
      className={`dps-face dps-face--${id} dps-face-dual--${dual}`}
      data-face={id}
      data-dual-track={dual}
    >
      {fields.map(({ key, segmentId }, index) => {
        const title = faceSegmentLabel(id, segmentId, locale);
        const raw = fieldValue(page, key);
        const fold = shouldFold(id, segmentId, key);
        const isList = Array.isArray(raw);
        const evidence = tagFace02Evidence(id, segmentId, evAt(slotEvidence, index));
        return (
          <SlotCard
            key={key}
            title={title}
            fold={fold}
            locale={locale}
            evidence={evidence}
          >
            {isList ? (
              <ListBlock
                items={(raw as unknown[]).map((x) => asText(x))}
                locale={locale}
              />
            ) : (
              <Prose text={asText(raw)} locale={locale} />
            )}
          </SlotCard>
        );
      })}
    </div>
  );
}

export function EmptyFacePageSlots({
  faceId,
  locale,
}: {
  faceId: DecisionPageId;
  locale: string;
}) {
  const dual = DECISION_PAGE_SCHEMAS[faceId].dualTrack;
  const fields = FACE_SEGMENT_FIELDS[faceId];
  return (
    <div
      className={`dps-face dps-face--${faceId} dps-face-dual--${dual} dps-face--empty`}
      data-face={faceId}
      data-dual-track={dual}
    >
      {fields.map(({ key, segmentId }) => (
        <SlotCard
          key={key}
          title={faceSegmentLabel(faceId, segmentId, locale)}
          fold={shouldFold(faceId, segmentId, key)}
          locale={locale}
        >
          <Prose text="" locale={locale} />
        </SlotCard>
      ))}
    </div>
  );
}