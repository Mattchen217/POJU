# Terms Phase 6 — 灰度 / 发布 / 回滚清单

权威测试入口：`pnpm test:terms-phase6`  
报告产物：`lib/glossary/phase6-acceptance-report.json`  
SSOT 计数（Phase 6 冻结）：**281** = bazi 184 + qimen 54 + glyph 17 + zodiac 12 + ziwei 14（羊刃并入 `fei_ren`）

## 1. 开发环境门禁（阻断发布）

运行并确认 `pass: true`：

```bash
pnpm test:terms-phase6
```

阻断条件（任一即停）：

| 条件 | 证据 |
|---|---|
| 用户出口出现传统原名 / 未知 token | adversarial + export-locales + shensha-phase4 FAIL |
| namespace 同名误解析 | test:term-resolve FAIL |
| 五语 soft/definition 空 | terms:check / verify:terms / export-locales FAIL |
| 旧 SSOT 数量无解释变化 | verify:terms 计数门 FAIL |
| 旧 generator 可覆盖 SSOT | generator-freeze 未拒绝 |
| 套件未跑完 / 不可复现 | phase6-acceptance-report.json 缺失或 hardFails>0 |

## 2. 灰度顺序

1. **内部账号**：五语报告 + 离线 HTML/提醒抽检（对照 `phase6-terms-export.json` soft 列）。
2. **小比例真实用户**：记录 unknown / ambiguous / 阻断率 / 误拦截 / fallback 次数（日志只存 tokenHash，禁完整生日）。
3. **观察期**：禁止删除旧词条；只允许新增映射或修复明显错误，且版本化。

## 3. 回滚策略

| 故障 | 正确回滚 | 禁止 |
|---|---|---|
| display adapter / resolver 误拦截 | 回滚 adapter/resolver 代码版本；**保留**当前 SSOT 数据 | 重新启用 raw traditional fallback |
| 新词条五语错误 | 版本化修正 definition/term；观察期不删 slug | 静默改写历史报告含义 |
| 旧 generator 被误跑 | 确认 `generate-poju-terms.mjs` 仍 exit 1；从 git 恢复 SSOT | 用 157 清单反生成覆盖 |

## 4. 交付物对照（handoff 清单）

| 项 | 路径 / 动作 |
|---|---|
| Phase 0–6 测试 | `pnpm test:terms-phase6` + CI `verify-terms.yml` |
| 术语 JSON 导出 | `lib/glossary/phase6-terms-export.json` |
| 24/51 神煞处置 | `lib/glossary/shensha-disposition-audit.json` |
| 生产调用点迁移清单 | `lib/glossary/phase6-legacy-callsites.json`（`pojuTermByTraditional` 残留） |
| 自动化测试报告 | `lib/glossary/phase6-acceptance-report.json` |
| 五语报告/PDF/提醒截图 | **人工灰度**（本阶段自动化覆盖 fixture 出口扫描，不含 live LLM 截图） |
| 未解决风险 | 见报告 `unresolved_risks` |

## 5. 后续任务（不阻塞本阶段绿）

- 继续把 `pojuTermByTraditional` 无 namespace 调用迁到 `resolvePojuTerm`
- Lab/生产 live 五语抽检截图归档
- 观察期 metrics 仪表（unknown 频率）接入收集台
