import { getBaziChart } from "shunshi-bazi-core";

import {
  buildProfileStructured,
  type ProfileStructured,
} from "@/lib/calculations/build-profile-structured";
import type { BaseAnalysisStreamLocalData } from "@/lib/llm/prompts/base-analysis-stream-prompt";
import { shunshiParamsFromBirthInfo } from "@/lib/profile/birth-info-utils";
import type { UserProfile } from "@/lib/profile/types";

import { resolveBaseAnalysisOutputLanguage } from "./resolve-output-language";

function normalizeStructuredAvailability(
  structured: import("@/lib/calculations/build-profile-structured").ProfileStructured,
): import("@/lib/calculations/build-profile-structured").ProfileStructured {
  if (structured.data_availability) return structured;
  return {
    ...structured,
    data_availability: {
      pillars_detail: Boolean(structured.pillars_detail),
      da_yun: structured.da_yun.length > 0,
      bazi_enrichment: Boolean(structured.bazi_enrichment),
    },
  };
}

/** Build POST body for `/api/profile/base-analysis/stream` (structured computed locally). */
export function buildStreamLocalDataFromProfile(
  profile: UserProfile,
  options?: { user_input?: string; output_language?: "zh" | "en" },
): BaseAnalysisStreamLocalData {
  const params = shunshiParamsFromBirthInfo(profile.birth);
  const chart = getBaziChart({
    year: params.year,
    month: params.month,
    day: params.day,
    hour: params.hour,
    minute: params.minute,
    gender: params.gender,
    city: params.city,
    latitude: params.latitude,
    longitude: params.longitude,
    standardMeridian: params.standardMeridian,
    useTrueSolarTime: true,
    sect: 1,
  });

  const structured = normalizeStructuredAvailability(buildProfileStructured({ profile, chart }));
  const output_language =
    options?.output_language ?? resolveBaseAnalysisOutputLanguage(options?.user_input);

  return {
    structured,
    output_language,
  };
}

export type { ProfileStructured };
