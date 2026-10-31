# Disposition report

## Namespace availability
- **bazi**: active · SSOT rows 184
- **qimen**: active · SSOT rows 54
- **glyph**: active · SSOT rows 17
- **zodiac**: active · SSOT rows 12
- **ziwei**: active · SSOT rows 14

## Forbidden registry (bazi-scoped redlines etc.)
Count: 26

| ns | token | severity | reason |
|---|---|---|---|
| bazi | 空亡 | redline | redline_shensha_fear_frame |
| bazi | 魁罡 | never_compute | never_compute_or_redline |
| bazi | 十恶大败 | redline | redline_shensha_fear_frame |
| bazi | 孤鸾 | redline | redline_shensha_fear_frame |
| bazi | 孤鸾煞 | redline | redline_shensha_fear_frame |
| bazi | 阴阳差错 | redline | redline_shensha_fear_frame |
| bazi | 阴差阳错 | redline | redline_shensha_fear_frame |
| bazi | 元辰 | never_compute | never_compute_or_redline |
| bazi | 六秀日 | never_compute | never_compute_or_redline |
| bazi | 大耗 | redline | redline_shensha_fear_frame |
| bazi | 小耗 | redline | redline_shensha_fear_frame |
| bazi | 五鬼 | redline | redline_shensha_fear_frame |
| bazi | 丧门 | redline | redline_shensha_fear_frame |
| bazi | 吊客 | redline | redline_shensha_fear_frame |
| bazi | 白虎 | redline | redline_shensha_fear_frame |
| bazi | 天狗 | redline | redline_shensha_fear_frame |
| bazi | 血刃 | redline | redline_shensha_fear_frame |
| bazi | 流霞 | never_compute | never_compute_or_redline |
| bazi | 隔角 | never_compute | never_compute_or_redline |
| bazi | 勾绞煞 | redline | redline_shensha_fear_frame |
| bazi | 童子煞 | redline | redline_shensha_fear_frame |
| bazi | 地网 | redline | redline_shensha_fear_frame |
| bazi | 天罗 | redline | redline_shensha_fear_frame |
| bazi | 八专日 | never_compute | never_compute_or_redline |
| bazi | 十灵日 | never_compute | never_compute_or_redline |
| bazi | 九丑日 | never_compute | never_compute_or_redline |

## Ziwei runtime disposition (main)
On **main** (main @ 53fd647f): palace/star/config tokens (except 命宫 SSOT) are largely `internal_only` pending Phase 11 merge.
Phase 11 branch marks those 36 as `public_glossary` + SSOT.

Sample:
| token | disposition |
|---|---|
| 命宫 | via SSOT resolve (zw_identity_field) |
| 紫微 | internal_only |
| 仆役 | internal_only |
| 木三局 | internal_only |
| 杀破狼 | unknown_blocked |

## ShenSha disposition
Uses `resolveShenshaDisposition` / Phase 4 fail-closed map (soft labels; redlines empty).
