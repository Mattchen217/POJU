/**
 * 将文件放在 public/marketing/ 下。若某张图暂缺，对应区块会使用代码中的渐变/装饰作为回退，不影响构建。
 * 建议统一 WebP；PNG/JPEG 亦可。
 */
/** Bump when replacing public/animations/hero.png so browsers drop stale caches. */
export const HERO_ASSET_VERSION = "20260610b";

/** DS hero.png — full-width cosmic banner (see public/animations/hero.png) */
export const HERO_PNG = { width: 1717, height: 916 } as const;

export const LANDING_ASSETS = {
  /** 首屏全宽大背景：星云 / 行星 / 地平线（DS hero.png） */
  hero: "/animations/hero.png",
  /** 「Where two languages meet」整段：立柱 + 光门氛围 */
  twoLanguages: "/marketing/two-languages.webp",
  /** 「Three promises」可选氛围底图（偏暗、低对比） */
  promises: "/marketing/promises.webp",
  /** 底部大 CTA 圆角横幅：宇航员 / 星球（ contained 区域） */
  finalCta: "/marketing/final-cta.webp",
  cardPoju: "/marketing/card-poju.webp",
  cardGlyph: "/marketing/card-glyph.webp",
  cardSyncro: "/marketing/card-syncro.webp",
} as const;

/** 给设计与切图用的建议像素（导出 2× 可在视网膜屏更清晰） */
export const LANDING_ASSET_SPECS = {
  hero: { width: 1717, height: 916, ratio: "约 16∶9", usage: "全宽 cover；object-position center 40%；勿用 hero.jpg 低清回退" },
  twoLanguages: { width: 2400, height: 1000, ratio: "约 12∶5", usage: "偏横向宽幅；上下可做暗角便于叠字" },
  promises: { width: 2400, height: 900, ratio: "约 8∶3", usage: "整体偏暗，纹理即可，避免抢眼高光" },
  finalCta: { width: 1600, height: 600, ratio: "约 8∶3", usage: "放入圆角容器内 cover；主体建议居中偏下" },
  cardPoju: { width: 800, height: 1000, ratio: "4∶5", usage: "产品卡纹理，可与渐变叠加（opacity 叠图）" },
  cardGlyph: { width: 800, height: 1000, ratio: "4∶5", usage: "同上" },
  cardSyncro: { width: 800, height: 1000, ratio: "4∶5", usage: "同上" },
} as const;
