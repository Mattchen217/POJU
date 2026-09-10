"use client";

/**
 * Human-readable thesis panel for Delivery Lab (Phase C).
 * Prefer this over raw JSON when inspecting classical_basis / absent / depth.
 */

type ChecklistItem = {
  key: string;
  present: boolean;
  summary_zh: string;
};

type ThesisDimension = {
  dimension_id: string;
  dimension_name_zh: string;
  classical_basis: ChecklistItem[] | Record<string, unknown>;
  strength_verdict?: string;
  conclusion_zh: string;
  depth: "full" | "brief" | "skip";
};

type ChartThesisLike = {
  version?: number;
  structured_fingerprint?: string;
  as_of_day?: string;
  question_category?: string | null;
  judgment_core_frozen?: boolean;
  dimensions?: ThesisDimension[];
};

const STUB_KEYS = new Set(["climate_balance"]);

function isThesis(v: unknown): v is ChartThesisLike {
  return (
    typeof v === "object" &&
    v != null &&
    Array.isArray((v as ChartThesisLike).dimensions)
  );
}

export function ThesisInspectPanel({ raw }: { raw: unknown }) {
  if (!isThesis(raw)) {
    return (
      <p className="p-3 text-xs text-[#a1a1aa]">
        本步输出不是 ChartThesis 结构，下方仍可看 Raw JSON。
      </p>
    );
  }

  const dims = raw.dimensions ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="border-b border-white/10 px-3 py-2 text-[11px] text-[#a1a1aa]">
        <span className="font-mono text-[#e4e4e7]">
          fp={raw.structured_fingerprint?.slice(0, 12) ?? "—"}…
        </span>
        {raw.as_of_day ? (
          <span className="ml-2">as_of={raw.as_of_day}</span>
        ) : (
          <span className="ml-2 text-amber-300/90">as_of=missing</span>
        )}
        {raw.question_category ? (
          <span className="ml-2">cat={raw.question_category}</span>
        ) : null}
        {raw.judgment_core_frozen ? (
          <span className="ml-2 text-[#9cf0ff]/80">frozen</span>
        ) : null}
        <span className="ml-2">dims={dims.length}</span>
      </div>
      <ul className="space-y-3 p-3">
        {dims.map((dim) => {
          const basis = Array.isArray(dim.classical_basis) ? dim.classical_basis : [];
          const present = basis.filter((i) => i.present);
          const absent = basis.filter((i) => !i.present);
          return (
            <li
              key={dim.dimension_id}
              className="rounded-md border border-white/10 bg-[#0b0f12]/60 p-3"
            >
              <div className="mb-2 flex flex-wrap items-baseline gap-2">
                <h3 className="text-sm font-medium text-white">
                  {dim.dimension_name_zh}
                </h3>
                <span className="font-mono text-[10px] text-[#71717a]">
                  {dim.dimension_id}
                </span>
                <span
                  className={
                    dim.depth === "full"
                      ? "rounded px-1.5 py-0.5 text-[10px] bg-[#f2ca50]/15 text-[#f2ca50]"
                      : "rounded px-1.5 py-0.5 text-[10px] bg-white/10 text-[#a1a1aa]"
                  }
                >
                  depth={dim.depth}
                </span>
                <span className="text-[10px] text-[#71717a]">
                  present={present.length} absent={absent.length}
                </span>
                {dim.strength_verdict ? (
                  <span className="text-[11px] text-[#9cf0ff]">
                    {dim.strength_verdict}
                  </span>
                ) : null}
              </div>
              <ul className="mb-2 space-y-0.5">
                {basis.map((it) => (
                  <li
                    key={it.key}
                    className="font-mono text-[11px] leading-snug text-[#e4e4e7]"
                  >
                    <span className={it.present ? "text-emerald-400" : "text-[#71717a]"}>
                      {it.present ? "✓" : "○"}
                    </span>{" "}
                    <span className="text-[#71717a]">[{it.key}]</span> {it.summary_zh}
                    {STUB_KEYS.has(it.key) ? (
                      <span className="ml-1 text-amber-300/90">· STUB</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="text-[12px] leading-relaxed text-[#a1a1aa]">
                <span className="text-[#71717a]">conclusion · </span>
                {dim.conclusion_zh}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
