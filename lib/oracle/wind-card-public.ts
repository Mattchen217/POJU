/**
 * 五风卡面 — 静态 URL（`public/oracle/wind-cards/`）
 *
 * 用于：抽签动画、WebGL/Canvas、Spline、`<img>` / `new Image()` 等需要「字符串 URL」的场景。
 * 源文件在 `assets/images/`；同步到 public 请执行：`pnpm copy:oracle-wind-cards`
 */

export const ORACLE_WIND_CARD_PUBLIC_DIR = "/oracle/wind-cards" as const;

export type OracleWindCardSlug =
  | "crosswind"
  | "divine-tailwind"
  | "eye-of-storm"
  | "fair-sky"
  | "still-water";

const FILE_BY_SLUG: Record<OracleWindCardSlug, string> = {
  crosswind: "crosswind.png",
  "divine-tailwind": "divine-tailwind.png",
  "eye-of-storm": "eye-of-storm.png",
  "fair-sky": "fair-sky.png",
  "still-water": "still-water.png",
};

/** 与 `WIND_CARDS_IN_ORDER` 一致的五风顺序 */
export const ORACLE_WIND_CARD_SLUGS_IN_ORDER: readonly OracleWindCardSlug[] = [
  "crosswind",
  "divine-tailwind",
  "eye-of-storm",
  "fair-sky",
  "still-water",
] as const;

export function oracleWindCardImageUrl(slug: OracleWindCardSlug): string {
  return `${ORACLE_WIND_CARD_PUBLIC_DIR}/${FILE_BY_SLUG[slug]}`;
}

/** 展示用短标题（与卡面英文标题一致） */
export const ORACLE_WIND_CARD_LABEL: Record<OracleWindCardSlug, string> = {
  crosswind: "Crosswind",
  "divine-tailwind": "Divine Tailwind",
  "eye-of-storm": "Eye of Storm",
  "fair-sky": "Fair Sky",
  "still-water": "Still Water",
};
