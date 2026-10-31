# Missing terms report

Local traditional tokens with `coverage_status=missing` (unique by ns+traditional).

| Layer | Unique count |
|---|---|
| All missing | 884 |
| Authoritative (closed-set / runtime / pattern / forbidden / phase9) | 65 |
| Candidate literal scan | 819 |
| Other | 0 |

> Do **not** auto-promote to `internal_only` / `blocked` — product review required.
> Candidate rows are often soft-labels, stance vernacular, or prose — triage carefully.

## Authoritative missing (priority triage)

| namespace | traditional | value_type | sample source | notes |
|---|---|---|---|---|
| qimen | 丙 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 辰 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 丑 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 丁 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 庚 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 癸 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 己 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 甲 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 卯 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 壬 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 申 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 巳 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 未 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 午 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 戊 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 辛 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 乙 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 寅 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 酉 | enum_closed | lib/qimen/dictionary.ts |  |
| qimen | 子 | enum_closed | lib/qimen/dictionary.ts |  |
| ziwei | 丙 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 昌曲同会 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 辰 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 丑 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 丁 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 府相朝垣 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 辅弼同会 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 庚 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 癸 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 亥 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 化科入身 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 化权入官 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 火贪格 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 机月同梁 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 机月同梁三星会 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 己 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 甲 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 巨日同宫 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 魁钺同会 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 廉杀羊 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 铃贪格 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 禄存守命 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 卯 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 壬 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 日月夹命 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 日月同宫 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 杀破狼 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 申 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 双禄朝垣 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 巳 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 天机化忌入命 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 天马入命 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 天马在迁 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 天同天梁格 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 未 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 午 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 武曲七杀 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 戊 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 辛 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 戌 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 乙 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 寅 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 酉 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 紫微入命 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |
| ziwei | 子 | phase9_inventory | .cursor/docs/terms-phase9-ziwei-inventory.json | Observed in Phase 9 FactPack inventory across sample births |

## Candidate scan missing (verify context)

| namespace | traditional | value_type | sample source | notes |
|---|---|---|---|---|
| bazi | 被流程绑死 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 被误读为拒绝亲近 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 本人将亡 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 比肩夺财 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 比肩主孤 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 必出轨 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 必嫁富 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 必伤人 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 必为领导 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 必有灾难 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 必遭官非 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 必遭劫难 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 必掌印把子 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 必中科举 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 边界 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 变现 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 表达 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 表演型疲倦 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 不得安生 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 不用看医生 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 财多身弱必贫 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 财富宿命保证 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 产出 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 场面人情债 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 出家命 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 创新 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 词馆主文豪命 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 刀光剑影 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 独处 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 短命 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 兑现 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 多元 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 非常规 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 非传统 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 分担 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 锋芒 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 福星照命大富大贵 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 富贵铁口 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 改命成功 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 高压 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 孤辰寡宿克亲 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 孤苦伶仃 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 固定对外表达窗口 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 寡妇命 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 官非牢狱 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 官杀混杂必灾 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 官职铁口 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 惯性拖延道歉 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 贵人救命 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 国印主当官 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 亥卯未 | candidate_literal | lib/calculations/bazi-shensha-local.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 横死 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 红鸾必结婚 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 红鸾年必嫁娶 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 华盖主孤独一生 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 回报 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 婚期铁口 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 婚外情宿命 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 婚姻资产铁口 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 祸百端 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 机会 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 技艺 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 家破人亡 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 家有丧事 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 见官有灾 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 将星主掌权发财 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 交换 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 节奏 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 劫财必破财 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 劫财克妻 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 劫财主败 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 劫煞主破财横祸 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 金舆主豪门 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 竞争 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 决断 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 可信 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 克夫 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 克配偶 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 克妻 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 克死 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 克子 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 空谈不落地时耗能 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 空转思辨 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 烂桃花 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 牢狱之灾 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 厉鬼 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 禄神主大富 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 免灾保证 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 命犯桃花 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 偏财必富 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 偏财主横财 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 偏印主孤 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 破家 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 七杀必灾 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 七杀攻身 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 七杀主血光 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 亲缘灭绝恐吓 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 权位铁口 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 确诊 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 锐度 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 杀重无制 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 伤官克官 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 伤官主灾 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 申子辰 | candidate_literal | lib/calculations/bazi-shensha-local.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 食神制杀必贵 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 食神主寿 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 顺境易松懈边界 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 死亡恐吓 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 巳酉丑 | candidate_literal | lib/calculations/bazi-shensha-local.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 天打雷劈 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 天德化解一切灾 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 天医可自愈百病 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 天灾人祸 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 同侪 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 突破 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 亡神主死人 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 危机 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 伪医疗 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 文昌必成名 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 文名铁口 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 稳定 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 无敌护身符叙事 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 无子女缘 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 喜事铁口 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 享乐逃避 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 枭印 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 枭印必克 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 协作 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 邪术 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 凶死 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 兄弟必克 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 虚荣消耗 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 学历铁口 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 学堂主必成学者 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 学习 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 血光 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 血光之灾 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 羊刃七杀 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 羊刃主血光 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 一生不愁钱 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 一生孤独 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 一生无灾 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 易被读成冷淡 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 易被人情消耗 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 易沉浸失落叙事 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 易冲动绑定 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 驿马主奔波一生 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 寅午戌 | candidate_literal | lib/calculations/bazi-shensha-local.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 印多为病 | candidate_literal | lib/glossary/tengod-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |
| bazi | 英雄式透支 | candidate_literal | lib/glossary/shensha-semantic-ssot.ts | CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion |

… truncated 669 more (see 02 JSON).

