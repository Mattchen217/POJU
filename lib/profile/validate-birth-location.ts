import type { BirthInfo, BirthLocation } from "@/lib/profile/types";

export class BirthLocationRequiredError extends Error {
  constructor() {
    super("birth_location_required");
    this.name = "BirthLocationRequiredError";
  }
}

/** Step 3: new profiles must include coordinates (no timezone-only default). */
export function validateBirthLocationRequired(birth: Pick<BirthInfo, "birth_location">): void {
  const loc = birth.birth_location;
  if (!loc || typeof loc.longitude !== "number" || !Number.isFinite(loc.longitude)) {
    throw new BirthLocationRequiredError();
  }
  if (loc.use_defaults) {
    throw new BirthLocationRequiredError();
  }
}

export function isBirthLocationComplete(loc: BirthLocation | null | undefined): boolean {
  if (!loc || loc.use_defaults) return false;
  return Number.isFinite(loc.longitude);
}
