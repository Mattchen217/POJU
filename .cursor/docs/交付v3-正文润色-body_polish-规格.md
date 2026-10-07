# 交付 v3 · 正文润色 `body_polish`（规格锁）

> **挂接总图**：职责归属见 `交付v3-分步职责与合格尺-SSOT.md`（body vs polish 硬分界）。  
> **定调**：上游做准 / 做真 / 做值钱；本步做「合规可读 + 目标语言出稿」。不是主张纠错器，不替代事实类修法。

## 1. 落位与分工

```
judgment → body（中文真准骨架 · 事实闸 substance_only）→ gate（人审真准）→ body_polish（合规+单语译出 · full+厚度）→ evidence_soft
                                                                    ↘ Skip polish（正文须过 full）→ soft
```

| 步 | 负责 | 硬闸 |
|----|------|------|
| body | 真·准·可执行·贴收集·页定位；**不加厚**；读感/译出归润色 | 仅事实/门槛类（`substance_only`）；表面类 defer |
| gate 人审 | 删掉批断是否垮、是否值钱、页角色（**母语=中文骨架**；不因多语改人审） | — |
| body_polish | **按页厚度**：P3/P4 加厚；其它页合规保量 + 清表面 + 出目标 locale（一次一语） | **full 表面** + **按页厚度闸** |
| Skip polish | 不调用 LLM；对冻结正文跑 **full** | full 不过 → 禁 unlock soft |

- **六页均挂** `body_polish`（Lab）；可 Skip；**单语即可**进 soft（不要求四语齐套）。
- **生产本规格轮不接**；将来按 `site.locale` 只跑对应那一份。
- 不要在 body 步对专名无限加 duty/追正则「抽奖」；表面类 defer 到润色（Skip 则回退 body full）。
- 读感薄 → 改本步；**勿**回逼 body「加厚」。
- **同义换词 ≠ 加厚**（人审与机闸同尺）。

## 2. 任务合同（极窄）

| 做 | 不做 |
|----|------|
| 可见字段按页厚度合同（P3/P4 相对加厚；其它页已完整则保量）+ 出**一个**目标 locale | 一枪四语；改事实、数字、门槛结论、页角色、条数；把 P3 加长尺套到已厚的 P1/P2 |
| 主动避开本页正文机闸类别（与 `gateBodyCategoryB` full 同尺；**换壳同禁**） | 增删 means 条数或改动作指向 |
| 草稿若仍撞表面闸 → 改成合规白话（真词只留 anchors） | 把 `chart_anchors` 真词写进可见层 |
| 同 JSON 形状回写；`chart_anchors` **代码侧按 path 盖回** | 发明 X%/未收集时长；把已拒路径翻成主推 |
| en/fr/es/zh：母语者人设 + 该语高中生读者；**禁中文字对字直译**；**禁中式隐喻脚手架硬译**（energy structure / supply line / relationship beam / 「炙热」天气化等整类）；转化≠translation；剥引号须整句间接改写；P4 禁译成 HR/合同腔 | 用英文正则冒充拦完中文专名类；剥引号留破句；论文腔交差 |
| 重跑时回灌上轮 `failed_rule`（对症避开） | 用润色空转重试代替改正文事实；**C** 剥句妆合格 |

**输入**：闸门人审通过后的 `page_schema`（首次润色前冻结为 `page_schema_pre_polish`）。  
**输出**：同页 schema；落 `page_schema_by_locale[locale]`；当前选用记 `polish_locale`。  
**Skip**：`polish_skipped=true`；`page_schema` = 冻结正文（须已过 full）。

**验收**（跑润色时）：
1. `gateBodyCategoryB(surface:full)`  
2. `gateBodyPolishThickness`（**按页，禁止六页同一把尺**）  
   - **P3 / P4**：正文故意写短 → 润色须相对草稿加长（句数+字数）；同义换词 = 不过。  
   - **P1 / P2 / P5 / P6**：先看正文是否已完整可读；已厚则润色只合规+出语、闸只拦抽瘦/半句未补；仅电报体才要求补句。  
   - **en/fr/es**：不与中文 compactLen 对拍；只验译文自身句数与绝对下限（西文句号计入句数）。  
任一不过 → **不覆盖**正文，本步 fail。

## 3. Lab 合同

- Locale 切换：`zh | en | fr | es`；「运行本 locale」一次一枪。
- 「跳过润色」：对当前页跑 full 表面闸；过才允许 soft。
- 多语对照：多次运行累积 `page_schema_by_locale`；下游 soft/assemble **默认用当前选中 locale**（缺省 zh）。
- 人审升闸仍以**中文 body 骨架**为准。

## 4. 与铁律对齐

- **一次到位**：准/真仍靠 body；润色失败不证明「再翻一次就能修好主张」。
- **闸门不改稿**：润色是独立生成步；闸仍只验。
- **禁案例补丁 / 禁正例照抄**：润色禁区写类别，不写本案二字；不做跨案范文动作清单。
- **换壳同禁**：近义/半否定/拆字/换道具仍算犯。
- **母语可读（en/fr/es + 中译中）**：当面讲给该语高中生；允许扎根 energy picture / 能量画像（**首次短同位语**），禁止 energy-* 脚手架；禁 SAT/论文词堆（siphoned off、volatile、houses in the sky、inner wear-and-tear 等整类，换口语）；自检见 `body-polish.ts` · `nativeVoiceAntiCalque`。

## 5. 本轮不做

- 生产 DAG 挂载  
- 一枪四语扇出  
- polish 改主张 / C 剥句  
- 用英文正则冒充拦完中文专名类  
