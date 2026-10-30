# P4 — 真实交付灰度抽检包

自动化 fixture（`pnpm test:terms-phase6` / `test:ns-aware-export-exits`）**不等于** live LLM 交付已验收。

## 抽检矩阵（人工）

对**同一组真实会话 fixture**（固定生日 + 问题 + locale）生成：

| 出口 | zh | en | es | de | fr | 扫描点 |
|---|---|---|---|---|---|---|
| 决策报告（站内） | □ | □ | □ | □ | □ | 正文+依据折层：无传统原名 / 无 slug 裸露 |
| 离线 HTML | □ | □ | □ | □ | □ | text node + title/alt |
| PDF / 可复制正文 | □ | □ | □ | □ | □ | `sanitizePlainExport` 后文本 |
| 30 日提醒单日 HTML | □ | □ | □ | □ | □ | 五槽 + evidence；仍是决策锚非任务表 |
| 邮件附件（若启用） | □ | □ | □ | □ | □ | 同 HTML |

## 必须记录的指标（日志只存 tokenHash，禁完整生日）

| 指标 | 如何记 |
|---|---|
| `unknown` | resolve / shensha unknown_blocked 次数 |
| `ambiguous` | `resolvePojuTerm` ambiguous（如 财星）是否误出用户可见 |
| 误拦截 | 奇门 空亡/白虎 soft 是否被删空（P1 修后应 soft 保留） |
| 红线拦截 | 童子煞/十恶大败等是否仍被硬剥 |

## 灰度顺序

1. 内部账号五语全出口  
2. 小比例真实用户 + 上表指标  
3. 观察期：禁止删旧 SSOT 行；只加映射 / 修明显错误并版本化  

## 回滚

误拦截影响核心交付 → 回滚 display/sanitize 代码版本；**保留** SSOT；**禁止**恢复 raw traditional fallback。

## 本 PR 范围

本文件 = 抽检材料与流程；**不含** live LLM 生成样例（需在有密钥的环境由人跑并贴附件到发布单）。
