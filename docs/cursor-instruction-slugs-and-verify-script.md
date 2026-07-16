# 【给 Cursor】术语工程 · 建 slug + 写校验脚本

> **背景**：术语命名由外部协作者完成（**看不到代码**）。因此 **slug 必须由代码侧一次定死**，双方同源，再用脚本机器校验。
> **本次不做命名**，只做两件事：**① 补齐/统一 slug 常量；② 写校验脚本。**

---

## 一、已核实的现状（勿重复造轮子）

### ✅ `CLOSED_SET_SLUG` 里**已有**的（**直接用，禁止新建**）
| 类别 | 数量 | 状态 |
|---|---|---|
| **神煞** | **24/24** | `tian_yi_gui_ren / lu_shen / fei_ren / wen_chang / tao_hua / yi_ma / hua_gai / gu_chen / gua_su / jiang_xing / jie_sha / wang_shen / zai_sha / guo_yin / jin_yu / tian_de / yue_de / fu_xing_gui_ren / tai_ji_gui_ren / **tian_yi_star**(天医) / xue_tang / ci_guan / hong_luan / tian_xi` |
| **十二长生** | **12/12** | `life_changsheng / life_muyu / life_guandai / life_linguan / life_diwang / life_shuai / life_bing / life_si / life_mu / life_jue / life_tai / life_yang` |
| **天干** | **10/10** | `stem_jia / stem_yi / stem_bing / stem_ding / stem_wu / stem_ji / stem_geng / stem_xin / stem_ren / stem_gui` |
| **地支** | **12/12** | `branch_zi / branch_chou / branch_yin / branch_mao / branch_chen / branch_si / branch_wu / branch_wei / branch_shen / branch_you / branch_xu / branch_hai` |
| **结构+十神** | 29/41 | 见下表 |

> ⚠️ 注意 `天医 = tian_yi_star`（与 `天乙贵人 = tian_yi_gui_ren` 区分，勿混）。

---

## 二、任务 1 · 修正 B1 已交付文件的 slug（24 个挂错）
> 协作者的**术语命名质量很好，一个词都不要改**；**只换 slug**。
```
useful_god          → yong_shen
favorable_god       → favorable_element
unfavorable_god     → unfavorable_element
self_strong         → strong_self
self_weak           → weak_self
self_balanced       → balanced_self
major_cycle         → decade
annual_cycle        → year
chart               → natal_profile
heavenly_stems      → heavenly_stem      ← 单数
earthly_branches    → earthly_branch     ← 单数
hidden_stems        → hidden_stem        ← 单数
companion           → bi_jian
sibling             → jie_cai
food_god            → shi_shen
harming_officer     → shang_guan
indirect_wealth     → pian_cai
direct_wealth       → zheng_cai
seven_killings      → qi_sha
direct_officer      → zheng_guan
indirect_resource   → pian_yin
direct_resource     → zheng_yin
six_combinations    → liuhe              ← 见任务 3（关系统一）
three_combinations  → sanhe              ← 见任务 3
```
**已正确、勿动**：`day_master / pattern / bazi / four_pillars / spouse_palace` + 五行阴阳 7 个（见任务 2）。

---

## 三、任务 2 · 新建 slug 常量（代码里**完全没有**）

### 2.1 五行 5 + 阴阳 2（`CLOSED_WUXING/CLOSED_YINYANG` 目前只是中文数组，无 slug）
```ts
export const WUXING_SLUG = {
  木: "wood", 火: "fire", 土: "earth", 金: "metal", 水: "water",
} as const;
export const YINYANG_SLUG = { 阳: "yang", 阴: "yin" } as const;
```

### 2.2 **qimen 命名空间（39）** —— `lib/qimen/type.ts` 只有中文类型，**无 slug 系统**
```ts
export const QIMEN_SLUG = {
  // 八神 (8)
  值符: "qm_zhi_fu", 騰蛇: "qm_teng_she", 太陰: "qm_tai_yin", 六合: "qm_liu_he",
  白虎: "qm_bai_hu", 玄武: "qm_xuan_wu", 九地: "qm_jiu_di", 九天: "qm_jiu_tian",
  // 九星 (9)
  天蓬: "qm_tian_peng", 天任: "qm_tian_ren", 天冲: "qm_tian_chong", 天輔: "qm_tian_fu",
  天英: "qm_tian_ying", 天芮: "qm_tian_rui", 天柱: "qm_tian_zhu", 天心: "qm_tian_xin",
  天禽: "qm_tian_qin",
  // 八門 (8)
  休門: "qm_xiu_men", 生門: "qm_sheng_men", 傷門: "qm_shang_men", 杜門: "qm_du_men",
  景門: "qm_jing_men", 死門: "qm_si_men", 驚門: "qm_jing2_men", 開門: "qm_kai_men",
  // 宮位 (9)
  坎一宮: "qm_gong_kan", 坤二宮: "qm_gong_kun", 震三宮: "qm_gong_zhen", 巽四宮: "qm_gong_xun",
  中五宮: "qm_gong_zhong", 乾六宮: "qm_gong_qian", 兌七宮: "qm_gong_dui",
  艮八宮: "qm_gong_gen", 離九宮: "qm_gong_li",
  // 遁 (2) + 上中下元 (3)
  陽遁: "qm_yang_dun", 陰遁: "qm_yin_dun",
  上元: "qm_yuan_shang", 中元: "qm_yuan_zhong", 下元: "qm_yuan_xia",
} as const;
```
> **`qm_` 前缀是刚需**：解决跨空间冲突 —— **「六合」在 bazi 是 `liuhe`（支关系）、在 qimen 是 `qm_liu_he`（八神）**；**「白虎」在 bazi 是禁词、在 qimen 是 `qm_bai_hu` 合法实算**。
> **`驚門` 用 `qm_jing2_men`** 以区别于 `景門 qm_jing_men`（拼音同为 jing）。

