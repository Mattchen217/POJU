"use client";

import {
  EmptyFacePageSlots,
  FacePageSlots,
} from "@/components/poju/delivery-pages/faces/FacePageSlots";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { DECISION_PAGE_SCHEMAS } from "@/lib/llm/pro/delivery/page-schema/decision-pages";
import type { FacePageData } from "@/lib/llm/pro/delivery/page-schema/face-types";

const FACE_IDS = new Set(["01", "02", "03", "04", "05", "06", "07", "08"]);

function asFaceId(v: unknown): DecisionPageId | null {
  return typeof v === "string" && FACE_IDS.has(v) ? (v as DecisionPageId) : null;
}

function asFacePage(raw: unknown, faceId: DecisionPageId): FacePageData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (FACE_IDS.has(String(row.page ?? "")) || FACE_IDS.has(String(row.face ?? ""))) {
    return raw as FacePageData;
  }
  /** Soft wrap for preview when page field missing but face known. */
  return { ...row, page: faceId, face: faceId } as FacePageData;
}

export function LabFacePreview({
  faceId,
  page_schema,
  locale,
}: {
  faceId: string;
  page_schema: unknown | null | undefined;
  locale: string;
}) {
  const id = asFaceId(faceId);
  if (!id) return null;
  const dual = DECISION_PAGE_SCHEMAS[id]?.dualTrack ?? "?";
  const title = DECISION_PAGE_SCHEMAS[id]?.title ?? id;
  const page = page_schema ? asFacePage(page_schema, id) : null;

  return (
    <div className="rounded-md border border-[#9cf0ff]/25 bg-[#0e1418]">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2 text-xs">
        <span className="font-mono text-[#9cf0ff]">Face {id}</span>
        <span className="text-white">{title}</span>
        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-[#a1a1aa]">
          dualTrack={dual}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-[#71717a]">
          读者面预览 · FacePageSlots
        </span>
      </div>
      <div className="delivery-book-stage max-h-[36rem] overflow-auto p-3">
        {page ? (
          <FacePageSlots page={page} locale={locale} faceId={id} />
        ) : (
          <EmptyFacePageSlots faceId={id} locale={locale} />
        )}
      </div>
    </div>
  );
}

export function LabAssembleFaceShelf({
  faces,
  locale,
}: {
  faces: Array<{
    faceId: string;
    title?: string;
    dualTrack?: string;
    page_schema?: unknown | null;
  }>;
  locale: string;
}) {
  if (!faces.length) {
    return (
      <p className="text-xs text-[#a1a1aa]">无 Face 书架数据 — 先跑 Assemble。</p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {faces.map((f) => (
        <LabFacePreview
          key={f.faceId}
          faceId={f.faceId}
          page_schema={f.page_schema}
          locale={locale}
        />
      ))}
    </div>
  );
}
