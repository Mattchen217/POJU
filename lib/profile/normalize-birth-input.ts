import type { BirthInfo } from "@/lib/profile/types";

export function normalizeBirthInfoInput(input: Partial<BirthInfo>): BirthInfo {
  return {
    year: Number(input.year ?? 1990),
    month: Number(input.month ?? 1),
    day: Number(input.day ?? 1),
    hour: Number(input.hour ?? 12),
    minute: Number(input.minute ?? 0),
    gender: input.gender === "male" || input.gender === "female" ? input.gender : "other",
    city: input.city?.trim() || undefined,
    latitude: input.latitude,
    longitude: input.longitude,
  };
}
