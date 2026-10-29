/**
 * Face-native decision report slots (01–08).
 * dualTrack mounts: pointer | abc | fold | reality | appendix.
 */

"use client";

import type { ReactNode } from "react";
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

function SlotCard({
  title,
  children,
  fold,
  locale,
}: {
  title: string;
  children: ReactNode;
  fold?: boolean;
  locale: string;
}) {
  const evidenceLabel = deliveryEvidenceLabelPlain(locale);
  if (fold) {
    return (
      <details className="delivery-book-stage__modules dps-page dps-face-fold">
        <summary className="dps-face-fold__summary">{title || evidenceLabel}</summary>
        <div className="delivery-book-stage__section-card dps-face-section">{children}</div>
      </details>
    );
  }
  return (
    <div className="delivery-book-stage__modules dps-page dps-face-section">
      <div className="delivery-book-stage__section-head">
        <span className="delivery-book-stage__section-dot" aria-hidden />
        <h3 className="delivery-book-stage__section-title">{title}</h3>
      </div>
      <div className="delivery-book-stage__section-card">{children}</div>
    </div>
  );
}

function Prose({ text, locale }: { text: string; locale: string }) {
  const body = text.trim() || (locale.toLowerCase().startsWith("zh") ? "（待写入）" : "(pending)");
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
  if (dual === "fold" && (segmentId === "D" || segmentId === "C" && faceId === "07")) {
    return true;
  }
  if (faceId === "07" && segmentId === "C") return true;
  if (faceId === "04" && segmentId === "D") return true;
  if (faceId === "05" && segmentId === "D") return false; // switch_or_stop always visible
  if (faceId === "05" && segmentId === "E") return false;
  return false;
}

/** Evidence-style fold for dualTrack=fold evidence segments. */
function shouldFold(faceId: DecisionPageId, segmentId: string, key: string): boolean {
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
}: {
  page: FacePageData;
  locale: string;
  faceId?: DecisionPageId;
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
      {fields.map(({ key, segmentId }) => {
        const title = faceSegmentLabel(id, segmentId, locale);
        const raw = fieldValue(page, key);
        const fold = shouldFold(id, segmentId, key);
        const isList = Array.isArray(raw);
        return (
          <SlotCard key={key} title={title} fold={fold} locale={locale}>
            {isList ? (
              <ListBlock items={(raw as unknown[]).map((x) => asText(x))} locale={locale} />
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
