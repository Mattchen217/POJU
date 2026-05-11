import type { BirthInfo, UserProfile } from "@/lib/profile/types";
import { calculateProfileWithShunshi } from "@/lib/calculations/shunshi-adapter";

export async function calculateProfile(input: BirthInfo): Promise<UserProfile> {
  return calculateProfileWithShunshi(input);
}
