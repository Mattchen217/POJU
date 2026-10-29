"use client";

import {
  FACE_QUALITY_CHECK_IDS,
  FACE_QUALITY_CHECK_LABELS,
  type FaceQualityCheckId,
} from "@/lib/llm/pro/delivery/lab/lab-face-qc";

export type QualityReviewState = {
  checks: Partial<Record<FaceQualityCheckId, boolean>>;
  notes: string;
};

export function LabGateQualityChecklist({
  faceId,
  formatPassed,
  formatDetail,
  value,
  disabled,
  onChange,
}: {
  faceId?: string;
  formatPassed: boolean;
  formatDetail?: string;
  value: QualityReviewState;
  disabled?: boolean;
  onChange: (next: QualityReviewState) => void;
}) {
  const relevant = FACE_QUALITY_CHECK_IDS.filter((id) => {
    /** BookJudgmentPack gate — only dual-track + slice-collapse matter. */
    if (faceId === "book") {
      return id === "dual_track_holds" || id === "collapses_without_slice";
    }
    if (id === "07_no_marriage_scare") return !faceId || faceId === "07";
    if (id === "01_points_to_02") return !faceId || faceId === "01" || faceId === "02";
    if (id === "05_real_options") return !faceId || faceId === "05";
    if (id === "06_action_done_look") return !faceId || faceId === "06";
    if (id === "dual_track_holds") return !faceId || faceId === "02" || faceId === "07";
    return true;
  });

  return (
    <div className="rounded-md border border-white/10 bg-[#101417] p-3">
      <p className="text-xs uppercase tracking-wider text-[#71717a]">Gate · 格式 + 质量</p>
      <p
        className={`mt-2 text-sm ${
          formatPassed ? "text-emerald-400" : "text-red-300"
        }`}
      >
        格式机检：{formatPassed ? "PASSED（人审可过）" : "FAILED（不可人过）"}
      </p>
      {formatDetail ? (
        <p className="mt-1 text-xs text-[#a1a1aa]">{formatDetail}</p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {relevant.map((id) => (
          <li key={id} className="flex items-start gap-2 text-xs text-[#e4e4e7]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={Boolean(value.checks[id])}
              disabled={disabled || !formatPassed}
              onChange={(e) =>
                onChange({
                  ...value,
                  checks: { ...value.checks, [id]: e.target.checked },
                })
              }
            />
            <span>{FACE_QUALITY_CHECK_LABELS[id]}</span>
          </li>
        ))}
      </ul>
      <label className="mt-3 block text-xs text-[#a1a1aa]">
        人审笔记
        <textarea
          className="mt-1 w-full rounded border border-white/10 bg-[#0b0f12] px-2 py-1.5 text-xs text-[#e4e4e7]"
          rows={3}
          disabled={disabled || !formatPassed}
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          placeholder="质量笔记（随 approve 持久到 attempt）"
        />
      </label>
    </div>
  );
}
