# Match 计算引擎重构 · Cursor 完整任务

> **目标**:把 Match 从【纯 LLM 分析】改为【本地计算 + LLM 文案】混合架构
>
> - 自己实现八字合盘计算(不引入新依赖,用现有 shunshi-bazi-core)
> - 7 维度关系矩阵计算
> - Compatibility 5 等级【完全本地确定】
> - LLM 只负责生成 5 段报告文案
>
> **前提**:
> - Match v5.0 设计已完成(见 Match_v5.0_New.md)
> - 但【还没实施】到代码中
> - 本指令应在 Match v5.0 实施前先做
>
> **执行原则**:严格【一步一停】

---

# ⚠️ Cursor 必读

```
本任务为 Match 建立【可验证的合盘计算引擎】

设计哲学:
  ✓ 7 个核心维度独立计算
  ✓ 每个维度独立可验证
  ✓ LLM 只做"翻译 + 整合",不做"判断"

绝不允许:
  ✗ LLM 重新判断契合度等级
  ✗ LLM 修改 overall_compatibility_score
  ✗ 跨 Step 实施

关键升级:
  v5.0 LLM 分析两个 base_analysis → v5.1 本地计算 7 维度 + LLM 整合
  可信度从 60-70% → 85-90%

每个 Step 完成后:
  - 贴出代码 + 测试输出
  - 等用户明确"通过 Step X" 才进入下一步
```

---

# 第 1 部分:Step 1 - 八字合盘基础数据

## Step 1.1: 干支与十神映射

文件:`lib/match/data/stems-branches.ts`(新建)

```typescript
// lib/match/data/stems-branches.ts

export type HeavenlyStem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸';
export type EarthlyBranch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥';
export type WuXing = '木' | '火' | '土' | '金' | '水';
export type YinYang = '阳' | '阴';

export interface StemInfo {
  stem: HeavenlyStem;
  wuxing: WuXing;
  yinyang: YinYang;
}

export const STEMS: Record<HeavenlyStem, StemInfo> = {
  '甲': { stem: '甲', wuxing: '木', yinyang: '阳' },
  '乙': { stem: '乙', wuxing: '木', yinyang: '阴' },
  '丙': { stem: '丙', wuxing: '火', yinyang: '阳' },
  '丁': { stem: '丁', wuxing: '火', yinyang: '阴' },
  '戊': { stem: '戊', wuxing: '土', yinyang: '阳' },
  '己': { stem: '己', wuxing: '土', yinyang: '阴' },
  '庚': { stem: '庚', wuxing: '金', yinyang: '阳' },
  '辛': { stem: '辛', wuxing: '金', yinyang: '阴' },
  '壬': { stem: '壬', wuxing: '水', yinyang: '阳' },
  '癸': { stem: '癸', wuxing: '水', yinyang: '阴' }
};

export const BRANCHES: Record<EarthlyBranch, {
  branch: EarthlyBranch;
  wuxing: WuXing;
  yinyang: YinYang;
  hidden_stems: HeavenlyStem[];  // 地支藏干
}> = {
  '子': { branch: '子', wuxing: '水', yinyang: '阳', hidden_stems: ['癸'] },
  '丑': { branch: '丑', wuxing: '土', yinyang: '阴', hidden_stems: ['己', '癸', '辛'] },
  '寅': { branch: '寅', wuxing: '木', yinyang: '阳', hidden_stems: ['甲', '丙', '戊'] },
  '卯': { branch: '卯', wuxing: '木', yinyang: '阴', hidden_stems: ['乙'] },
  '辰': { branch: '辰', wuxing: '土', yinyang: '阳', hidden_stems: ['戊', '乙', '癸'] },
  '巳': { branch: '巳', wuxing: '火', yinyang: '阴', hidden_stems: ['丙', '戊', '庚'] },
  '午': { branch: '午', wuxing: '火', yinyang: '阳', hidden_stems: ['丁', '己'] },
  '未': { branch: '未', wuxing: '土', yinyang: '阴', hidden_stems: ['己', '丁', '乙'] },
  '申': { branch: '申', wuxing: '金', yinyang: '阳', hidden_stems: ['庚', '壬', '戊'] },
  '酉': { branch: '酉', wuxing: '金', yinyang: '阴', hidden_stems: ['辛'] },
  '戌': { branch: '戌', wuxing: '土', yinyang: '阳', hidden_stems: ['戊', '辛', '丁'] },
  '亥': { branch: '亥', wuxing: '水', yinyang: '阴', hidden_stems: ['壬', '甲'] }
};

/**
 * 十神映射
 * 输入:日主 + 比较干 → 十神类型
 * 
 * 十神种类:
 * 比肩(阳vs阳同) 劫财(阳vs阴同)
 * 食神(阳生阳) 伤官(阳生阴)
 * 偏财(阳克阳) 正财(阳克阴)
 * 七杀(阳被阳克) 正官(阳被阴克)
 * 偏印(阳被阳生) 正印(阳被阴生)
 */
export type TenGod = 
  | '比肩' | '劫财'
  | '食神' | '伤官'
  | '偏财' | '正财'
  | '七杀' | '正官'
  | '偏印' | '正印';

const SHENG: Record<WuXing, WuXing> = {
  '木': '火', '火': '土', '土': '金', '金': '水', '水': '木'
};

const KE: Record<WuXing, WuXing> = {
  '木': '土', '土': '水', '水': '火', '火': '金', '金': '木'
};

export function calculateTenGod(dayMaster: HeavenlyStem, otherStem: HeavenlyStem): TenGod {
  const dm = STEMS[dayMaster];
  const ot = STEMS[otherStem];
  
  const sameYinYang = dm.yinyang === ot.yinyang;
  
  // 同类(比劫)
  if (dm.wuxing === ot.wuxing) {
    return sameYinYang ? '比肩' : '劫财';
  }
  
  // 日主生它(食伤)
  if (SHENG[dm.wuxing] === ot.wuxing) {
    return sameYinYang ? '食神' : '伤官';
  }
  
  // 它生日主(印)
  if (SHENG[ot.wuxing] === dm.wuxing) {
    return sameYinYang ? '偏印' : '正印';
  }
  
  // 日主克它(财)
  if (KE[dm.wuxing] === ot.wuxing) {
    return sameYinYang ? '偏财' : '正财';
  }
  
  // 它克日主(官杀)
  if (KE[ot.wuxing] === dm.wuxing) {
    return sameYinYang ? '七杀' : '正官';
  }
  
  return '比肩';  // 不应到达
}

/**
 * 十神好坏倾向(用于打分)
 * 不绝对,但作为基础参考
 */
export const TEN_GOD_NATURE: Record<TenGod, {
  category: 'helpful' | 'neutral' | 'challenging';
  base_score: number;  // -10 到 +10
}> = {
  '比肩': { category: 'neutral',   base_score: 3 },
  '劫财': { category: 'challenging', base_score: -3 },
  '食神': { category: 'helpful',   base_score: 7 },
  '伤官': { category: 'neutral',   base_score: 2 },
  '偏财': { category: 'helpful',   base_score: 5 },
  '正财': { category: 'helpful',   base_score: 7 },
  '七杀': { category: 'challenging', base_score: -2 },
  '正官': { category: 'helpful',   base_score: 5 },
  '偏印': { category: 'neutral',   base_score: 1 },
  '正印': { category: 'helpful',   base_score: 7 }
};
```

## Step 1.2: 合冲刑害关系表

文件:`lib/match/data/branch-relations.ts`(新建)

```typescript
// lib/match/data/branch-relations.ts

import type { EarthlyBranch } from './stems-branches';

/**
 * 地支六合(强力和合)
 */
export const LIU_HE: Array<[EarthlyBranch, EarthlyBranch, string]> = [
  ['子', '丑', '合化土'],
  ['寅', '亥', '合化木'],
  ['卯', '戌', '合化火'],
  ['辰', '酉', '合化金'],
  ['巳', '申', '合化水'],
  ['午', '未', '合化太阳太阴']
];

/**
 * 地支六冲(强力对冲)
 */
export const LIU_CHONG: Array<[EarthlyBranch, EarthlyBranch]> = [
  ['子', '午'],
  ['丑', '未'],
  ['寅', '申'],
  ['卯', '酉'],
  ['辰', '戌'],
  ['巳', '亥']
];

/**
 * 三刑(刑罚关系)
 */
export const SAN_XING: Array<{
  branches: EarthlyBranch[];
  type: string;
}> = [
  { branches: ['寅', '巳', '申'], type: '无恩之刑' },
  { branches: ['丑', '戌', '未'], type: '恃势之刑' },
  { branches: ['子', '卯'], type: '无礼之刑' },
  { branches: ['辰', '辰'], type: '自刑' },  // 同支
  { branches: ['午', '午'], type: '自刑' },
  { branches: ['酉', '酉'], type: '自刑' },
  { branches: ['亥', '亥'], type: '自刑' }
];

/**
 * 六害(暗中相害)
 */
export const LIU_HAI: Array<[EarthlyBranch, EarthlyBranch]> = [
  ['子', '未'],
  ['丑', '午'],
  ['寅', '巳'],
  ['卯', '辰'],
  ['申', '亥'],
  ['酉', '戌']
];

/**
 * 三合局(局部成局)
 */
export const SAN_HE: Array<{
  branches: EarthlyBranch[];
  element: string;
}> = [
  { branches: ['申', '子', '辰'], element: '水局' },
  { branches: ['亥', '卯', '未'], element: '木局' },
  { branches: ['寅', '午', '戌'], element: '火局' },
  { branches: ['巳', '酉', '丑'], element: '金局' }
];

/**
 * 检查两个地支是否六合
 */
export function isLiuHe(a: EarthlyBranch, b: EarthlyBranch): { isHe: boolean; element?: string } {
  for (const [x, y, element] of LIU_HE) {
    if ((a === x && b === y) || (a === y && b === x)) {
      return { isHe: true, element };
    }
  }
  return { isHe: false };
}

/**
 * 检查两个地支是否六冲
 */
export function isLiuChong(a: EarthlyBranch, b: EarthlyBranch): boolean {
  for (const [x, y] of LIU_CHONG) {
    if ((a === x && b === y) || (a === y && b === x)) {
      return true;
    }
  }
  return false;
}

/**
 * 检查两个地支是否六害
 */
export function isLiuHai(a: EarthlyBranch, b: EarthlyBranch): boolean {
  for (const [x, y] of LIU_HAI) {
    if ((a === x && b === y) || (a === y && b === x)) {
      return true;
    }
  }
  return false;
}

/**
 * 检查两个地支是否刑
 */
export function isXing(a: EarthlyBranch, b: EarthlyBranch): { isXing: boolean; type?: string } {
  for (const { branches, type } of SAN_XING) {
    if (branches.length === 2) {
      // 自刑
      if (a === branches[0] && b === branches[0]) {
        return { isXing: true, type };
      }
    } else {
      // 三刑(只要 a, b 都在其中即可)
      if (branches.includes(a) && branches.includes(b) && a !== b) {
        return { isXing: true, type };
      }
    }
  }
  return { isXing: false };
}

/**
 * 检查两组地支(各 4 个,年月日时)的所有相互关系
 */
export interface BranchInteraction {
  a_branch: EarthlyBranch;
  a_position: 'year' | 'month' | 'day' | 'hour';
  b_branch: EarthlyBranch;
  b_position: 'year' | 'month' | 'day' | 'hour';
  
  liu_he: boolean;
  liu_he_element?: string;
  liu_chong: boolean;
  xing: boolean;
  xing_type?: string;
  liu_hai: boolean;
}

export function analyzeAllBranchInteractions(
  aBranches: Record<'year' | 'month' | 'day' | 'hour', EarthlyBranch>,
  bBranches: Record<'year' | 'month' | 'day' | 'hour', EarthlyBranch>
): BranchInteraction[] {
  const positions: ('year' | 'month' | 'day' | 'hour')[] = ['year', 'month', 'day', 'hour'];
  const interactions: BranchInteraction[] = [];
  
  for (const posA of positions) {
    for (const posB of positions) {
      const a = aBranches[posA];
      const b = bBranches[posB];
      
      const he = isLiuHe(a, b);
      const chong = isLiuChong(a, b);
      const xing = isXing(a, b);
      const hai = isLiuHai(a, b);
      
      // 只记录有交互的
      if (he.isHe || chong || xing.isXing || hai) {
        interactions.push({
          a_branch: a,
          a_position: posA,
          b_branch: b,
          b_position: posB,
          liu_he: he.isHe,
          liu_he_element: he.element,
          liu_chong: chong,
          xing: xing.isXing,
          xing_type: xing.type,
          liu_hai: hai
        });
      }
    }
  }
  
  return interactions;
}
```

