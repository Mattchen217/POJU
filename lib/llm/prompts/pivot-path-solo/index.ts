/**
 * Solo path prompt pack (single chart). Eastern OS persona shared.
 */

import { EASTERN_OS_PERSONA } from "@/lib/llm/prompts/eastern-os-persona";

export const SOLO_PATH_LABEL = "solo" as const;

/** Prefix for Call A / Call B / Synthesis on solo path. */
export const SOLO_PATH_SYSTEM_PREFIX = `${EASTERN_OS_PERSONA}

# 路径 · solo（单盘）
本会话已锁【当事人盘】。分析与议程只围绕：用户主盘 × 问题 × 期望。
禁止臆造第二人命理；若问题涉及他人，只可用用户自述中的角色/行为作现实锚。
总纲：围期望给「你怎么破」。`;

export const SOLO_CALL_A_EXTRA = `【solo · Call A】
从用户主盘做多维真算与破局收敛；不要求合盘测算。`;

export const SOLO_CALL_B_EXTRA = `【solo · Call B】
议程只收「交付报告用得上」的现实缺口（围主盘+问题+期望）。禁止闲聊备料。`;

export const SOLO_SYNTHESIS_EXTRA = `【solo · Synthesis】
收敛主辅路径须用户可执行；依据=主盘真算 + covered_agenda。`;

export const SOLO_JUDGMENT_EXTRA = `【solo · 页批断】
出单人结构批断（现网口径）；再锁主辅。`;
