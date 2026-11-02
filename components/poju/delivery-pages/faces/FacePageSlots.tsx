/**
 * Face-native decision report slots (01–08).
 * dualTrack mounts: pointer | abc | fold | reality | appendix.
 * slotEvidence[i] aligns 1:1 with FACE_SEGMENT_FIELDS[face] order
 * (same order as pageSchemaToArgumentBodies / extractFaceSchemaSlices).
 *
 * Reader evidence soft-exit (all faces): opened EvidenceBlock body = one
 * vernacular prose paragraph (no 【能量配置】/【科学】/【交汇】 chrome).
 * Face02: one shared merged fold for A/B/C (no 4× EvidenceBlock).
 * Other faces: per-segment fold still DualEvidenceBody presentation="prose".
 * Lab may pass presentation="tracks". 04/SoT16 frozen elsewhere.
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
import { mergeReaderEvidenceProse } from "@/lib/llm/pro/delivery/page-schema/reader-evidence-prose";

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
 * Collect Face02 A/B/C soft evidence by segment index.
 * Internally still destiny / science / convergence (+ ZFP when in soft);
 * do not re-tag with reader-visible 【命理】/【科学】/【交汇】 chrome.
 */
function collectFace02TrackEvidence(
  slotEvidence: string[] | undefined,
): { metaphysics: string; science: string; convergence: string } {
  return {
    metaphysics: evAt(slotEvidence, 0),
    science: evAt(slotEvidence, 1),
    convergence: evAt(slotEvidence, 2),
  };
}

function SlotCard({
  title,
  children,
  fold,
  locale,
  evidence,
  evidencePresentation = "prose",
}: {
  title: string;
  children: ReactNode;
  fold?: boolean;
  locale: string;
  evidence?: string;
  evidencePresentation?: "tracks" | "prose";
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
            <DualEvidenceBody
              text={ev}
              locale={locale}
              presentation={evidencePresentation}
            />
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

function Face02ReaderEvidenceFold({
  slotEvidence,
  locale,
}: {
  slotEvidence?: string[];
  locale: string;
}) {
  const tracks = collectFace02TrackEvidence(slotEvidence);
  const prose = mergeReaderEvidenceProse({
    metaphysics: tracks.metaphysics,
    science: tracks.science,
    convergence: tracks.convergence,
    locale,
  });
  if (!prose) return null;
  const evidenceLabel = deliveryEvidenceLabelPlain(locale);
  return (
    <EvidenceBlock
      label={evidenceLabel}
      locale={locale}
      defaultOpen={false}
      toggleIcon="play"
      className="delivery-book-stage__evidence dps-face-evidence dps-face02-evidence-prose"
    >
      <div className="poju-delivery-v2__evidence-body">
        <DualEvidenceBody
          metaphysics={tracks.metaphysics}
          science={tracks.science}
          convergence={tracks.convergence}
          locale={locale}
          presentation="prose"
        />
      </div>
    </EvidenceBlock>
  );
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
  const isFace02 = id === "02";

  return (
    <div
      className={`dps-face dps-face--${id} dps-face-dual--${dual}`}
      data-face={id}
      data-dual-track={dual}
      data-evidence-presentation="prose"
    >
      {fields.map(({ key, segmentId }, index) => {
        const title = faceSegmentLabel(id, segmentId, locale);
        const raw = fieldValue(page, key);
        const fold = shouldFold(id, segmentId, key);
        const isList = Array.isArray(raw);
        // Face02: no per-segment EvidenceBlock — one shared prose fold below.
        const evidence = isFace02 ? "" : evAt(slotEvidence, index);
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
      {isFace02 ? (
        <div className="dps-face02-reader-evidence">
          <Face02ReaderEvidenceFold slotEvidence={slotEvidence} locale={locale} />
        </div>
      ) : null}
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
