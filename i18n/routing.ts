import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  /** 默认 `en`；顺序与语言下拉一致（不影响 URL，仅作类型与枚举参考） */
  locales: ["en", "es", "de", "fr", "zh"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  /**
   * 关闭 Accept-Language / 旧 Cookie 猜语言。无 URL 前缀时始终用 `defaultLocale`（英语），
   * 避免刷新 `/` 时被浏览器「首选中文」带到中文界面。
   */
  localeDetection: false,
});
