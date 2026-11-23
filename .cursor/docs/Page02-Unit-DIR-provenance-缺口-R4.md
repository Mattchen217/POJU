# Page02 · Unit→DIR 生成期 provenance 缺口（R4 调查）

**状态**：调查完成 · **能力未完成** · Page02 **未验收**  
**起点 HEAD**：`55c89d4bda82391af0dc5e3a80f1befda9bdb4f8`  
**定调**：生产无合法 Unit→DIR 时绑定必须为空；不得用模型声明 / 排序 / Fact→DIR 捷径伪造关联。

---

## A–E 结论（生产）

| 问 | 答 |
|---|---|
| A. 生成 BookJudgment 时程序是否已掌握每 unit 的结构化调查方向 / DIR？ | **否** |
| B. 若有，能否用稳定 ID / source_ref / version / hash 追溯？ | **否**（Unit→DIR 无；仅有 cfp/zfp/DC hash 等无关层） |
| C. 模型只返回 claim/anchors/track 时，是否存在不依赖模型声明的映射？ | **否**（生产不传 `authority_edges`） |
| D. 是否存在能证明「某 unit ↔ 某 DIR」的程序数据？ | **否** |
| E. DC Fact→DIR 能否经可验证中间环接到 Unit→DIR？ | **否** — 缺 **program Unit→DIR authority edge** |

```
Fact ──(related_dir_ids ∩ fact_roles ∩ DIR.required_fact_roles)──► DIR   ✅ 存在
Unit ──(program_authority_edge + canonical source_ref)───────────► DIR   ❌ 生产从未发出
Claim–Fact pair ── 需要 Unit→DIR ∩ Fact→DIR ─────────────────────►      ❌ 生产为空
```

---

## 生产调用路径（只读追踪）

1. `lab/run-step-v3.ts` → `runBookJudgmentPackGenerate({ decision_context_snapshot })`  
   — **无** DecisionBlueprint / DDR / `authority_edges`
2. `buildBookJudgmentFeedBlock` — quota（face/segment）+ CFP/ZFP + 可选 DC 切片（05/06/08）；**无** per-unit DIR 表；JSON_SHAPE **无** `related_dir_ids`
3. LLM → `coerceUnits` — `related_dir_ids: []`；模型 DIR 仅进 `declared_related_dir_ids`（审计）
4. `enrichUnitsWithProvenance` — 仅认证 `term_ids` / `source_domain` / `source_version`（cfp/hit）— **非 DIR**
5. `enrichBookJudgmentRelatedDirIds({ pack, dc })` — 省略 edges → `missing_authority: no_program_unit_dir_edges`
6. `buildFace02ProductionContext` — **再次** enrich 且永不接受 caller edges；预注入非空证书被盖空
7. `seedEvidenceRegistryForFace02` — claim 种子 `related_dir_ids: []`
8. `buildTrustedClaimDirBindings` → `buildCrediblePage02FactClaimPairs` — 无非空 trusted dirs ⇒ pairs 空

---

## 禁止当作 Unit→DIR authority（已落实）

- 模型 anchors / `declared_related_dir_ids` / claim·explanation 文本
- `track` / `serves_face` / `serves_segment`
- unit/DIR ID 排序或数量配对
- 同页/同 face 共现、关键词
- **单独的** Fact→DIR（证书 `linked_dir_ids` 仅审计）
- 人工 / SYNTHETIC `authority_edges`
- 模型自写 `source_ref` 字符串

---

## 缺失的数据结构与生产入口（最小下一步，未实施）

| 缺失 | 说明 |
|---|---|
| 生成期 **per-unit** 程序身份 | 今日 unit.id 由模型自由写出；无程序预分配的 DIR 槽位 |
| `ProgramUnitDirAuthorityEdge` 的**真实**生产者 | enricher 接口存在，但 generate / Face02 **禁止**喂入；无 Blueprint/DDR→unit 装配器 |
| 可认证的中间 cite（可选路线） | 类似 `cfp:`/`hit:` 的闭集 `dir:`/`fact:` 程序校验路径 — **未建** |
| Blueprint / InvestigationDirection → BookJudgment | `decision-blueprint` **未**注入 `runBookJudgmentPackGenerate` |

**最小必要改动方向（未来，非本轮）** — 任选其一且须可追溯，禁止模型自我升级：

1. **槽位先于模型**：程序按 DDR/DIR 为 Page02 science 预开 unit 壳（固定 `unit_id`+`dir_id`+source_ref），模型只填 claim/anchors；enrich 只认证槽位。  
2. **闭集 cite 认证**：模型 claim 内写程序可校验的 `dir:<id>` / `fact:<id>`，`enrichUnitsWithProvenance` 同类逻辑对照当前 DC hash 认证后发 edge。  
3. **禁止**：事后用 Fact→DIR 给所有 science unit 批量挂 DIR；禁止排序配对；禁止把 anchors 改名当 authority。

---

## 本轮（R4）做什么 / 不做什么

| 做 | 不做 |
|---|---|
| 固化本缺口为 SSOT 备忘 | 不创建虚假 provenance |
| 回归锁：无真实来源 ⇒ 生产绑定全空 | 不让 SYNTHETIC edge 进生产入口 |
| 保持 R3 证书闸 | 不降低认证要求换非空绑定 |
| | **不宣告** Page02 / R4 能力完成 |
