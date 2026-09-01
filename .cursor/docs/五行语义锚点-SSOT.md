# 五行语义锚点 SSOT（内部）

> 代码孪生：`lib/glossary/wuxing-semantic-ssot.ts`  
> 与真算同级的**静态语义层**：人人相同；prompt **按盘切片**注入；sanitize **始终读全表**。  
> **不对用户直出**全文；禁止写成可抄行动范文。

## 双消费

| 侧 | 入口 |
|---|---|
| 生成 | `formatWuxingSemanticForPrompt` → `buildEasternCalcSliceForFill` / P4 duty |
| 校验 | `gateP4DimensionMeans` + blacklist/whitelist（与上同源） |

## 行动 type

`rhythm` / `mindset`（优先靠前）→ `symbol` / `field`（次要置后）

## 铁律

- 补泻 = 状态/节奏/气质，非 H₂O / 绿植 / 晒太阳等物件  
- 旺者宜泄不宜硬克；生克句必须对上本盘用神/忌神  
- 不进 `POJU_IDENTITY*`；不替代 vernacular 禁词表（那是合规软译）
