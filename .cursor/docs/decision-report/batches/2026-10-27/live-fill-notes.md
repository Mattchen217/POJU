# 活填笔记 · 2026-10-27

Grok 盒上的原始日志不在这台机器。下面只记已落地的行为和下一枪要看的文件。

## joint 06

`54f36295` 上四案 solo 的 02+06 过了。`f23dded3` 有钥匙的重跑里，四案 solo 的 01+02+05+06 仍过。`joint-thin` 的 06 仍停在：

`missing_primary_or_backup_toolkit:soft_repair_third_party_strategy:primary_toolkit_angle_0`

清洗备注里，主轨 0/2 和辅轨 0/1/2 都有 `soft_repair_third_party_strategy`。手段被剥空后是 `primary_toolkit_angle_0_science_means_empty_after_soft_repair`，接着 `primary_toolkit_angles_lt_3`。活稿写了「让对方同意 / 说服对方」这一类施事，题面框单元测盖不住。

`c4f88eba` 把缺盘声明整句贴进了非 joint 页，也把 joint 06 的手段换成了同一句。离职、迁移、一般决定不得出现「另一侧的盘不在这份材料里」。软修只删「让对方同意 / 说服对方」这种从句，留下原来的核对步骤，不再整段替换。连续句号收成一个。

## 06-C

这一批只填了 `execution_guidance`，五案都没有自我调频。活填现在要求 `self_retune`（title + body）：执行这一步时你自己的节奏和停手线。缺了就是 `missing_06c_self_retune`。不是勾选清单，也不是缺盘声明。

`otherChart` 仍省略。06 和 02 都过清洗之后，薄壳只标 Thin。

## joint 02

同一枪 02 停在 `compress_body_mingli:命理`，位置 `why_cards[0].essence`，attempts=2。干支和用神会自动平替，裸「命理」之前直接失败。现在「命理」平替成「能量画像」。02 任务不再把栏目名「命理」写成要出现在正文里的词。

## 真太阳时

ICU 的 h24 会把午夜写成小时 `24`。拼进 `T24:` 之后，有的运行时得到非法日期（时差 NaN，紫微日期无效），有的把钟点滚到次日。`general-stuck` 的芝加哥钟会走这条。`normalizeIcuHourToken` 把 `24` 收成当天的 `00`，不另滚一日。

## 批跑

有 `OPENROUTER_API_KEY` 时，每案覆盖写入：

- `fills/<案>.decision_brief.json`（01）
- `fills/<案>.situation_analysis.json`（02）
- `fills/<案>.recommended_strategy.json`（05）
- `fills/<案>.execution_guidance.json`（06）

不读旧稿当跳过。紫微抛错只记 `ziwei` 闸，Lab 和活填继续。活填失败先于 Thin 判定，06 清洗失败不会被写成「只是 otherChart 薄」。

本环境没有钥匙时，这四份稿不会出现。那一跑只证明结构和回放清洗，不证明模型正文。
