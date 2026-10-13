/**
 * Dyad path prompt pack (two charts). Eastern OS persona shared.
 */

import { EASTERN_OS_PERSONA } from "@/lib/llm/prompts/eastern-os-persona";
import { PIVOT_DUAL_PARTY_POLICY } from "@/lib/llm/prompts/pivot-dual-party-policy";

export const DYAD_PATH_LABEL = "dyad" as const;

/** Prefix for Call A / Call B / Synthesis on dyad path. */
export const DYAD_PATH_SYSTEM_PREFIX = `${EASTERN_OS_PERSONA}

# 路径 · dyad（双盘）
本会话已锁【当事人盘 + 对方盘 + 合盘闭集真算】。
喂料形态与 solo 同构，只多一盘与合盘矩阵：你盘 × 对方盘 × 问题 × 期望。

${PIVOT_DUAL_PARTY_POLICY}

总纲不变：围期望给「你怎么破」；双盘与合盘真算是依据层，不是 Match 专章墙。`;

export const DYAD_CALL_A_EXTRA = `【dyad · Call A】
硬要求：先依据 dyad_matrix_pack 做合婚/合作向二元测算式分析（挂本地真算，勿空谈），
再收敛到【用户侧】主辅、边界与期望达成。禁止产出独立「合盘报告翻版」当交付物。`;

export const DYAD_CALL_B_EXTRA = `【dyad · Call B】
议程按「交付倒逼」：只收报告缺口，且须覆盖二元现实——
对方角色/权力位、可观察行为/态度、你在关系中的硬底线。
有对方盘也不免这三类；禁止闲聊备料。`;

export const DYAD_SYNTHESIS_EXTRA = `【dyad · Synthesis】
收敛时吃双盘闭集 + matrix + covered_agenda；主辅仍须用户可执行。`;

export const DYAD_JUDGMENT_EXTRA = `【dyad · 页批断】
每页 judgment 须出【二元关系批断】（机制/张力/适配，挂合盘闭集），再锁用户侧主辅。
禁止只写单人批断而忽略已锁对方盘。正文药方仍落你侧。`;