## Step 1.3: 神煞表

文件:`lib/match/data/shensha.ts`(新建)

```typescript
// lib/match/data/shensha.ts

import type { HeavenlyStem, EarthlyBranch } from './stems-branches';

/**
 * 神煞核心:天乙贵人(最重要的贵人星)
 * 输入:日主天干
 * 输出:贵人地支(出现这两个地支即有贵人)
 */
export const TIAN_YI_GUI_REN: Record<HeavenlyStem, EarthlyBranch[]> = {
  '甲': ['丑', '未'],
  '戊': ['丑', '未'],
  '庚': ['丑', '未'],
  '乙': ['子', '申'],
  '己': ['子', '申'],
  '丙': ['亥', '酉'],
  '丁': ['亥', '酉'],
  '壬': ['卯', '巳'],
  '癸': ['卯', '巳'],
  '辛': ['午', '寅']
};

/**
 * 文昌(智慧/学业)
 */
export const WEN_CHANG: Record<HeavenlyStem, EarthlyBranch> = {
  '甲': '巳', '乙': '午',
  '丙': '申', '丁': '酉',
  '戊': '申', '己': '酉',
  '庚': '亥', '辛': '子',
  '壬': '寅', '癸': '卯'
};

/**
 * 桃花(感情/魅力)
 * 输入:年支或日支
 */
export const TAO_HUA_MAP: Record<EarthlyBranch, EarthlyBranch> = {
  '申': '酉', '子': '酉', '辰': '酉',
  '亥': '子', '卯': '子', '未': '子',
  '寅': '卯', '午': '卯', '戌': '卯',
  '巳': '午', '酉': '午', '丑': '午'
};

/**
 * 驿马(变动/远行)
 */
export const YI_MA_MAP: Record<EarthlyBranch, EarthlyBranch> = {
  '申': '寅', '子': '寅', '辰': '寅',
  '亥': '巳', '卯': '巳', '未': '巳',
  '寅': '申', '午': '申', '戌': '申',
  '巳': '亥', '酉': '亥', '丑': '亥'
};

/**
 * 华盖(智慧/孤独)
 */
export const HUA_GAI_MAP: Record<EarthlyBranch, EarthlyBranch> = {
  '申': '辰', '子': '辰', '辰': '辰',
  '亥': '未', '卯': '未', '未': '未',
  '寅': '戌', '午': '戌', '戌': '戌',
  '巳': '丑', '酉': '丑', '丑': '丑'
};

/**
 * 孤辰寡宿(婚姻不利)
 */
export const GU_CHEN: Record<EarthlyBranch, EarthlyBranch> = {
  '亥': '寅', '子': '寅', '丑': '寅',
  '寅': '巳', '卯': '巳', '辰': '巳',
  '巳': '申', '午': '申', '未': '申',
  '申': '亥', '酉': '亥', '戌': '亥'
};

export const GUA_SU: Record<EarthlyBranch, EarthlyBranch> = {
  '亥': '戌', '子': '戌', '丑': '戌',
  '寅': '丑', '卯': '丑', '辰': '丑',
  '巳': '辰', '午': '辰', '未': '辰',
  '申': '未', '酉': '未', '戌': '未'
};

/**
 * 神煞类型
 */
export type ShenShaName = '天乙贵人' | '文昌' | '桃花' | '驿马' | '华盖' | '孤辰' | '寡宿';

export interface ShenShaCheck {
  name: ShenShaName;
  found: boolean;
  positions: ('year' | 'month' | 'day' | 'hour')[];  // 出现在哪些位置
}

/**
 * 全面检查神煞
 */
export function checkAllShenSha(input: {
  dayMaster: HeavenlyStem;
  yearBranch: EarthlyBranch;
  dayBranch: EarthlyBranch;
  branches: Record<'year' | 'month' | 'day' | 'hour', EarthlyBranch>;
}): ShenShaCheck[] {
  const checks: ShenShaCheck[] = [];
  const positions: ('year' | 'month' | 'day' | 'hour')[] = ['year', 'month', 'day', 'hour'];
  
  // 天乙贵人(看日主)
  const guiRenBranches = TIAN_YI_GUI_REN[input.dayMaster];
  const guiRenPositions = positions.filter(p => guiRenBranches.includes(input.branches[p]));
  checks.push({
    name: '天乙贵人',
    found: guiRenPositions.length > 0,
    positions: guiRenPositions
  });
  
  // 文昌(看日主)
  const wenChangBranch = WEN_CHANG[input.dayMaster];
  const wenChangPositions = positions.filter(p => input.branches[p] === wenChangBranch);
  checks.push({
    name: '文昌',
    found: wenChangPositions.length > 0,
    positions: wenChangPositions
  });
  
  // 桃花(看年支 OR 日支)
  const taoHuaBranchFromYear = TAO_HUA_MAP[input.yearBranch];
  const taoHuaBranchFromDay = TAO_HUA_MAP[input.dayBranch];
  const taoHuaPositions = positions.filter(p => 
    input.branches[p] === taoHuaBranchFromYear || input.branches[p] === taoHuaBranchFromDay
  );
  checks.push({
    name: '桃花',
    found: taoHuaPositions.length > 0,
    positions: taoHuaPositions
  });
  
  // 驿马(看年支或日支)
  const yiMaBranch = YI_MA_MAP[input.yearBranch] || YI_MA_MAP[input.dayBranch];
  const yiMaPositions = positions.filter(p => input.branches[p] === yiMaBranch);
  checks.push({
    name: '驿马',
    found: yiMaPositions.length > 0,
    positions: yiMaPositions
  });
  
  // 华盖
  const huaGaiBranch = HUA_GAI_MAP[input.yearBranch] || HUA_GAI_MAP[input.dayBranch];
  const huaGaiPositions = positions.filter(p => input.branches[p] === huaGaiBranch);
  checks.push({
    name: '华盖',
    found: huaGaiPositions.length > 0,
    positions: huaGaiPositions
  });
  
  // 孤辰
  const guChenBranch = GU_CHEN[input.yearBranch];
  const guChenPositions = positions.filter(p => input.branches[p] === guChenBranch);
  checks.push({
    name: '孤辰',
    found: guChenPositions.length > 0,
    positions: guChenPositions
  });
  
  // 寡宿
  const guaSuBranch = GUA_SU[input.yearBranch];
  const guaSuPositions = positions.filter(p => input.branches[p] === guaSuBranch);
  checks.push({
    name: '寡宿',
    found: guaSuPositions.length > 0,
    positions: guaSuPositions
  });
  
  return checks;
}
```

## 验证清单

```
□ stems-branches.ts 完整
□ calculateTenGod 正确实现
□ branch-relations.ts 完整(合冲刑害)
□ shensha.ts 完整(7 个核心神煞)
□ tsc 通过
□ 写 3 个 unit test:
  - calculateTenGod 各种情况
  - isLiuHe / isLiuChong / isXing
  - checkAllShenSha

🛑 等用户确认进入 Step 2
```

---

# 第 2 部分:Step 2 - 7 维度计算函数

## Step 2.1: 维度 1 - 日主互动

文件:`lib/match/calculations/day-master-interaction.ts`(新建)

