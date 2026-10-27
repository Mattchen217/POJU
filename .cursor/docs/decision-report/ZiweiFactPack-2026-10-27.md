# ZiweiFactPack（结构层 · 2026-10-27）

> **Content SoT:** https://cursor.com/canvas/store-6a955cf7-a5a8-4ed2-99d5-e6009264a84f/7cc1f97b-2d2d-4879-a842-a725d47858b6  
> **PageFeedMatrix:** https://cursor.com/canvas/store-6a955cf7-a5a8-4ed2-99d5-e6009264a84f/da4d4f7a-442f-4a90-af5e-dfb1d67c7dde  
> **Plan:** https://cursor.com/canvas/store-6a955cf7-a5a8-4ed2-99d5-e6009264a84f/4c5cb4be-cf0c-401c-94a5-735c63baed8c  
> **Code:** `lib/ziwei/fact-pack.ts` · `lib/ziwei/birth-clock.ts`  
> **Check:** `pnpm test:ziwei-fact-pack`

仓库里没有 `lib/ziwei` 引擎。本波选用 npm **iztro 2.6.3**（SylarLong，**MIT**，https://github.com/SylarLong/iztro）。它按阳历与时辰排十二宫、主星、四化、大限和流年，不附语料库。批断句、规则卡、倪师引文都不从这里取出。

八字 `ChartFactPack` 仍在 `lib/llm/pro/delivery/page-schema/chart-fact-pack.ts`。两套包并列，互不改写。

## 字段

ZFP 短名就是包的顶层键，与 `FEED.ZFP` 一致。

| 键 | 内容 |
|----|------|
| `topicPalace` | 无题目时钉命宫：干支、主星、对宫主星。`role` 固定 `"ming"` |
| `sihua` | 生年四化，每条 `{ mutagen, star, palace }`，含化忌落宫 |
| `daxian` | 指定 `asOf` 的大限宫、虚岁起止、主星、大限四化，加流年干支与流年四化 |
| `mingShen` | 命主、身主、命宫支、身宫支、身宫所在宫、五行局 |
| `otherChart` | 固定 `null` |
| `palaces` | 十二宫主星索引（不是矩阵字段），以后按题改 `topicPalace` 用 |
| `source` | 库名、版本、阳历、时辰序号、钟点来源、`asOf` |

不收录辅星全表、亮度、长生/博士十二神、星座生肖、库内说明文字。

## BirthInfo → iztro

`astro.bySolar(solarDate, timeIndex, gender, true, "zh-CN")`。

| BirthInfo | iztro |
|-----------|--------|
| 年/月/日，或真太阳时跨日之后的日期 | `YYYY-M-D` |
| 钟点 0–23 | `timeIndex = floor((hour + 1) / 2)`。0 早子，23 晚子 = 12 |
| 只有 `hour_period` | 用该时辰的代表钟点 |
| `gender` M/F | `男` / `女` |
| 闰月 | `fixLeap: true` |

钟点优先级：已有 `tst_meta` → 具体经度上的 `calculateTrueSolarTime` → 民事钟点。没有具体出生地时，不用时区猜测去改时辰。不调用 iztro 的全局 `config()`。

`asOf` 决定大限和流年。同一 `BirthInfo` 加同一 `asOf`，两次结果的 JSON 相同。排盘失败就抛错，不补空宫。

## 样例（民事钟 · 2000-08-16 04:30 女 · asOf 2026-10-27）

命宫午、主星紫微，对宫迁移贪狼。命主破军，身主文昌，身宫在官禄，木三局。生年四化：太阳禄在子女，武曲权在财帛，太阴科在仆役，天同忌在疾厄。2026 大限在夫妻（23–32，七杀），流年丙午，流年化忌在官禄。

## 还不做

`sliceForPage` 收到这份包仍只留空槽。提示词、恐吓闸、joint 他盘、`DELIVERY_PIPELINE` 默认都不在这里改。
