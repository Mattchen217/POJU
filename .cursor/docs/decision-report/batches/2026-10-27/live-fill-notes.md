# 活填笔记 · 2026-10-27

Grok 盒上的原始日志不在这台机器。下面只记已落地的行为和下一枪要看的文件。

## joint 06

上一枪（tip `54f36295`）四案 solo 的 02+06 清洗过了。`joint-thin` 的 06 停在：

`missing_primary_or_backup_toolkit:soft_repair_third_party_strategy:primary_toolkit_angle_0`

原始模型句没有进仓库。失败形态是：共同决定里的「对方」被当成施事，软修写成科学壳，壳被剥掉，主工具包第 0 角作废。

这一枪把共同决定收成题面框：对方的盘未接入、和对方一起、不替对方做主。框内原句留下。框外仍写「让对方同意」，但整句属于一起拍板时，改写成求问者自己的条件，且这句话不进科学壳表，避免再被剥掉。纯「说服对方」且没有共同决定框，仍然塌成壳并作废。

`otherChart` 仍省略。薄壳只标 Thin。

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