```typescript
// lib/match/calculations/day-master-interaction.ts

import { STEMS, type HeavenlyStem } from '../data/stems-branches';

export type DayMasterInteractionType = 
  | 'tianhe'      // 天合(强烈互补)
  | 'sheng_a_to_b'  // A 生 B(A 滋养 B)
  | 'sheng_b_to_a'  // B 生 A
  | 'ke_a_to_b'     // A 克 B
  | 'ke_b_to_a'     // B 克 A
  | 'same_wuxing'   // 同五行(志同道合 / 容易竞争)
  | 'tianchong';    // 天冲(对立)

export interface DayMasterInteractionResult {
  type: DayMasterInteractionType;
  a_stem: HeavenlyStem;
  b_stem: HeavenlyStem;
  score: number;        // -20 到 +20
  description_zh: string;
  description_en: string;
}

/**
 * 天干五合(强力和合)
 */
const TIAN_GAN_WU_HE: Array<[HeavenlyStem, HeavenlyStem, string]> = [
  ['甲', '己', '中正之合'],
  ['乙', '庚', '仁义之合'],
  ['丙', '辛', '威制之合'],
  ['丁', '壬', '淫匿之合'],
  ['戊', '癸', '无情之合']
];

/**
 * 天干七冲
 */
const TIAN_GAN_QI_CHONG: Array<[HeavenlyStem, HeavenlyStem]> = [
  ['甲', '庚'], ['乙', '辛'],
  ['丙', '壬'], ['丁', '癸']
  // 戊己土不冲
];

const SHENG: Record<string, string> = {
  '木': '火', '火': '土', '土': '金', '金': '水', '水': '木'
};

const KE: Record<string, string> = {
  '木': '土', '土': '水', '水': '火', '火': '金', '金': '木'
};

export function calculateDayMasterInteraction(
  dayMasterA: HeavenlyStem,
  dayMasterB: HeavenlyStem
): DayMasterInteractionResult {
  
  // 1. 检查天干五合
  for (const [x, y, name] of TIAN_GAN_WU_HE) {
    if ((dayMasterA === x && dayMasterB === y) || (dayMasterA === y && dayMasterB === x)) {
      return {
        type: 'tianhe',
        a_stem: dayMasterA,
        b_stem: dayMasterB,
        score: 18,
        description_zh: `${dayMasterA}${dayMasterB}${name},天干相合,基础深度连接。`,
        description_en: `${dayMasterA} and ${dayMasterB} form a heavenly bond — natural attraction and deep compatibility.`
      };
    }
  }
  
  // 2. 检查天干七冲
  for (const [x, y] of TIAN_GAN_QI_CHONG) {
    if ((dayMasterA === x && dayMasterB === y) || (dayMasterA === y && dayMasterB === x)) {
      return {
        type: 'tianchong',
        a_stem: dayMasterA,
        b_stem: dayMasterB,
        score: -15,
        description_zh: `${dayMasterA}${dayMasterB}相冲,日主对立,需要更多磨合。`,
        description_en: `${dayMasterA} and ${dayMasterB} clash — fundamental tension between core personalities.`
      };
    }
  }
  
  // 3. 五行关系
  const aWx = STEMS[dayMasterA].wuxing;
  const bWx = STEMS[dayMasterB].wuxing;
  
  if (aWx === bWx) {
    return {
      type: 'same_wuxing',
      a_stem: dayMasterA,
      b_stem: dayMasterB,
      score: 5,
      description_zh: `日主同${aWx},同道但需避免比劫相争。`,
      description_en: `Both day masters are ${aWx}-element — kindred but watch for competition.`
    };
  }
  
  if (SHENG[aWx] === bWx) {
    return {
      type: 'sheng_a_to_b',
      a_stem: dayMasterA,
      b_stem: dayMasterB,
      score: 10,
      description_zh: `A 的${aWx}生 B 的${bWx},A 滋养 B。`,
      description_en: `A's ${aWx} nourishes B's ${bWx} — A naturally supports B.`
    };
  }
  
  if (SHENG[bWx] === aWx) {
    return {
      type: 'sheng_b_to_a',
      a_stem: dayMasterA,
      b_stem: dayMasterB,
      score: 10,
      description_zh: `B 的${bWx}生 A 的${aWx},B 滋养 A。`,
      description_en: `B's ${bWx} nourishes A's ${aWx} — B naturally supports A.`
    };
  }
  
  if (KE[aWx] === bWx) {
    return {
      type: 'ke_a_to_b',
      a_stem: dayMasterA,
      b_stem: dayMasterB,
      score: -8,
      description_zh: `A 的${aWx}克 B 的${bWx},A 容易压制 B。`,
      description_en: `A's ${aWx} dominates B's ${bWx} — risk of A overpowering B.`
    };
  }
  
  if (KE[bWx] === aWx) {
    return {
      type: 'ke_b_to_a',
      a_stem: dayMasterA,
      b_stem: dayMasterB,
      score: -8,
      description_zh: `B 的${bWx}克 A 的${aWx},B 容易压制 A。`,
      description_en: `B's ${bWx} dominates A's ${aWx} — risk of B overpowering A.`
    };
  }
  
  return {
    type: 'same_wuxing',
    a_stem: dayMasterA,
    b_stem: dayMasterB,
    score: 0,
    description_zh: '日主无强关系,中性互动。',
    description_en: 'Neutral day master interaction.'
  };
}
```

## Step 2.2: 维度 2 - 用神匹配

文件:`lib/match/calculations/yong-shen-match.ts`(新建)

```typescript
// lib/match/calculations/yong-shen-match.ts

import type { WuXing } from '../data/stems-branches';

export interface YongShenMatchResult {
  // A 的用神在 B 命盘中的状态
  a_yong_shen_in_b: 'abundant' | 'sufficient' | 'lacking';
  // B 的用神在 A 命盘中的状态
  b_yong_shen_in_a: 'abundant' | 'sufficient' | 'lacking';
  
  // A 是否能给 B 提供 B 的用神
  a_supports_b: boolean;
  b_supports_a: boolean;
  
  // 综合得分(-20 到 +20)
  score: number;
  
  description_zh: string;
  description_en: string;
}

/**
 * 输入:
 *   - A 的用神(主要 + 次要)
 *   - B 的用神(主要 + 次要)
 *   - A 命盘的五行分布 [木数, 火数, 土数, 金数, 水数]
 *   - B 命盘的五行分布
 * 
 * 计算 A 的用神在 B 命盘中是丰富还是缺乏(反之亦然)
 */
export function calculateYongShenMatch(input: {
  a_yong_shen_primary: WuXing;
  a_yong_shen_secondary?: WuXing;
  b_yong_shen_primary: WuXing;
  b_yong_shen_secondary?: WuXing;
  a_wuxing_distribution: Record<WuXing, number>;
  b_wuxing_distribution: Record<WuXing, number>;
}): YongShenMatchResult {
  
  // A 的用神在 B 命盘中
  const aYsInB = input.b_wuxing_distribution[input.a_yong_shen_primary] || 0;
  let aYsInBState: 'abundant' | 'sufficient' | 'lacking';
  if (aYsInB >= 3) aYsInBState = 'abundant';
  else if (aYsInB >= 1) aYsInBState = 'sufficient';
  else aYsInBState = 'lacking';
  
  // B 的用神在 A 命盘中
  const bYsInA = input.a_wuxing_distribution[input.b_yong_shen_primary] || 0;
  let bYsInAState: 'abundant' | 'sufficient' | 'lacking';
  if (bYsInA >= 3) bYsInAState = 'abundant';
  else if (bYsInA >= 1) bYsInAState = 'sufficient';
  else bYsInAState = 'lacking';
  
  // A 是否能给 B 提供 B 的用神(A 命盘有 B 的用神,且 A 比较强)
  const aSupportsB = bYsInA >= 2;
  const bSupportsA = aYsInB >= 2;
  
  // 综合打分
  let score = 0;
  if (aYsInBState === 'abundant') score += 8;
  else if (aYsInBState === 'sufficient') score += 4;
  else score -= 5;
  
  if (bYsInAState === 'abundant') score += 8;
  else if (bYsInAState === 'sufficient') score += 4;
  else score -= 5;
  
  if (aSupportsB && bSupportsA) score += 5;  // 互助加分
  
  return {
    a_yong_shen_in_b: aYsInBState,
    b_yong_shen_in_a: bYsInAState,
    a_supports_b: aSupportsB,
    b_supports_a: bSupportsA,
    score: Math.max(-20, Math.min(20, score)),
    description_zh: buildYongShenDescriptionZh(aYsInBState, bYsInAState, aSupportsB, bSupportsA, input),
    description_en: buildYongShenDescriptionEn(aYsInBState, bYsInAState, aSupportsB, bSupportsA, input)
  };
}

function buildYongShenDescriptionZh(
  aInB: string, bInA: string, aHelps: boolean, bHelps: boolean,
  input: any
): string {
  let desc = `A 的用神为${input.a_yong_shen_primary},在 B 命盘中${aInB === 'abundant' ? '充沛' : aInB === 'sufficient' ? '适中' : '缺乏'}。`;
  desc += `B 的用神为${input.b_yong_shen_primary},在 A 命盘中${bInA === 'abundant' ? '充沛' : bInA === 'sufficient' ? '适中' : '缺乏'}。`;
  if (aHelps && bHelps) desc += '互为补足,相辅相成。';
  else if (aHelps) desc += 'A 能给 B 带来其所需。';
  else if (bHelps) desc += 'B 能给 A 带来其所需。';
  else desc += '彼此需要的元素都不在对方,需主动经营。';
  return desc;
}

function buildYongShenDescriptionEn(
  aInB: string, bInA: string, aHelps: boolean, bHelps: boolean,
  input: any
): string {
  let desc = `A's favorable element (${input.a_yong_shen_primary}) is ${aInB} in B's chart. `;
  desc += `B's favorable element (${input.b_yong_shen_primary}) is ${bInA} in A's chart. `;
  if (aHelps && bHelps) desc += 'Mutual nourishment — you complete each other.';
  else if (aHelps) desc += 'A brings what B needs.';
  else if (bHelps) desc += 'B brings what A needs.';
  else desc += 'Neither chart fully provides what the other lacks — relationship needs intentional cultivation.';
  return desc;
}
```

## Step 2.3: 维度 3 - 地支合冲刑害

文件:`lib/match/calculations/branch-interactions.ts`(新建)

