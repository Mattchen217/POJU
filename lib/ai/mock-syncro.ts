type Dir = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export type SyncroDirectionRow = {
  dir: Dir;
  rating: string;
  best: string;
  avoid: string;
};

const BASE_ROWS: ReadonlyArray<SyncroDirectionRow> = [
  { dir: "N", rating: "✦✦✦✦", best: "Planning and clarity", avoid: "Urgent confrontation" },
  { dir: "NE", rating: "✦✦✦", best: "Study and review", avoid: "Impulsive commitments" },
  { dir: "E", rating: "✦✦✦✦✦", best: "Growth and healing", avoid: "Loud noise and clutter" },
  { dir: "SE", rating: "✦✦✦✦", best: "Steady communication", avoid: "Over-promising" },
  { dir: "S", rating: "✦✦✦", best: "Visibility and energy", avoid: "Overexposure" },
  { dir: "SW", rating: "✦✦", best: "Closure and tidy-up", avoid: "High-stakes negotiation" },
  { dir: "W", rating: "✦✦✦", best: "Reflection and reset", avoid: "Rushed choices" },
  { dir: "NW", rating: "✦✦✦✦", best: "Leadership and decisions", avoid: "Scattered multitasking" },
];

const ORDER: ReadonlyArray<string> = ["Zi", "Chou", "Yin", "Mao", "Chen", "Si", "Wu", "Wei", "Shen", "You", "Xu", "Hai"];

export function mockRegenerateSyncroDirections(shichenName: string): SyncroDirectionRow[] {
  const idx = Math.max(0, ORDER.indexOf(shichenName));
  const shift = idx % BASE_ROWS.length;
  return [...BASE_ROWS.slice(shift), ...BASE_ROWS.slice(0, shift)];
}

