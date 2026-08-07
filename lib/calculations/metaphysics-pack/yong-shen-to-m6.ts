import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { FiveElement, YongShenOutput } from "@/lib/calculations/types";

import { toFiveElement } from "./element-token";

/**
 * Map POJU ProfileStructured 用神/忌神 → M6 YongShenOutput (English FiveElement).
 * Prefer real structured fields; never invent for display aesthetics.
 */
export function buildYongShenOutputForM6(structured: ProfileStructured): YongShenOutput {
  const primary =
    toFiveElement(structured.yong_shen) ??
    toFiveElement(structured.xi_shen?.[0]) ??
    ("water" as FiveElement);

  const ji = (structured.ji_shen ?? [])
    .map((t) => toFiveElement(t))
    .filter((el): el is FiveElement => el != null);

  return {
    primary_yong_shen: primary,
    ji_shen: ji.length > 0 ? ji : (["earth"] as FiveElement[]),
  };
}