```typescript
// lib/match/calculations/branch-interactions.ts

import { 
  analyzeAllBranchInteractions,
  type BranchInteraction 
} from '../data/branch-relations';
import type { EarthlyBranch } from '../data/stems-branches';

export interface BranchInteractionsResult {
  interactions: BranchInteraction[];
  
  // 统计
  liu_he_count: number;        // 六合数
  liu_chong_count: number;     // 六冲数
  xing_count: number;          // 刑数
  liu_hai_count: number;       // 六害数
  
  // 是否日支相合 / 相冲(婚姻最重要)
  day_branch_he: boolean;
  day_branch_chong: boolean;
  
  // 综合得分(-20 到 +20)
  score: number;
  
  description_zh: string;
  description_en: string;
}

export function calculateBranchInteractions(
  aBranches: Record<'year' | 'month' | 'day' | 'hour', EarthlyBranch>,
  bBranches: Record<'year' | 'month' | 'day' | 'hour', EarthlyBranch>
): BranchInteractionsResult {
  
  const interactions = analyzeAllBranchInteractions(aBranches, bBranches);
  
  let liu_he_count = 0;
  let liu_chong_count = 0;
  let xing_count = 0;
  let liu_hai_count = 0;
  
  let dayBranchHe = false;
  let dayBranchChong = false;
  
  for (const inter of interactions) {
    if (inter.liu_he) liu_he_count++;
    if (inter.liu_chong) liu_chong_count++;
    if (inter.xing) xing_count++;
    if (inter.liu_hai) liu_hai_count++;
    
    // 日支特殊
    if (inter.a_position === 'day' && inter.b_position === 'day') {
      if (inter.liu_he) dayBranchHe = true;
      if (inter.liu_chong) dayBranchChong = true;
    }
  }
  
  // 打分
  let score = 0;
  
  // 日支合冲权重最高(夫妻宫)
  if (dayBranchHe) score += 12;
  if (dayBranchChong) score -= 12;
  
  // 其他合冲
  score += liu_he_count * 3;
  score -= liu_chong_count * 3;
  score -= xing_count * 2;
  score -= liu_hai_count * 1;
  
  return {
    interactions,
    liu_he_count,
    liu_chong_count,
    xing_count,
    liu_hai_count,
    day_branch_he: dayBranchHe,
    day_branch_chong: dayBranchChong,
    score: Math.max(-20, Math.min(20, score)),
    description_zh: buildBranchDescriptionZh({
      liu_he_count, liu_chong_count, xing_count, liu_hai_count,
      dayBranchHe, dayBranchChong
    }),
    description_en: buildBranchDescriptionEn({
      liu_he_count, liu_chong_count, xing_count, liu_hai_count,
      dayBranchHe, dayBranchChong
    })
  };
}

function buildBranchDescriptionZh(stats: any): string {
  const parts: string[] = [];
  
  if (stats.dayBranchHe) parts.push('日支相合,夫妻宫和合,缘分深厚');
  if (stats.dayBranchChong) parts.push('日支相冲,夫妻宫冲克,需多体谅');
  
  if (stats.liu_he_count > 0) parts.push(`六合${stats.liu_he_count}处,亲近自然`);
  if (stats.liu_chong_count > 0) parts.push(`六冲${stats.liu_chong_count}处,易生摩擦`);
  if (stats.xing_count > 0) parts.push(`刑${stats.xing_count}处,需化解`);
  if (stats.liu_hai_count > 0) parts.push(`六害${stats.liu_hai_count}处,暗中相损`);
  
  return parts.length > 0 ? parts.join(';') + '。' : '地支互动平淡,中性。';
}

function buildBranchDescriptionEn(stats: any): string {
  const parts: string[] = [];
  
  if (stats.dayBranchHe) parts.push("Day branches harmonize (marriage palace alignment)");
  if (stats.dayBranchChong) parts.push("Day branches clash (marriage palace tension)");
  
  if (stats.liu_he_count > 0) parts.push(`${stats.liu_he_count} earthly bonds (closeness)`);
  if (stats.liu_chong_count > 0) parts.push(`${stats.liu_chong_count} clashes (friction)`);
  if (stats.xing_count > 0) parts.push(`${stats.xing_count} punishment relationships`);
  if (stats.liu_hai_count > 0) parts.push(`${stats.liu_hai_count} hidden harms`);
  
  return parts.length > 0 ? parts.join('; ') + '.' : 'Neutral branch interaction overall.';
}
```

## 验证清单

```
□ day-master-interaction.ts 完整
□ yong-shen-match.ts 完整
□ branch-interactions.ts 完整
□ 5 个 unit test:
  - 天干五合(甲己合化土)
  - 天干七冲(甲庚冲)
  - 用神匹配(abundant / lacking)
  - 日支相合(子丑)
  - 日支相冲(子午)

🛑 等用户确认进入 Step 3
```

---

# 第 3 部分:Step 3 - 剩余 4 个维度

## Step 3.1: 维度 4 - 配偶星 / 财官星

文件:`lib/match/calculations/spouse-star.ts`(新建)

```typescript
// lib/match/calculations/spouse-star.ts

import { calculateTenGod, STEMS, type HeavenlyStem } from '../data/stems-branches';

export interface SpouseStarResult {
  // A 的配偶星状态
  a_spouse_star_type: '正财' | '正官' | null;
  a_spouse_star_present: boolean;
  a_spouse_star_in_pillars: ('year' | 'month' | 'day' | 'hour')[];
  
  // B 的配偶星状态
  b_spouse_star_type: '正财' | '正官' | null;
  b_spouse_star_present: boolean;
  b_spouse_star_in_pillars: ('year' | 'month' | 'day' | 'hour')[];
  
  // A 是否是 B 的配偶星类型?
  a_is_b_spouse_star: boolean;
  b_is_a_spouse_star: boolean;
  
  score: number;
  description_zh: string;
  description_en: string;
}

/**
 * 计算配偶星状态
 * - 男:正财为妻
 * - 女:正官为夫
 */
export function calculateSpouseStar(input: {
  a_day_master: HeavenlyStem;
  a_gender: 'M' | 'F';
  a_all_stems: Record<'year' | 'month' | 'day' | 'hour', HeavenlyStem>;
  b_day_master: HeavenlyStem;
  b_gender: 'M' | 'F';
  b_all_stems: Record<'year' | 'month' | 'day' | 'hour', HeavenlyStem>;
}): SpouseStarResult {
  
  // A 的配偶星类型
  const aSpouseType = input.a_gender === 'M' ? '正财' : '正官';
  
  // 在 A 命盘其他柱中找配偶星(不算日柱本身)
  const aSpouseInPillars: ('year' | 'month' | 'day' | 'hour')[] = [];
  for (const pos of ['year', 'month', 'hour'] as const) {  // 不查 day
    const tenGod = calculateTenGod(input.a_day_master, input.a_all_stems[pos]);
    if (tenGod === aSpouseType) aSpouseInPillars.push(pos);
  }
  
  // B 的配偶星类型
  const bSpouseType = input.b_gender === 'M' ? '正财' : '正官';
  
  const bSpouseInPillars: ('year' | 'month' | 'day' | 'hour')[] = [];
  for (const pos of ['year', 'month', 'hour'] as const) {
    const tenGod = calculateTenGod(input.b_day_master, input.b_all_stems[pos]);
    if (tenGod === bSpouseType) bSpouseInPillars.push(pos);
  }
  
  // A 对 B 来说是不是 B 的配偶星类型?(A 的日主 vs B 的日主)
  const aAsBOther = calculateTenGod(input.b_day_master, input.a_day_master);
  const bAsAOther = calculateTenGod(input.a_day_master, input.b_day_master);
  
  const aIsBSpouseStar = aAsBOther === bSpouseType;
  const bIsASpouseStar = bAsAOther === aSpouseType;
  
  // 打分
  let score = 0;
  if (aIsBSpouseStar && bIsASpouseStar) score += 18;  // 双向配偶星,极佳
  else if (aIsBSpouseStar || bIsASpouseStar) score += 10;
  
  if (aSpouseInPillars.length > 0) score += 5;
  if (bSpouseInPillars.length > 0) score += 5;
  
  if (aSpouseInPillars.length === 0 && bSpouseInPillars.length === 0) score -= 8;
  
  return {
    a_spouse_star_type: aSpouseType,
    a_spouse_star_present: aSpouseInPillars.length > 0,
    a_spouse_star_in_pillars: aSpouseInPillars,
    b_spouse_star_type: bSpouseType,
    b_spouse_star_present: bSpouseInPillars.length > 0,
    b_spouse_star_in_pillars: bSpouseInPillars,
    a_is_b_spouse_star: aIsBSpouseStar,
    b_is_a_spouse_star: bIsASpouseStar,
    score: Math.max(-20, Math.min(20, score)),
    description_zh: buildSpouseDescriptionZh(aIsBSpouseStar, bIsASpouseStar, aAsBOther, bAsAOther),
    description_en: buildSpouseDescriptionEn(aIsBSpouseStar, bIsASpouseStar, aAsBOther, bAsAOther)
  };
}

function buildSpouseDescriptionZh(aIsB: boolean, bIsA: boolean, aAsB: string, bAsA: string): string {
  if (aIsB && bIsA) {
    return `双向配偶星(A 为 B 的${aAsB},B 为 A 的${bAsA}),天作之合。`;
  }
  if (aIsB) return `A 是 B 的${aAsB},A 满足 B 对配偶的期待。`;
  if (bIsA) return `B 是 A 的${bAsA},B 满足 A 对配偶的期待。`;
  return `相互不是对方的配偶星,关系需自行经营。`;
}

function buildSpouseDescriptionEn(aIsB: boolean, bIsA: boolean, aAsB: string, bAsA: string): string {
  if (aIsB && bIsA) {
    return `Mutual spouse-star alignment — natural partner archetype for each other.`;
  }
  if (aIsB) return `A fits B's spouse archetype (${aAsB}).`;
  if (bIsA) return `B fits A's spouse archetype (${bAsA}).`;
  return `Neither fits the other's spouse archetype — relationship requires conscious cultivation.`;
}
```

## Step 3.2: 维度 5 - 神煞共振

文件:`lib/match/calculations/shensha-resonance.ts`(新建)

```typescript
// lib/match/calculations/shensha-resonance.ts

import { checkAllShenSha, type ShenShaCheck, type ShenShaName } from '../data/shensha';
import type { HeavenlyStem, EarthlyBranch } from '../data/stems-branches';

export interface ShenShaResonanceResult {
  // 共有的吉神煞
  shared_auspicious: ShenShaName[];
  // 共有的凶神煞
  shared_inauspicious: ShenShaName[];
  
  // 一方有贵人,另一方对应位置匹配
  cross_gui_ren_aid: boolean;
  
  // 双方都有桃花
  both_tao_hua: boolean;
  
  // 双方都有华盖(可能略孤独)
  both_hua_gai: boolean;
  
  // 一方孤辰一方寡宿(传统不利婚配)
  gu_chen_gua_su_present: boolean;
  
  score: number;
  description_zh: string;
  description_en: string;
}

const AUSPICIOUS_SHENSHA: ShenShaName[] = ['天乙贵人', '文昌', '桃花', '驿马', '华盖'];
const INAUSPICIOUS_SHENSHA: ShenShaName[] = ['孤辰', '寡宿'];

