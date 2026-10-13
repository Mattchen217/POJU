"use client";

import { WorkspaceBirthInfoPicker } from "@/components/workspace/WorkspaceBirthInfoPicker";
import type { BirthInfo } from "@/lib/profile/types";

type Props = {
  open: boolean;
  locale: string;
  busy?: boolean;
  onSubmit: (info: BirthInfo) => void;
  onCancel: () => void;
};

/**
 * Stage-1 dyad: reuse workspace birth form (same Y-M-D-H-M wheel as product entry).
 * Not a new picker — only a thin overlay + partner-facing intro.
 */
export function PartnerBirthModal({ open, locale, busy = false, onSubmit, onCancel }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={
        locale.startsWith("zh") ? "补充对方的出生信息" : "Add their birth details"
      }
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-[#0f1418] p-3 shadow-xl">
        <p className="mb-2 px-1 text-sm text-[#cbd5e1]">
          {locale.startsWith("zh")
            ? "补充对方的出生信息（用于关系结构校准，不是独立合盘报告）。"
            : "Add their birth details (for relationship-structure calibration — not a full Match report)."}
        </p>
        {busy ? (
          <p className="px-1 py-6 text-center text-sm text-[#94a3b8]">…</p>
        ) : (
          <WorkspaceBirthInfoPicker locale={locale} onSubmit={onSubmit} onCancel={onCancel} />
        )}
      </div>
    </div>
  );
}
