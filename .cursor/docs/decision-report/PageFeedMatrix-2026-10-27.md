# PageFeedMatrix（内容 SoT 导出）

> **Status:** Frozen with the content SoT.  
> **Locked:** 2026-10-27  
> **Source canvas:** https://cursor.com/canvas/store-6a955cf7-a5a8-4ed2-99d5-e6009264a84f/da4d4f7a-442f-4a90-af5e-dfb1d67c7dde  
> **Content SoT canvas:** https://cursor.com/canvas/store-6a955cf7-a5a8-4ed2-99d5-e6009264a84f/7cc1f97b-2d2d-4879-a842-a725d47858b6  
> **Implementation plan canvas:** https://cursor.com/canvas/store-6a955cf7-a5a8-4ed2-99d5-e6009264a84f/4c5cb4be-cf0c-401c-94a5-735c63baed8c  
> **Code:** `lib/llm/pro/delivery/page-feed-matrix.ts`  
> **API:** `sliceForPage(pageId, packs)` — W0 返回 allowlist 与空切片；完整切片器后续再接 ChartFactPack。

每页一次调用只喂该页 allowlist 并集。紫微未稳时 ZFP 键可省略，禁止注水。

## 字段代号

| 代号 | 来源 | 含义 |
|------|------|------|
| CFP.dayMaster | bazi | 日主 |
| CFP.yongJi | bazi | 用忌倾向摘要 |
| CFP.shishenHit | bazi | 本题相关十神/刑冲合命中 |
| CFP.dayunNow | bazi | 当前大运一句 |
| CFP.pathTags | bazi | 路径/选项轴标签 |
| CFP.conflictAnchors | bazi | 与主推荐冲突的短锚 |
| ZFP.topicPalace | ziwei | 本题宫主星/张力 |
| ZFP.sihua | ziwei | 相关四化（含化忌落宫） |
| ZFP.daxian | ziwei | 大限主题一句 |
| ZFP.mingShen | ziwei | 命/身短钉（附录用） |
| ZFP.otherChart | ziwei+bazi | joint 他盘切片 |
| User.Q | dialogue | 本题问题 |
| User.expect | dialogue | 期望 |
| User.detail | dialogue | 细节/约束 |
| Sci.hooks | prompt | 本案机制 hook 键（禁空术语） |

ZFP.* 在紫微未稳时可以不出现。结构包见 [ZiweiFactPack-2026-10-27.md](./ZiweiFactPack-2026-10-27.md)。`sliceForPage` 仍不把星名写入切片。

## 主叙事切片（段级）

### 01

- A 主推荐: CFP pathTags·yongJi; ZFP topicPalace; User Q
- B 成立条件: CFP dayunNow; ZFP daxian; User expect
- C 不选什么: CFP conflictAnchors; ZFP topicPalace
- D 依据指针: 无

### 02

- A 命理理由: CFP yongJi·shishenHit; ZFP topicPalace·sihua
- B 科学机制: User Q·detail; Sci hooks
- C 汇合: 1盘锚; User Q·expect·detail; Sci hooks
- D 可核对锚: CFP dayMaster·yongJi·dayunNow; ZFP topicPalace·sihua·daxian（可空）

### 04

- A 卡点命名: CFP shishenHit·yongJi; ZFP sihua（化忌）
- B 表现: 同A锚; User detail
- C 若硬顶: CFP dayunNow可选; ZFP daxian可选
- D 依据折叠: 同A; Sci hooks

### 05

- A 首选: CFP pathTags·yongJi; ZFP topicPalace; User expect
- B 次选: CFP pathTags; ZFP topicPalace
- C 慎选: CFP conflictAnchors; ZFP sihua
- D 切轨/停止: CFP dayunNow; ZFP daxian; User detail
- E 对照: 无

### 06

- A 近步原则: User detail·Q; Sci hooks
- B 阶段气候: CFP dayunNow; ZFP daxian
- C 自我调频: User expect; Sci hooks
- D 节奏提醒: CFP dayunNow; User expect

### 07（题相关才调用）

- A 场域: CFP pathTags; ZFP topicPalace·daxian; User detail
- B 关系/互动: ZFP topicPalace·otherChart; User detail
- C 依据折叠: 同A/B; Sci hooks
- D 对齐: 无

### 08

- A 红灯: CFP shishenHit短; ZFP sihua短
- B 复盘问句: User Q·expect
- C 何时重跑: CFP dayunNow可选; User expect

## 附录 03

- A 八字: CFP dayMaster·yongJi·shishenHit·dayunNow
- B 紫微: ZFP mingShen·topicPalace·sihua·daxian（未稳跳过）
- C 对照: A+B已列

## 每页并集（实现用）

| pageId | 必带 User | CFP 并集 | ZFP 并集 | Sci |
|--------|-----------|----------|----------|-----|
| 01 | Q · expect | pathTags · yongJi · dayunNow · conflictAnchors | topicPalace · daxian | 否 |
| 02 | Q · expect · detail | dayMaster · yongJi · shishenHit · dayunNow | topicPalace · sihua · daxian | 是 |
| 04 | detail | yongJi · shishenHit · dayunNow | sihua · daxian | 是（折叠） |
| 05 | expect · detail | pathTags · yongJi · conflictAnchors · dayunNow | topicPalace · sihua · daxian | 可选折叠 |
| 06 | Q · expect · detail | dayunNow | daxian | 是 |
| 07 | detail | pathTags | topicPalace · daxian · otherChart | 是（折叠） |
| 08 | Q · expect | shishenHit · dayunNow | sihua | 否 |
| 03 | — | dayMaster · yongJi · shishenHit · dayunNow | mingShen · topicPalace · sihua · daxian | 否 |

## 工程约定

- API: `sliceForPage(pageId, packs)` → 仅并集字段。W0 的 `slice` 值恒为 `null`，表示槽位，不表示已接线。
- 缺紫微: ZFP 键省略；02-D / 03-B 降级；主叙事照出
- 调用: 每页一次 LLM；07 条件跳过；03 可并行
- 闸门: 删段三问；恐吓词表（见内容 SoT）
- 禁止把全盘/十二宫/他宫堆进任一页并集