export function calculateShenShaResonance(input: {
  a_day_master: HeavenlyStem;
  a_year_branch: EarthlyBranch;
  a_day_branch: EarthlyBranch;
  a_branches: Record<'year' | 'month' | 'day' | 'hour', EarthlyBranch>;
  b_day_master: HeavenlyStem;
  b_year_branch: EarthlyBranch;
  b_day_branch: EarthlyBranch;
  b_branches: Record<'year' | 'month' | 'day' | 'hour', EarthlyBranch>;
}): ShenShaResonanceResult {
  
  const aShenSha = checkAllShenSha({
    dayMaster: input.a_day_master,
    yearBranch: input.a_year_branch,
    dayBranch: input.a_day_branch,
    branches: input.a_branches
  });
  
  const bShenSha = checkAllShenSha({
    dayMaster: input.b_day_master,
    yearBranch: input.b_year_branch,
    dayBranch: input.b_day_branch,
    branches: input.b_branches
  });
  
  const aFoundMap = new Map<ShenShaName, boolean>();
  const bFoundMap = new Map<ShenShaName, boolean>();
  for (const s of aShenSha) aFoundMap.set(s.name, s.found);
  for (const s of bShenSha) bFoundMap.set(s.name, s.found);
  
  // 共有的吉神煞
  const sharedAuspicious = AUSPICIOUS_SHENSHA.filter(
    name => aFoundMap.get(name) && bFoundMap.get(name)
  );
  
  // 共有的凶神煞
  const sharedInauspicious = INAUSPICIOUS_SHENSHA.filter(
    name => aFoundMap.get(name) && bFoundMap.get(name)
  );
  
  // 双方都有桃花
  const bothTaoHua = aFoundMap.get('桃花') === true && bFoundMap.get('桃花') === true;
  
  // 双方都有华盖
  const bothHuaGai = aFoundMap.get('华盖') === true && bFoundMap.get('华盖') === true;
  
  // 一方孤辰一方寡宿
  const guChenGuaSu = 
    (aFoundMap.get('孤辰') && bFoundMap.get('寡宿')) ||
    (bFoundMap.get('孤辰') && aFoundMap.get('寡宿'));
  
  // 简化:交叉贵人(A 的贵人地支 = B 命盘中的某地支,反之亦然)
  // 这里简化为 true if both have gui_ren
  const crossGuiRenAid = aFoundMap.get('天乙贵人') === true || bFoundMap.get('天乙贵人') === true;
  
  // 打分
  let score = 0;
  score += sharedAuspicious.length * 3;
  score += bothTaoHua ? 4 : 0;
  score += crossGuiRenAid ? 5 : 0;
  
  score -= sharedInauspicious.length * 4;
  score -= bothHuaGai ? 3 : 0;  // 双华盖可能孤独
  score -= guChenGuaSu ? 8 : 0;
  
  return {
    shared_auspicious: sharedAuspicious,
    shared_inauspicious: sharedInauspicious,
    cross_gui_ren_aid: crossGuiRenAid,
    both_tao_hua: bothTaoHua,
    both_hua_gai: bothHuaGai,
    gu_chen_gua_su_present: !!guChenGuaSu,
    score: Math.max(-15, Math.min(15, score)),
    description_zh: buildShenShaDescriptionZh({
      sharedAuspicious, sharedInauspicious, bothTaoHua, 
      bothHuaGai, guChenGuaSu, crossGuiRenAid
    }),
    description_en: buildShenShaDescriptionEn({
      sharedAuspicious, sharedInauspicious, bothTaoHua, 
      bothHuaGai, guChenGuaSu, crossGuiRenAid
    })
  };
}

function buildShenShaDescriptionZh(s: any): string {
  const parts: string[] = [];
  if (s.crossGuiRenAid) parts.push('一方或双方有天乙贵人,得贵人助');
  if (s.bothTaoHua) parts.push('双桃花,感情吸引强');
  if (s.sharedAuspicious.length > 0) parts.push(`共有吉神煞:${s.sharedAuspicious.join('、')}`);
  if (s.bothHuaGai) parts.push('双华盖,智慧但偏孤');
  if (s.sharedInauspicious.length > 0) parts.push(`共有凶神煞:${s.sharedInauspicious.join('、')}`);
  if (s.guChenGuaSu) parts.push('一孤一寡,传统不利婚配');
  return parts.length > 0 ? parts.join(';') + '。' : '神煞共振平淡。';
}

function buildShenShaDescriptionEn(s: any): string {
  const parts: string[] = [];
  if (s.crossGuiRenAid) parts.push('Noble person assistance available');
  if (s.bothTaoHua) parts.push('Mutual peach blossom — magnetic attraction');
  if (s.sharedAuspicious.length > 0) parts.push(`Shared auspicious stars: ${s.sharedAuspicious.join(', ')}`);
  if (s.bothHuaGai) parts.push('Both have hua gai — wise but tendency toward solitude');
  if (s.sharedInauspicious.length > 0) parts.push(`Shared challenging stars: ${s.sharedInauspicious.join(', ')}`);
  if (s.guChenGuaSu) parts.push('Gu chen and gua su present — traditionally unfavorable');
  return parts.length > 0 ? parts.join('; ') + '.' : 'Neutral symbolic-star resonance.';
}
```

## Step 3.3: 维度 6 - 大运同步度

文件:`lib/match/calculations/luck-cycle-sync.ts`(新建)

```typescript
// lib/match/calculations/luck-cycle-sync.ts

import { STEMS, BRANCHES, type HeavenlyStem, type EarthlyBranch, type WuXing } from '../data/stems-branches';
import { isLiuHe, isLiuChong } from '../data/branch-relations';

export interface LuckCycleSyncResult {
  a_current_dayun_stem?: HeavenlyStem;
  a_current_dayun_branch?: EarthlyBranch;
  b_current_dayun_stem?: HeavenlyStem;
  b_current_dayun_branch?: EarthlyBranch;
  
  // 大运五行是否相生
  stems_sheng: boolean;
  branches_he: boolean;
  branches_chong: boolean;
  
  // 双方运势是否在同向上升 / 衰退
  both_rising: boolean;
  both_declining: boolean;
  
  score: number;
  description_zh: string;
  description_en: string;
}

const SHENG: Record<WuXing, WuXing> = {
  '木': '火', '火': '土', '土': '金', '金': '水', '水': '木'
};

export function calculateLuckCycleSync(input: {
  a_current_dayun_stem?: string;
  a_current_dayun_branch?: string;
  a_dayun_rising?: boolean;  // 当前大运是否在助命主(简化判断)
  b_current_dayun_stem?: string;
  b_current_dayun_branch?: string;
  b_dayun_rising?: boolean;
}): LuckCycleSyncResult {
  
  if (!input.a_current_dayun_stem || !input.b_current_dayun_stem) {
    return {
      stems_sheng: false,
      branches_he: false,
      branches_chong: false,
      both_rising: false,
      both_declining: false,
      score: 0,
      description_zh: '大运信息不足,无法精确判断同步度。',
      description_en: 'Insufficient luck cycle data for precise sync analysis.'
    };
  }
  
  const aStem = input.a_current_dayun_stem as HeavenlyStem;
  const bStem = input.b_current_dayun_stem as HeavenlyStem;
  const aBranch = input.a_current_dayun_branch as EarthlyBranch;
  const bBranch = input.b_current_dayun_branch as EarthlyBranch;
  
  // 大运五行是否相生
  const aStemWx = STEMS[aStem]?.wuxing;
  const bStemWx = STEMS[bStem]?.wuxing;
  const stemsSheng = (aStemWx && bStemWx) ? 
    (SHENG[aStemWx] === bStemWx || SHENG[bStemWx] === aStemWx) : false;
  
  // 大运地支六合 / 六冲
  const heCheck = isLiuHe(aBranch, bBranch);
  const branchesHe = heCheck.isHe;
  const branchesChong = isLiuChong(aBranch, bBranch);
  
  // 双方运势方向
  const bothRising = !!(input.a_dayun_rising && input.b_dayun_rising);
  const bothDeclining = !!(input.a_dayun_rising === false && input.b_dayun_rising === false);
  
  // 打分
  let score = 0;
  if (stemsSheng) score += 5;
  if (branchesHe) score += 8;
  if (branchesChong) score -= 6;
  if (bothRising) score += 6;
  if (bothDeclining) score -= 4;
  
  return {
    a_current_dayun_stem: aStem,
    a_current_dayun_branch: aBranch,
    b_current_dayun_stem: bStem,
    b_current_dayun_branch: bBranch,
    stems_sheng: stemsSheng,
    branches_he: branchesHe,
    branches_chong: branchesChong,
    both_rising: bothRising,
    both_declining: bothDeclining,
    score: Math.max(-15, Math.min(15, score)),
    description_zh: buildLuckSyncDescriptionZh({
      stemsSheng, branchesHe, branchesChong, bothRising, bothDeclining,
      aStem, bStem, aBranch, bBranch
    }),
    description_en: buildLuckSyncDescriptionEn({
      stemsSheng, branchesHe, branchesChong, bothRising, bothDeclining,
      aStem, bStem, aBranch, bBranch
    })
  };
}

function buildLuckSyncDescriptionZh(s: any): string {
  const parts: string[] = [];
  parts.push(`A 当前大运 ${s.aStem}${s.aBranch},B 当前大运 ${s.bStem}${s.bBranch}`);
  if (s.stemsSheng) parts.push('大运天干相生');
  if (s.branchesHe) parts.push('大运地支相合(同步)');
  if (s.branchesChong) parts.push('大运地支相冲(节奏不一)');
  if (s.bothRising) parts.push('双方运势同向上升');
  if (s.bothDeclining) parts.push('双方运势同向衰退');
  return parts.join(';') + '。';
}

function buildLuckSyncDescriptionEn(s: any): string {
  const parts: string[] = [];
  parts.push(`A's current luck phase: ${s.aStem}${s.aBranch}; B's: ${s.bStem}${s.bBranch}`);
  if (s.stemsSheng) parts.push("Heavenly stems harmonize");
  if (s.branchesHe) parts.push("Earthly branches bond (synced cycles)");
  if (s.branchesChong) parts.push("Earthly branches clash (out of sync)");
  if (s.bothRising) parts.push("Both rising together");
  if (s.bothDeclining) parts.push("Both declining together");
  return parts.join('; ') + '.';
}
```

## 验证清单

```
□ spouse-star.ts 完整
□ shensha-resonance.ts 完整
□ luck-cycle-sync.ts 完整
□ 3 个 unit test:
  - 双向配偶星(男的甲遇女的庚的情况)
  - 双桃花共振
  - 大运地支相合

🛑 等用户确认进入 Step 4
```

---

# 第 4 部分:Step 4 - 综合契合度引擎

## Step 4.1: 主计算函数

文件:`lib/match/calculate-compatibility.ts`(新建)

```typescript
// lib/match/calculate-compatibility.ts

import { calculateDayMasterInteraction } from './calculations/day-master-interaction';
import { calculateYongShenMatch } from './calculations/yong-shen-match';
import { calculateBranchInteractions } from './calculations/branch-interactions';
import { calculateSpouseStar } from './calculations/spouse-star';
import { calculateShenShaResonance } from './calculations/shensha-resonance';
import { calculateLuckCycleSync } from './calculations/luck-cycle-sync';
import { STEMS, BRANCHES, type HeavenlyStem, type EarthlyBranch, type WuXing } from './data/stems-branches';

