import { SEGMENT_PATHS } from "@/lib/base-analysis-v2/report-schema";

/**
 * 第2/3次产出的共用形态：与 ReportComputed 同 key 树，
 * 但每个 SEGMENT_PATHS 节点是一段非空字符串（正文或依据）。
 */
export type ReportSegmentTextTree = {
  energy_map: {
    day_master_nature: string;
    wuxing_distribution: string;
    cognitive_archetype: string;
    regulator: string;
  };
  work_style: {
    value_creation: string;
    decision_style: string;
    focus_drain: string;
  };
  interpersonal: {
    comm_archetype: string;
    friction_point: string;
    synergy: string;
  };
  phase_states: {
    baseline: string;
    rest_phase: string;
    peak_phase: string;
    transition_phase: string;
  };
  retune: {
    color: string;
    space: string;
    habits: string;
    awareness: string;
  };
  summary: {
    card_basis: string;
    keywords?: readonly string[];
    current_theme?: string;
    dos?: readonly string[];
    donts?: readonly string[];
  };
};

export function readPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, obj);
}

/**
 * 校验返回 JSON 的 key 结构与 ReportComputed 一致（每段路径都能取到非空字符串）。
 * null = 结构齐、每段非空。
 */
export function validateSegmentKeys(
  obj: unknown,
  kind: "narrative" | "evidence",
): string | null {
  if (!obj || typeof obj !== "object") {
    return `${kind}: not an object`;
  }
  for (const path of SEGMENT_PATHS) {
    const v = readPath(obj, path);
    if (typeof v !== "string" || !v.trim()) {
      return `${kind}: missing/empty: ${path}`;
    }
  }
  return null;
}

/** Map every SEGMENT_PATHS string through `fn` (immutable). */
export function mapSegmentTexts(
  tree: ReportSegmentTextTree,
  fn: (text: string, path: string) => string,
): ReportSegmentTextTree {
  const clone = structuredClone(tree) as ReportSegmentTextTree;
  for (const path of SEGMENT_PATHS) {
    const parts = path.split(".");
    let cur: Record<string, unknown> = clone as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      cur = cur[parts[i]!] as Record<string, unknown>;
    }
    const leaf = parts[parts.length - 1]!;
    const prev = cur[leaf];
    if (typeof prev === "string") {
      cur[leaf] = fn(prev, path);
    }
  }
  return clone;
}

/** Walk SEGMENT_PATHS; return first path where `test` is true. */
export function findSegmentText(
  tree: unknown,
  test: (text: string, path: string) => boolean,
): string | null {
  for (const path of SEGMENT_PATHS) {
    const v = readPath(tree, path);
    if (typeof v === "string" && test(v, path)) return path;
  }
  return null;
}
