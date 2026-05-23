/** 各产品介绍页主视觉（与落地页 When pojulife meets your moment 场景图一致） */
export const PRODUCT_SHOT_IMAGES = {
  poju: "/animations/S1.jpg",
  glyph: "/animations/S2.jpg",
  syncro: "/animations/S3.jpg",
  match: "/animations/S4.jpg",
} as const;

export type ProductShotKey = keyof typeof PRODUCT_SHOT_IMAGES;