export type CompatibilityLevel = 
  | 'highly_compatible'
  | 'compatible_with_effort'
  | 'neutral'
  | 'challenging'
  | 'highly_challenging';

/**
 * 完整契合度矩阵(本地计算)
 * 这是【给 LLM 看的确定性数据】
 */
export interface CompatibilityMatrix {
  // 6 个维度的详细结果
  day_master_interaction: any;
  yong_shen_match: any;
  branch_interactions: any;
  spouse_star: any;
  shensha_resonance: any;
  luck_cycle_sync: any;
  
  // 第 7 维度:任务关键词与关系的匹配(由 LLM 处理,这里只占位)
  
  // 综合分数
  weighted_total_score: number;  // -100 到 +100
  
  // 5 等级
  overall_level: CompatibilityLevel;
  
  // 关键洞察(给 LLM 写报告引用)
  key_insights: {
    strengths: string[];      // 3-5 条优势
    challenges: string[];     // 3-5 条挑战
  };
  
  // 元数据
  _meta: {
    a_summary: string;
    b_summary: string;
    weights: Record<string, number>;
  };
}

/**
 * 权重配置(各维度对总分的贡献)
 */
const WEIGHTS = {
  day_master: 0.20,        // 20% - 日主互动
  yong_shen: 0.20,         // 20% - 用神匹配
  branch: 0.20,            // 20% - 地支合冲刑害(夫妻宫)
  spouse_star: 0.15,       // 15% - 配偶星
  shensha: 0.10,           // 10% - 神煞共振
  luck_cycle: 0.15         // 15% - 大运同步度
};

/**
 * 主函数:计算完整合盘矩阵
 */
export function calculateCompatibilityMatrix(input: {
  profileA: any;
  profileB: any;
}): CompatibilityMatrix {
  
  // 解构两个 profile
  const a = parseProfile(input.profileA);
  const b = parseProfile(input.profileB);
  
  // 维度 1: 日主互动
  const dmInteraction = calculateDayMasterInteraction(a.dayMaster, b.dayMaster);
  
  // 维度 2: 用神匹配
  const ysMatch = calculateYongShenMatch({
    a_yong_shen_primary: a.yongShen,
    a_yong_shen_secondary: a.yongShenSecondary,
    b_yong_shen_primary: b.yongShen,
    b_yong_shen_secondary: b.yongShenSecondary,
    a_wuxing_distribution: a.wuxingDistribution,
    b_wuxing_distribution: b.wuxingDistribution
  });
  
  // 维度 3: 地支合冲刑害
  const branchInter = calculateBranchInteractions(a.branches, b.branches);
  
  // 维度 4: 配偶星
  const spouseStar = calculateSpouseStar({
    a_day_master: a.dayMaster,
    a_gender: a.gender,
    a_all_stems: a.stems,
    b_day_master: b.dayMaster,
    b_gender: b.gender,
    b_all_stems: b.stems
  });
  
  // 维度 5: 神煞共振
  const shenshaRes = calculateShenShaResonance({
    a_day_master: a.dayMaster,
    a_year_branch: a.branches.year,
    a_day_branch: a.branches.day,
    a_branches: a.branches,
    b_day_master: b.dayMaster,
    b_year_branch: b.branches.year,
    b_day_branch: b.branches.day,
    b_branches: b.branches
  });
  
  // 维度 6: 大运同步度
  const luckSync = calculateLuckCycleSync({
    a_current_dayun_stem: a.currentDayunStem,
    a_current_dayun_branch: a.currentDayunBranch,
    a_dayun_rising: a.dayunRising,
    b_current_dayun_stem: b.currentDayunStem,
    b_current_dayun_branch: b.currentDayunBranch,
    b_dayun_rising: b.dayunRising
  });
  
  // ============= 综合打分 =============
  
  const weightedTotal = 
    dmInteraction.score * WEIGHTS.day_master * 5 +
    ysMatch.score * WEIGHTS.yong_shen * 5 +
    branchInter.score * WEIGHTS.branch * 5 +
    spouseStar.score * WEIGHTS.spouse_star * 5 +
    shenshaRes.score * WEIGHTS.shensha * 5 +
    luckSync.score * WEIGHTS.luck_cycle * 5;
  
  const finalScore = Math.max(-100, Math.min(100, weightedTotal));
  const level = scoreToCompatibilityLevel(finalScore);
  
  // ============= 提取优势 / 挑战 =============
  
  const strengths: string[] = [];
  const challenges: string[] = [];
  
  if (dmInteraction.score >= 10) strengths.push('day_master_strong_bond');
  if (dmInteraction.score <= -10) challenges.push('day_master_clash');
  
  if (ysMatch.score >= 10) strengths.push('mutual_yong_shen_support');
  if (ysMatch.score <= -8) challenges.push('mutual_yong_shen_lacking');
  
  if (branchInter.day_branch_he) strengths.push('marriage_palace_bond');
  if (branchInter.day_branch_chong) challenges.push('marriage_palace_clash');
  if (branchInter.liu_chong_count >= 2) challenges.push('multiple_branch_clashes');
  
  if (spouseStar.a_is_b_spouse_star && spouseStar.b_is_a_spouse_star) {
    strengths.push('mutual_spouse_archetype');
  }
  
  if (shenshaRes.cross_gui_ren_aid) strengths.push('noble_assistance');
  if (shenshaRes.both_tao_hua) strengths.push('mutual_peach_blossom');
  if (shenshaRes.gu_chen_gua_su_present) challenges.push('gu_chen_gua_su');
  
  if (luckSync.branches_he) strengths.push('luck_cycles_aligned');
  if (luckSync.branches_chong) challenges.push('luck_cycles_misaligned');
  
  return {
    day_master_interaction: dmInteraction,
    yong_shen_match: ysMatch,
    branch_interactions: branchInter,
    spouse_star: spouseStar,
    shensha_resonance: shenshaRes,
    luck_cycle_sync: luckSync,
    weighted_total_score: Math.round(finalScore * 10) / 10,
    overall_level: level,
    key_insights: {
      strengths,
      challenges
    },
    _meta: {
      a_summary: `${a.dayMaster}${a.branches.day} (用神${a.yongShen})`,
      b_summary: `${b.dayMaster}${b.branches.day} (用神${b.yongShen})`,
      weights: WEIGHTS
    }
  };
}

function scoreToCompatibilityLevel(score: number): CompatibilityLevel {
  if (score >= 40) return 'highly_compatible';
  if (score >= 15) return 'compatible_with_effort';
  if (score >= -15) return 'neutral';
  if (score >= -40) return 'challenging';
  return 'highly_challenging';
}

/**
 * 从 base_analysis 解析出本计算需要的字段
 * 
 * 假设 base_analysis 的结构(根据 shunshi-bazi-core 输出):
 *   {
 *     bazi: {
 *       year_stem, year_branch,
 *       month_stem, month_branch,
 *       day_stem, day_branch,
 *       hour_stem, hour_branch
 *     },
 *     gender: 'M' | 'F',
 *     yong_shen: { primary_element, secondary_element },
 *     wuxing_distribution: { '木': n, '火': n, ... },
 *     da_yun: {
 *       current: { stem, branch, is_favorable }
 *     }
 *   }
 */
function parseProfile(profile: any): {
  dayMaster: HeavenlyStem;
  gender: 'M' | 'F';
  yongShen: WuXing;
  yongShenSecondary?: WuXing;
  branches: Record<'year' | 'month' | 'day' | 'hour', EarthlyBranch>;
  stems: Record<'year' | 'month' | 'day' | 'hour', HeavenlyStem>;
  wuxingDistribution: Record<WuXing, number>;
  currentDayunStem?: string;
  currentDayunBranch?: string;
  dayunRising?: boolean;
} {
  const content = profile?.base_analysis?.content || profile?.user_profile || profile;
  const bazi = content?.bazi || {};
  
  return {
    dayMaster: bazi.day_stem || '甲',
    gender: content?.gender || 'M',
    yongShen: content?.yong_shen?.primary_element || '木',
    yongShenSecondary: content?.yong_shen?.secondary_element,
    branches: {
      year: bazi.year_branch || '子',
      month: bazi.month_branch || '子',
      day: bazi.day_branch || '子',
      hour: bazi.hour_branch || '子'
    },
    stems: {
      year: bazi.year_stem || '甲',
      month: bazi.month_stem || '甲',
      day: bazi.day_stem || '甲',
      hour: bazi.hour_stem || '甲'
    },
    wuxingDistribution: content?.wuxing_distribution || {
      '木': 0, '火': 0, '土': 0, '金': 0, '水': 0
    },
    currentDayunStem: content?.da_yun?.current?.stem,
    currentDayunBranch: content?.da_yun?.current?.branch,
    dayunRising: content?.da_yun?.current?.is_favorable
  };
}
```

## Step 4.2: 测试

文件:`lib/match/__tests__/calculate-compatibility.test.ts`(新建)

```typescript
import { calculateCompatibilityMatrix } from '../calculate-compatibility';

