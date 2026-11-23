/**
 * Flatten Face02 for cite / scare / substance gates.
 */

import { isFace02Legacy, isFace02V2 } from "./legacy-adapter";
import type { Face02V2 } from "../schemas";
import {
  collectFace02UnitEvidenceIds,
  face02AssembledBodyBlob,
} from "./content-units";

export function face02BodyTextBlob(page: unknown): string {
  if (isFace02V2(page)) {
    return face02AssembledBodyBlob(page as Face02V2);
  }
  if (isFace02Legacy(page)) {
    return [
      page.page_title,
      page.page_subtitle,
      page.destiny_reason,
      page.science_mechanism,
      page.convergence,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

export function face02EvidenceIdBlob(page: unknown): string[] {
  if (!isFace02V2(page)) return [];
  return collectFace02UnitEvidenceIds(page as Face02V2);
}

export function collectFace02RealizedEvidenceIds(page: Face02V2): string[] {
  return [...new Set(face02EvidenceIdBlob(page))];
}
