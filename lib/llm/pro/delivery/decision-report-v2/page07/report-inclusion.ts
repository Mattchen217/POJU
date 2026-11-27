/**
 * Page07 user-facing report inclusion.
 * not_applicable → omit whole page from Reader / PDF / shelf order.
 * insufficient_information is a production block, not a normal skip.
 * Schema may still store skip status in art.page_schema for audit.
 */

import { isFace07V2 } from "./legacy-adapter";
import type { Face07V2 } from "../schemas";

/** True when Face07 V2 is programmatically marked not_applicable (omit from report). */
export function isFace07NotApplicableOmit(page: unknown): boolean {
  if (!isFace07V2(page)) return false;
  return (page as Face07V2).applicability_status === "not_applicable";
}

/**
 * True when Face07 V2 is sealed as insufficient_information.
 * This is a production block for successful report bodies — not a normal skip
 * and not interchangeable with not_applicable.
 */
export function isFace07InsufficientInformation(page: unknown): boolean {
  if (!isFace07V2(page)) return false;
  return (page as Face07V2).applicability_status === "insufficient_information";
}

/**
 * Whether Page07 belongs in the user-facing reading order / shelf / PDF bodies.
 * - not_applicable → false (omit entirely)
 * - applicable → true
 * - insufficient_information → false for successful report bodies
 *   (production fails closed; do not treat as a normal skip banner page)
 * - legacy Face07 without applicability_status → true (preserve historical projection)
 */
export function includePage07InUserFacingOrder(page: unknown | null | undefined): boolean {
  if (page == null) return false;
  if (!isFace07V2(page)) {
    // Legacy Face07 (no face07-v2 applicability) stays readable.
    return true;
  }
  const status = (page as Face07V2).applicability_status;
  if (status === "not_applicable") return false;
  if (status === "insufficient_information") return false;
  return status === "applicable";
}