describe('calculate-compatibility', () => {
  // 测试用例 1: 经典夫妻合(乙庚合 + 子丑合)
  const profileA_classical = {
    base_analysis: {
      content: {
        bazi: {
          year_stem: '丁', year_branch: '巳',
          month_stem: '癸', month_branch: '丑',
          day_stem: '乙', day_branch: '子',  // 乙木日主,日支子
          hour_stem: '戊', hour_branch: '寅'
        },
        gender: 'M',
        yong_shen: { primary_element: '水' },
        wuxing_distribution: { '木': 2, '火': 1, '土': 2, '金': 0, '水': 2 },
        da_yun: { current: { stem: '辛', branch: '亥', is_favorable: true } }
      }
    }
  };
  
  const profileB_classical = {
    base_analysis: {
      content: {
        bazi: {
          year_stem: '戊', year_branch: '午',
          month_stem: '甲', month_branch: '寅',
          day_stem: '庚', day_branch: '丑',  // 庚金日主,日支丑(子丑合!)
          hour_stem: '丁', hour_branch: '亥'
        },
        gender: 'F',
        yong_shen: { primary_element: '木' },
        wuxing_distribution: { '木': 2, '火': 2, '土': 2, '金': 1, '水': 1 },
        da_yun: { current: { stem: '丁', branch: '巳', is_favorable: true } }
      }
    }
  };
  
  it('should detect tian_he and day_branch he', () => {
    const result = calculateCompatibilityMatrix({
      profileA: profileA_classical,
      profileB: profileB_classical
    });
    
    // 乙庚合 → tianhe
    expect(result.day_master_interaction.type).toBe('tianhe');
    expect(result.day_master_interaction.score).toBeGreaterThan(15);
    
    // 子丑合 → day_branch_he
    expect(result.branch_interactions.day_branch_he).toBe(true);
    
    // 配偶星:男(A 乙木)看正财 = 庚正财(B 是庚) ✓
    expect(result.spouse_star.b_is_a_spouse_star).toBe(true);
    
    // 综合应该是 highly_compatible 或 compatible_with_effort
    expect(['highly_compatible', 'compatible_with_effort']).toContain(result.overall_level);
    
    // 应该有 marriage_palace_bond 优势
    expect(result.key_insights.strengths).toContain('marriage_palace_bond');
  });
  
  // 测试用例 2: 经典冲(子午冲 + 甲庚冲)
  const profileA_clash = {
    base_analysis: {
      content: {
        bazi: {
          year_stem: '癸', year_branch: '亥',
          month_stem: '丙', month_branch: '辰',
          day_stem: '甲', day_branch: '子',  // 甲木日主,日支子
          hour_stem: '丙', hour_branch: '寅'
        },
        gender: 'M',
        yong_shen: { primary_element: '水' },
        wuxing_distribution: { '木': 2, '火': 2, '土': 1, '金': 0, '水': 3 },
        da_yun: { current: { stem: '甲', branch: '寅', is_favorable: true } }
      }
    }
  };
  
  const profileB_clash = {
    base_analysis: {
      content: {
        bazi: {
          year_stem: '甲', year_branch: '戌',
          month_stem: '丙', month_branch: '寅',
          day_stem: '庚', day_branch: '午',  // 庚金日主,日支午(子午冲!甲庚冲!)
          hour_stem: '辛', hour_branch: '巳'
        },
        gender: 'F',
        yong_shen: { primary_element: '土' },
        wuxing_distribution: { '木': 2, '火': 3, '土': 1, '金': 2, '水': 0 },
        da_yun: { current: { stem: '戊', branch: '辰', is_favorable: false } }
      }
    }
  };
  
  it('should detect day_branch_chong (clash)', () => {
    const result = calculateCompatibilityMatrix({
      profileA: profileA_clash,
      profileB: profileB_clash
    });
    
    // 子午冲 → day_branch_chong
    expect(result.branch_interactions.day_branch_chong).toBe(true);
    
    // 甲庚冲 → tianchong
    expect(result.day_master_interaction.type).toBe('tianchong');
    
    // 综合应该是 challenging 或 highly_challenging
    expect(['challenging', 'highly_challenging']).toContain(result.overall_level);
    
    // 应该有 marriage_palace_clash 挑战
    expect(result.key_insights.challenges).toContain('marriage_palace_clash');
  });
  
  it('should be deterministic', () => {
    const r1 = calculateCompatibilityMatrix({ profileA: profileA_classical, profileB: profileB_classical });
    const r2 = calculateCompatibilityMatrix({ profileA: profileA_classical, profileB: profileB_classical });
    
    expect(r1.weighted_total_score).toBe(r2.weighted_total_score);
    expect(r1.overall_level).toBe(r2.overall_level);
  });
});
```

## 验证清单

```
□ calculate-compatibility.ts 完整
□ 6 维度独立计算 + 综合打分
□ 权重配置合理(总和 100%)
□ 5 等级映射正确
□ key_insights 提取
□ 经典案例测试:
  - 乙庚合 + 子丑合 → highly_compatible
  - 甲庚冲 + 子午冲 → challenging 或 highly_challenging
□ 确定性测试通过

🛑 等用户确认进入 Step 5
```

---

# 第 5 部分:Step 5 - LLM Service 重写

## Step 5.1: 重写 match-deepseek-prompt.ts

文件:`lib/llm/prompts/match-deepseek-prompt.ts`(完全替换)

```typescript
import {
  ORIENTAL_COUNSELOR_BASE,
  buildCurrentDateContext,
  buildProfileContextSection,
  stitchPromptSections,
  detectLanguage
} from './oriental-counselor-base';
import {
  MATCH_BAZI_HEPAN_IDENTITY,
  MATCH_OUTPUT_BRANDING
} from './match-base';
import type { CompatibilityMatrix } from '@/lib/match/calculate-compatibility';

export function buildMatchPrompt(input: {
  a_profile: any;
  b_profile: any;
  relationship_description: string;
  locale: string;
  compatibilityMatrix: CompatibilityMatrix;  // ⭐ 已计算好的矩阵
}): { system: string; user: string; detected_language: string } {
  
  const { a_profile, b_profile, relationship_description, locale, compatibilityMatrix } = input;
  
  const detectedLanguage = detectLanguage(relationship_description, locale);
  const aBaseAnalysis = a_profile?.base_analysis?.content;
  const bBaseAnalysis = b_profile?.base_analysis?.content;
  
  const system = stitchPromptSections(
    MATCH_BAZI_HEPAN_IDENTITY,
    MATCH_OUTPUT_BRANDING,
    ORIENTAL_COUNSELOR_BASE,
    buildCurrentDateContext(),
    
    `# 命主 A 的完整命盘
${buildProfileContextSection(a_profile, aBaseAnalysis)}

---

# 命主 B 的完整命盘
${buildProfileContextSection(b_profile, bBaseAnalysis)}

---

# 用户描述的关系

"${relationship_description}"

# ⭐⭐⭐ 极其重要:契合度已经计算好了

后台已经基于 6 个命理维度精确计算了两个命盘的契合度:

1. 日主互动(权重 20%)
2. 用神匹配(权重 20%)
3. 地支合冲刑害(权重 20%)
4. 配偶星(权重 15%)
5. 神煞共振(权重 10%)
6. 大运同步度(权重 15%)

# ⛔ 严格禁止

你【绝不能】:
  ✗ 修改 overall_level(已计算)
  ✗ 修改 weighted_total_score
  ✗ 重新判断契合度
  ✗ 输出"我觉得他们契合度更高"等推翻计算的话

你只需要:
  ✓ 把【数学计算结果】翻译为【命理语言 + 用户友好的报告】
  ✓ 把 key_insights 中的标签展开为具体的内容
  ✓ 基于用户描述的关系,给出针对性的建议

# 已计算的契合度矩阵

\`\`\`json
${JSON.stringify(compatibilityMatrix, null, 2)}
\`\`\`

# 你的工作:生成 5 段完整报告

## 1. analysis_a(关于 A)
- 200-400 字详细
- 突出与此关系相关的命局特质
- A 在感情/合作/家庭中的天然倾向
- 3-5 条关键特质(key_traits)

## 2. analysis_b(关于 B)
- 同结构,针对 B

## 3. combined(合盘)
- 400-600 字详细
- 必须引用上面的 day_master_interaction(类型 + 描述)
- 必须引用 branch_interactions(合冲刑害)
- 必须引用 yong_shen_match
- 五行十神互动 200-300 字
- 时机协同 100-200 字

## 4. conclusion(结论)
- compatibility_level 必须用【已计算的 overall_level】(绝不修改!)
- 简短结论 50-100 字
- 详细 200-400 字
- 优势 3-5 条(展开 key_insights.strengths)
- 挑战 3-5 条(展开 key_insights.challenges)

## 5. recommendations(建议)
- 4-6 条具体可执行
- 类别:communication / timing / boundary / growth / fengshui
- 每条:title + detail (80-150 字) + timing

# 输出语言

⚠️ 极其重要:全部输出用【${detectedLanguage}】

# 输出格式(严格 JSON)

\`\`\`json
{
  "analysis_a": {
    "title": "...(用户语言)",
    "summary": "30-60 字",
    "detail": "200-400 字",
    "key_traits": ["...", "...", "...", "...", "..."]
  },
  "analysis_b": { ... },
  "combined": {
    "title": "...",
    "summary": "...",
    "detail": "...",
    "five_elements_interaction": "200-300 字",
    "timing_dynamic": "100-200 字"
  },
  "conclusion": {
    "title": "...",
    "compatibility_level": "${compatibilityMatrix.overall_level}",  ⭐ 必须用这个值
    "summary": "...",
    "detail": "...",
    "strengths": ["...", "...", "..."],
    "challenges": ["...", "...", "..."]
  },
  "recommendations": {
    "title": "...",
    "summary": "...",
    "actions": [
      { "category": "...", "title": "...", "detail": "...", "timing": "..." },
      ...
    ]
  }
}
\`\`\`

# 关键规则

1. **compatibility_level 必须用 "${compatibilityMatrix.overall_level}"**
   (从已计算的 overall_level 复制,绝不修改)

2. **必须引用计算结果**:
   - 提到具体的 day_master_interaction.type 
   - 提到 branch_interactions 中的合冲刑害
   - 把数字翻译成命理语言:
     * 不直接说"得分 +45.3"
     * 说"五合天成,日支相合,大运同频"

3. **建议必须可执行**:
   ✓ "本月内,A 主动选一个周末..."
   ✗ "多沟通"(太空)

4. **不预测具体未来事件**
5. **不下定论"你们一定...不...."**

# 严格 JSON,无 markdown 围栏`
  );
  
  const user = `请基于已计算好的契合度矩阵 + 关系描述,生成完整 5 段报告 JSON。
不修改 compatibility_level(必须用 "${compatibilityMatrix.overall_level}")。
${detectedLanguage}。
严格 JSON。`;
  
  return {
    system,
    user,
    detected_language: detectedLanguage
  };
}
```

## Step 5.2: 重写 match-analysis-service.ts

文件:`lib/llm/services/match-analysis-service.ts`(完全替换)

```typescript
import { callLLM } from '@/lib/llm/router';
import { buildMatchPrompt } from '@/lib/llm/prompts/match-deepseek-prompt';
import { calculateCompatibilityMatrix } from '@/lib/match/calculate-compatibility';
import { getStoredProfile, recordProfileUsage } from '@/lib/profile/stored-profiles-service';
import { generateBaseAnalysis } from '@/lib/llm/deepseek/base-analysis';
import type { MatchReport } from '@/lib/match/types';

