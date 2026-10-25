import type { SyncroDirectionRow } from "@/lib/ai/mock-syncro";
import { approximateYongShenFromBirthYear, calculateDirections } from "@/lib/calculations";
import type { Direction8, DirectionRatingLevel } from "@/lib/calculations/types";

const ORDER: Direction8[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

const STARS: Record<DirectionRatingLevel, string> = {
  highly_favorable: "✦✦✦✦✦",
  supportive: "✦✦✦✦",
  neutral: "✦✦✦",
  challenging: "✦✦",
  oppressive: "✦",
};

function avoidHint(r: DirectionRatingLevel): string {
  if (r === "highly_favorable" || r === "supportive") return "Overextending or ignoring rest";
  if (r === "neutral") return "Rushed multi-tasking";
  return "High-stakes confrontation or sharp ultimatums";
}

export function directionRowsFromM6(params: {
  birthYear: number;
  headingDeg: number;
  at?: Date;
}): SyncroDirectionRow[] {
  const at = params.at ?? new Date();
  const yong = approximateYongShenFromBirthYear(params.birthYear);
  const out = calculateDirections({
    yong_shen: yong,
    current_time: at.toISOString(),
    device_orientation: params.headingDeg,
  });

  return ORDER.map((dir) => {
    const cell = out.ratings[dir];
    return {
      dir,
      rating: STARS[cell.rating],
      best: cell.brief_note,
      avoid: avoidHint(cell.rating),
    };
  });
}
