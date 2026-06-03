import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  /** 暂时只上线 en / zh；de / es / fr 翻译文件保留，补全后再启用 */
  locales: ["en", "zh"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  /**
   * 关闭 Accept-Language / 旧 Cookie 猜语言。无 URL 前缀时始终用 `defaultLocale`（英语），
   * 避免刷新 `/` 时被浏览器「首选中文」带到中文界面。
   */
  localeDetection: false,
});
