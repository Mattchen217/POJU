import { pojuTermByTraditional } from "@/lib/glossary/pojulife-terms";

/**
 * @deprecated 别名已收进 pojulife-terms 的 aliases 字段。
 * 保留此函数仅为兼容旧调用点；内部改为走 SSOT，不再维护平行表。
 */
export function normalizeShenshaName(han: string): string {
  const t = pojuTermByTraditional(han, "bazi") ?? pojuTermByTraditional(han);
  return t?.traditional ?? han;
}