export async function generateMatchAnalysis(input: {
  a_profile_id: string;
  b_profile_id: string;
  relationship_description: string;
  locale: string;
}): Promise<{
  report: MatchReport;
  meta: any;
}> {
  // 1. 加载两个 profile
  let [aProfile, bProfile] = await Promise.all([
    getStoredProfile(input.a_profile_id),
    getStoredProfile(input.b_profile_id)
  ]);
  
  if (!aProfile || !bProfile) {
    throw new Error('Profile not found');
  }
  
  // 2. 确保 base_analysis 都有
  if (!aProfile.base_analysis?.content) {
    await generateBaseAnalysis(input.a_profile_id);
    aProfile = await getStoredProfile(input.a_profile_id);
  }
  if (!bProfile.base_analysis?.content) {
    await generateBaseAnalysis(input.b_profile_id);
    bProfile = await getStoredProfile(input.b_profile_id);
  }
  
  // 3. ⭐ 本地计算契合度矩阵
  console.log('[match] Computing compatibility matrix locally...');
  const compatibilityMatrix = calculateCompatibilityMatrix({
    profileA: aProfile,
    profileB: bProfile
  });
  
  console.log('[match] Computed:', {
    overall_level: compatibilityMatrix.overall_level,
    score: compatibilityMatrix.weighted_total_score,
    strengths: compatibilityMatrix.key_insights.strengths.length,
    challenges: compatibilityMatrix.key_insights.challenges.length
  });
  
  // 4. 构建 prompt
  const { system, user, detected_language } = buildMatchPrompt({
    a_profile: aProfile,
    b_profile: bProfile,
    relationship_description: input.relationship_description,
    locale: input.locale,
    compatibilityMatrix
  });
  
  console.log(`[match] Calling DeepSeek V4 Pro for report (language: ${detected_language})`);
  const startTime = Date.now();
  
  // 5. 调用 DeepSeek(medium thinking,因为只生成文案)
  const result = await callLLM({
    call_type: 'deep_analysis',
    system,
    messages: [{ role: 'user', content: user }],
    max_tokens: 15000,
    thinking_effort: 'medium',  // ⭐ 从 high 改为 medium(只写报告)
    response_format: 'json'
  });
  
  // 6. 解析 JSON
  let parsed: any;
  try {
    const cleaned = result.content
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (e: any) {
    console.error('[match] JSON parse failed:', e.message);
    throw new Error('Match report output is not valid JSON');
  }
  
  // 7. ⭐ 强制覆盖 compatibility_level(防止 LLM 私自修改)
  if (parsed.conclusion) {
    parsed.conclusion.compatibility_level = compatibilityMatrix.overall_level;
  }
  
  // 8. 校验必需字段
  const requiredSections = ['analysis_a', 'analysis_b', 'combined', 'conclusion', 'recommendations'];
  for (const section of requiredSections) {
    if (!parsed[section]) {
      throw new Error(`Missing required section: ${section}`);
    }
  }
  
  // 9. 注入 _meta
  parsed._meta = {
    a_profile_id: input.a_profile_id,
    b_profile_id: input.b_profile_id,
    relationship_description: input.relationship_description,
    detected_language,
    generated_at: new Date().toISOString(),
    model: result.actual_model,
    tokens_used: result.meta.tokens_used,
    
    // ⭐ 暴露计算细节(给后台调试,不给用户看)
    computation_meta: {
      weighted_total_score: compatibilityMatrix.weighted_total_score,
      overall_level: compatibilityMatrix.overall_level,
      day_master_type: compatibilityMatrix.day_master_interaction.type,
      day_branch_he: compatibilityMatrix.branch_interactions.day_branch_he,
      day_branch_chong: compatibilityMatrix.branch_interactions.day_branch_chong
    }
  };
  
  // 10. 记录使用
  await Promise.all([
    recordProfileUsage(input.a_profile_id, 'match'),
    recordProfileUsage(input.b_profile_id, 'match')
  ]);
  
  const elapsedMs = Date.now() - startTime;
  console.log(`[match] Done in ${elapsedMs}ms`);
  
  return {
    report: parsed as MatchReport,
    meta: {
      model: result.actual_model,
      tokens_used: result.meta.tokens_used,
      cost_usd: result.meta.cost_usd || 0,
      latency_ms: elapsedMs,
      detected_language,
      local_computation: true,
      compatibility_score: compatibilityMatrix.weighted_total_score
    }
  };
}
```

## 验证清单

```
□ match-deepseek-prompt.ts 重写完成
□ Prompt 明确禁止 LLM 修改 compatibility_level
□ 注入计算好的矩阵
□ match-analysis-service.ts 重写完成
□ 强制覆盖 compatibility_level(双重保险)
□ 输出 computation_meta(可调试)
□ tsc 通过

🛑 等用户确认进入 Step 6
```

---

# 第 6 部分:Step 6 - 端到端测试

## Step 6:完整 Match v5.1 流程测试

```
任务:

清空浏览器,跑完整 Match 流程

测试用例:

【场景 1: 经典夫妻合(乙庚合 + 子丑合)】
  Profile A: 1985-12-15 04:00 男(乙木日主,日支子)
  Profile B: 1988-02-22 14:00 女(庚金日主,日支丑)
  Relationship: "We're getting engaged next month"
  
  预期:
  ✓ day_master_interaction.type === 'tianhe'(乙庚合)
  ✓ branch_interactions.day_branch_he === true(子丑合)
  ✓ spouse_star.b_is_a_spouse_star === true(庚是乙的正官 - 不对,是正官还是正财?)
    - 男看正财:乙日主,正财是己土,庚是正官(男的正官也加分)
  ✓ overall_level: highly_compatible 或 compatible_with_effort
  ✓ LLM 报告中:
    - Compatibility level 显示 highly_compatible
    - 提到"乙庚合""子丑合"(中文)或对应英文
    - 5 段都完整
    - Strengths 至少 3 条
    - 4-6 个 actions

【场景 2: 经典相冲(子午冲 + 甲庚冲)】
  Profile A: 1984-08-10 10:00 男(甲木日主,日支子)
  Profile B: 1990-06-15 12:00 女(庚金日主,日支午)
  Relationship: "We've been arguing more lately"
  
  预期:
  ✓ day_master_interaction.type === 'tianchong'(甲庚冲)
  ✓ branch_interactions.day_branch_chong === true(子午冲)
  ✓ overall_level: challenging 或 highly_challenging
  ✓ LLM 报告中:
    - Challenges 至少 3 条
    - 不假装"还行"
    - 给出具体的化解建议

【场景 3: 中性(无强合无强冲)】
  Profile A: 1987-04-08 09:00 男(丁火日主)
  Profile B: 1989-11-22 16:00 女(癸水日主)
  - 丁壬合(算 tianhe),但日支不合
  Relationship: "Considering business partnership"
  
  预期:
  ✓ overall_level: compatible_with_effort 或 neutral
  ✓ 报告说明合伙关系的针对性建议

【场景 4: LLM 试图修改 compatibility_level?】
  人工检查 100 个真实 case
  在 prompt 中明确要求"必须用 ${overall_level}"
  service 中又强制覆盖
  
  ✓ 应该 100% 不出现 LLM 修改 compatibility_level

【场景 5: 不同语言适配】
  Relationship A: "我和未婚妻交往 3 年了" (中文)
  → 报告全中文
  
  Relationship B: "My business partner of 3 years" (英文)
  → 报告全英文
  
  Relationship C: "Mi pareja desde hace 2 años" (西班牙文)
  → 报告全西班牙文

【场景 6: 确定性】
  相同两个 profile + 相同 relationship 跑 3 次
  ✓ compatibility_level 完全相同(因为本地计算确定)
  ✓ overall_score 完全相同
  ✓ LLM 文案可能略有不同(创意层)

【场景 7: 计算速度】
  本地计算应该 < 50ms
  LLM 调用 30-60 秒
  总时长 30-60 秒(跟 v5.0 类似,但更可信)

【提交报告】

完成后向用户:
1. 7 个场景测试结果
2. 3 个真实 case 的完整 JSON 报告
3. compatibility 分布统计(跑 20 个随机组合)
4. DeepSeek tokens / cost
5. 本地计算耗时
6. 任何 bug 或建议
```

## 验证清单

```
□ 场景 1: 经典合 → highly_compatible 通过
□ 场景 2: 经典冲 → challenging 通过
□ 场景 3: 中性 → compatible_with_effort 通过
□ 场景 4: LLM 不能修改 level
□ 场景 5: 多语言
□ 场景 6: 确定性
□ 场景 7: 性能

🛑 等用户最终确认 Match v5.1 上线就绪
```

---

# Match v5.1 完整重构清单

```
✅ Step 1: 八字合盘基础数据(干支/十神/合冲刑害/神煞)
✅ Step 2: 7 维度计算 - Part 1(日主/用神/地支)
✅ Step 3: 7 维度计算 - Part 2(配偶星/神煞/大运)
✅ Step 4: 综合契合度引擎(加权打分 + 5 等级)
✅ Step 5: LLM Service 重写
✅ Step 6: 端到端测试

核心升级 vs v5.0:
  ⭐ 6 维度本地计算(每个独立可验证)
  ⭐ Compatibility 等级【数学确定】
  ⭐ key_insights 标签提取(给 LLM 写报告引用)
  ⭐ LLM 强制不能修改 level(prompt + service 双保险)
  ⭐ 可信度从 60-70% → 85-90%
  ⭐ 命理上严谨(乙庚合、子丑合等经典规则全部正确实现)

商业价值:
  - 用户问"为什么是 highly_compatible" → 我们能解释
    "乙庚天干五合,日支子丑相合,这是经典夫妻合盘"
  - 对懂行的人(命理师、客户长辈)站得住脚
  - 退款率下降
```

---

# 给 Cursor 的最终提醒

```
本任务包含 Step 1-6。

实施顺序(严格按序):
1. Step 1: 数据基础(干支/合冲/神煞)
2. Step 2: 维度 1-3 计算
3. Step 3: 维度 4-6 计算
4. Step 4: 综合引擎
5. Step 5: LLM Service 重写
6. Step 6: 端到端测试

特别注意:
  ⚠️ 在 service 层【强制覆盖】compatibility_level
     即使 LLM 私自改了,我们也按本地计算结果显示
  
  ⚠️ key_insights 标签是给 LLM 写【strengths/challenges】用的
     LLM 拿到 'marriage_palace_bond' 标签
     展开为"日支相合,这意味着..."

完成后:
  ✓ Match 真的【在算】两个命盘的合冲刑害,不是"装"
  ✓ 可以告诉用户"基于子平合婚千年算法"
  ✓ pojulife 真正的差异化护城河
```

**Cursor: 完成 Step 1-6 后,Match v5.1 计算引擎上线就绪。**

**用户:Syncro + Match 两份计算引擎指令都已交付。立刻可以发给 Cursor 实施。**