### 2.3 **glyph 命名空间（12）** —— 十二宫无 slug（`level` 5 个已有）
```ts
export const GLYPH_PALACE_SLUG = {
  子: "gp_zi", 丑: "gp_chou", 寅: "gp_yin", 卯: "gp_mao", 辰: "gp_chen", 巳: "gp_si",
  午: "gp_wu", 未: "gp_wei", 申: "gp_shen", 酉: "gp_you", 戌: "gp_xu", 亥: "gp_hai",
} as const;
```
> **`gp_` 前缀**：与 bazi 的 `branch_zi` 区分（**同是「子」，但 glyph 十二宫 ≠ 八字地支，语义不同**）。

---

## 四、任务 3 · **统一关系 slug**（现有两套，必须合一）
```
CLOSED_SET_SLUG:          六合 → "liu_he"    三合 → "san_he"      ← 带下划线
RELATION_MARKER_PREFIXES: chong / xing / hai / liuhe / banhe / sanhe / stemhe  ← 不带
```
**决定：全部对齐 `RELATION_MARKER_PREFIXES`**（它是**引擎实际打标记用的**，是事实源）：
```ts
export const RELATION_SLUG = {
  冲: "chong", 刑: "xing", 害: "hai",
  六合: "liuhe", 半合: "banhe", 三合: "sanhe", 天干合: "stemhe",
} as const;
```
**同时**：把 `CLOSED_SET_SLUG` 里的 `六合: "liu_he"` / `三合: "san_he"` **改为 `liuhe` / `sanhe`**（或加别名映射），并全局搜引用处一并更新。

---

## 五、任务 4 · 写校验脚本
**文件**：`scripts/verify-terms.ts`
**术语表**：`lib/glossary/pojulife-terms.ts`
**运行**：`npx tsx scripts/verify-terms.ts`（并加 `npm run verify:terms`）

### 六道关卡（任一不过 → **非零退出**，打印清晰错因）
```ts
// 1) slug 合法性：每个 slug 必须存在于以下任一事实源
//    CLOSED_SET_SLUG | WUXING_SLUG | YINYANG_SLUG | RELATION_SLUG | QIMEN_SLUG | GLYPH_PALACE_SLUG | GlyphLevel
// 2) 对应关系：SOURCE[entry.traditional] === entry.slug   （防挂错，本次 24 个错就是这么来的）
// 3) 覆盖率：该批次应命名的 traditional 一个不漏（缺 → 裸词泄漏/无法软译）
// 4) 子串扫描：同一 ns + 同一 locale 内，任意两个 term 互不为子串
//    ★ 血泪教训：`平衡型`(强弱) vs `关键平衡能量`(用神) 撞"平衡" → 审计误伤 term:平衡
// 5) 审计正则：无 term 命中
//    /八字|四柱|日主|用神|忌神|大运|流年|十神|七杀|食神|伤官|命盘|命局|奇门|遁甲|算命|命理/  (audit-output.ts:119)
//    /\b(?:qimen|dunjia)\b/i、占卜|命运|宿命|吉凶|星象
// 6) 单词检查：每个 locale 的 term 必须是【一个词】（无空格、无 "of"/"de" 类短语）
```
**报告输出**：通过数 / 失败明细（哪个 slug、哪一关、期望值 vs 实际值）。

---

## ✅ 验收
1. `CLOSED_SET_SLUG` 的 `liu_he/san_he` 已统一为 `liuhe/sanhe`，引用处全部更新，`tsc` 通过；
2. 新增常量：`WUXING_SLUG(5) / YINYANG_SLUG(2) / QIMEN_SLUG(39) / GLYPH_PALACE_SLUG(12) / RELATION_SLUG(7)`；
3. B1 的 24 个 slug 已按本文件修正，**术语名一字未动**；
4. `npx tsx scripts/verify-terms.ts` **对 B1 全绿**；
5. 脚本对后续 B2–B6 可直接复用（只需在批次清单里加该批 traditional 列表）。

## 改动文件
- `lib/glossary/term-closed-set.ts`（统一 `liuhe/sanhe`；新增 `WUXING_SLUG / YINYANG_SLUG / RELATION_SLUG`）
- **新增** `lib/qimen/qimen-slug.ts`（`QIMEN_SLUG`）
- **新增** `lib/glyph/glyph-slug.ts`（`GLYPH_PALACE_SLUG`）
- `lib/glossary/pojulife-terms.ts`（B1 的 24 个 slug 修正）
- **新增** `scripts/verify-terms.ts` + `package.json` 的 `verify:terms`

---

## 说明
**slug 必须由代码侧一次定死**：协作者看不到代码，若双方各自编 slug 必然漂移（本次 41 个里 24 个挂错，如 `useful_god` 实为 `yong_shen`、`food_god` 实为 `shi_shen`）。
**已核实**：**神煞 24 / 长生 12 / 天干 10 / 地支 12 的 slug 代码里全都有**（勿重建）；**缺的只有五行 5、阴阳 2、qimen 39、glyph 十二宫 12**。
**两个必须解决的冲突**：**① 关系有两套 slug**（`liu_he` vs `liuhe`）→ 统一到引擎实际使用的 `RELATION_MARKER_PREFIXES`；**② 跨空间同名**（「六合」bazi/qimen 皆有、「白虎」bazi 禁词而 qimen 合法）→ 用 **`qm_` / `gp_` 前缀**隔离。
**脚本是这套体系的守门人**：**6 关全过才算完成**，此后每批命名跑一次，人眼永远不用核 slug。
