import type { StoredProfileData } from "@/lib/db/poju-db";

/** Short birth date label for Match A/B display (e.g. 1977.02.17). */
export function formatBirthShort(profile: StoredProfileData | null): string {
  const b = profile?.birth_info;
  if (!b) return "—";
  const month = String(b.month).padStart(2, "0");
  const day = String(b.day).padStart(2, "0");
  return `${b.year}.${month}.${day}`;
}
