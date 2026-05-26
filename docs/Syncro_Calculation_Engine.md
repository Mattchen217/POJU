# Syncro 计算引擎重构 · Cursor 完整任务

> **目标**:把 Syncro 从【纯 LLM 推演】改为【本地计算 + LLM 文案】混合架构
>
> - 集成 anthonylee1994/qimen(MIT 协议奇门遁甲算法)
> - 实现 5 维度打分模型(本地)
> - 96 组合的 Current 等级【完全本地确定】(可重复验证)
> - LLM 只负责生成 short_advice / detailed_advice / rationale 文案
>
> **前提**:
> - Syncro v5.0 设计已完成(见 Syncro_v5.0_Refactor.md)
> - 但【还没实施】到代码中
> - 本指令应在 Syncro v5.0 实施前先做
>
> **执行原则**:严格【一步一停】

---

# ⚠️ Cursor 必读

```
本任务重构 Syncro 的【核心可信度】

混合架构原则:
  ✓ 本地计算 = 等级(可验证、可重复、严谨)
  ✓ LLM = 文案(创意、个性化、人话)

绝不允许:
  ✗ LLM 重新判断 Current 等级
  ✗ LLM 修改 matrix 中的 current_level
  ✗ 跨 Step 实施

关键升级:
  v5.0 纯 LLM 推演 → v5.1 本地奇门 + 八字打分 + LLM 文案
  可信度从 30% → 85%

每个 Step 完成后:
  - 贴出代码 + 测试输出
  - 等用户明确"通过 Step X" 才进入下一步
```

---

# 第 1 部分:Step 1 - 集成 anthonylee1994/qimen 库

## Step 1.1: Fork + Copy 库

```
任务:

1. Fork anthonylee1994/qimen 到你的 GitHub 组织
   https://github.com/anthonylee1994/qimen → fork
   
   理由:
   ✓ 即使原作者删库,我们也有副本
   ✓ 可以打补丁不影响上游
   ✓ MIT 协议允许商用

2. Clone 仓库
   git clone https://github.com/<your-org>/qimen.git temp/qimen-source
   
3. 跑测试验证库本身可用:
   cd temp/qimen-source
   pnpm install
   pnpm test
   
   ✓ 应该看到 180+ 测试全部通过
   ✓ 如果有失败,贴出来给用户

4. 把核心代码 copy 到我们项目:
   
   mkdir -p lib/qimen
   cp -r temp/qimen-source/src/qimen/* lib/qimen/
   cp temp/qimen-source/LICENSE lib/qimen/LICENSE
   cp temp/qimen-source/ALGORITHM.md lib/qimen/ALGORITHM.md
   
   最终结构应该是:
   lib/qimen/
     ├── QimenUtil.ts          # 主算法
     ├── LunarUtil.ts          # 农历工具
     ├── FormatUtil.ts         # 格式化
     ├── dictionary.ts         # 查表数据
     ├── type.ts               # 类型定义
     ├── __tests__/            # 测试
     ├── LICENSE               # MIT 协议(必须保留)
     └── ALGORITHM.md          # 算法文档(参考用)

5. 安装依赖:
   pnpm add lunar-typescript@^1.6.6
   
   这是 qimen 库的核心依赖,业界标杆农历计算库(6tail 出品)

6. 测试 qimen 库在我们项目中工作:
   
   写一个测试脚本 lib/qimen/__tests__/integration.test.ts:
```

```typescript
// lib/qimen/__tests__/integration.test.ts

import { Lunar } from 'lunar-typescript';
import { QimenUtil } from '../QimenUtil';

describe('Qimen Integration', () => {
  it('should generate complete qimen pan', () => {
    // 测试 2024-05-10 14:30 (固定时间确保结果可重复)
    const lunar = Lunar.fromYmdHms(2024, 5, 10, 14, 30, 0);
    const qimenPan = QimenUtil.create(lunar);
    
    expect(qimenPan).toBeDefined();
    expect(qimenPan.遁).toMatch(/陽遁|陰遁/);
    expect(qimenPan.局數).toBeGreaterThanOrEqual(1);
    expect(qimenPan.局數).toBeLessThanOrEqual(9);
    expect(qimenPan.九宮).toHaveLength(9);
    expect(qimenPan.值符星).toBeTruthy();
    
    // 每个宫位应该有完整字段
    for (const cell of qimenPan.九宮) {
      expect(cell.八神).toBeTruthy();
      expect(cell.九星).toBeTruthy();
      expect(cell.八門).toBeTruthy();
      expect(cell.宮位).toBeTruthy();
    }
  });
  
  it('should work for current time', () => {
    const now = new Date();
    const lunar = Lunar.fromDate(now);
    const qimenPan = QimenUtil.create(lunar);
    
    expect(qimenPan.九宮).toHaveLength(9);
  });
});
```

7. 运行集成测试:
   pnpm test lib/qimen/__tests__/integration.test.ts
   
   ✓ 应该通过

8. 清理临时目录:
   rm -rf temp/qimen-source

9. git commit:
   git add lib/qimen
   git commit -m "feat: integrate qimen-dunjia from anthonylee1994/qimen (MIT)"
```

## 验证清单

```
□ lib/qimen/ 目录创建,包含 QimenUtil.ts 等
□ LICENSE 文件存在(MIT)
□ ALGORITHM.md 存在(参考用)
□ lunar-typescript 已安装
□ 集成测试通过
□ git commit 完成

🛑 等用户确认进入 Step 2
```

---

# 第 2 部分:Step 2 - 八卦方位 + 奇门宫位映射

## Step 2.1: 创建方位映射表

文件:`lib/syncro/qimen-direction-map.ts`(新建)

```typescript
// lib/syncro/qimen-direction-map.ts

import type { DirectionId } from './current-system';

/**
 * 8 方位与奇门 9 宫的对应关系
 * (中宫无方位,不参与外部方向计算)
 * 
 * 注意:奇门宫位顺序固定(后天八卦):
 * 1宫坎(北) 2宫坤(西南) 3宫震(东) 4宫巽(东南)
 * 5宫中    6宫乾(西北) 7宫兑(西) 8宫艮(东北)
 * 9宫离(南)
 */

export interface QimenPalaceInfo {
  palace_index: number;  // 0-8(对应 qimen 库的 九宮[i])
  palace_name: string;   // "坎一宮" 等
  bagua: string;         // "坎/坤/震/巽/中/乾/兑/艮/离"
  element: string;       // "水/土/木/木/-/金/金/土/火"
}

/**
 * 方位 ID → qimen 库的 九宮 index
 */
export const DIRECTION_TO_QIMEN_PALACE: Record<DirectionId, QimenPalaceInfo> = {
  N:  { palace_index: 0, palace_name: '坎一宮',  bagua: '坎', element: '水' },
  SW: { palace_index: 1, palace_name: '坤二宮',  bagua: '坤', element: '土' },
  E:  { palace_index: 2, palace_name: '震三宮',  bagua: '震', element: '木' },
  SE: { palace_index: 3, palace_name: '巽四宮',  bagua: '巽', element: '木' },
  // index 4 = 中宮(不对应外部方位)
  NW: { palace_index: 5, palace_name: '乾六宮',  bagua: '乾', element: '金' },
  W:  { palace_index: 6, palace_name: '兑七宮',  bagua: '兑', element: '金' },
  NE: { palace_index: 7, palace_name: '艮八宮',  bagua: '艮', element: '土' },
  S:  { palace_index: 8, palace_name: '離九宮',  bagua: '離', element: '火' }
};

/**
 * 八门吉凶等级(奇门遁甲传统)
 * - 吉门:开、休、生
 * - 中门:景、杜
 * - 凶门:伤、惊、死
 */
export const EIGHT_DOORS_NATURE: Record<string, {
  type: 'good' | 'neutral' | 'bad';
  score: number;          // -20 到 +20
  meaning_en: string;
  meaning_zh: string;
  suits: string[];        // 适合的行动
}> = {
  '開門': { 
    type: 'good',   score: 20,
    meaning_en: 'Open Gate · Opportunities, new starts',
    meaning_zh: '開門 · 開創、求人、求职、谈判',
    suits: ['启动', '会面', '谈判', '求职']
  },
  '休門': { 
    type: 'good',   score: 18,
    meaning_en: 'Rest Gate · Stillness, recovery',
    meaning_zh: '休門 · 休养、避祸、隐居',
    suits: ['休息', '内省', '回避']
  },
  '生門': { 
    type: 'good',   score: 20,
    meaning_en: 'Life Gate · Wealth, growth',
    meaning_zh: '生門 · 求财、置业、投资',
    suits: ['求财', '投资', '置业', '增长']
  },
  '景門': { 
    type: 'neutral', score: 0,
    meaning_en: 'Vision Gate · Display, but not closure',
    meaning_zh: '景門 · 求名、争讼、宣传',
    suits: ['展示', '宣传', '争讼']
  },
  '杜門': { 
    type: 'neutral', score: -5,
    meaning_en: 'Block Gate · Concealment, secrecy',
    meaning_zh: '杜門 · 藏匿、避祸、保密',
    suits: ['隐藏', '保密']
  },
  '傷門': { 
    type: 'bad',    score: -15,
    meaning_en: 'Harm Gate · Loss, injury',
    meaning_zh: '傷門 · 受伤、损失、冲突',
    suits: []
  },
  '驚門': { 
    type: 'bad',    score: -18,
    meaning_en: 'Shock Gate · Surprise, fright',
    meaning_zh: '驚門 · 惊吓、官非、谣言',
    suits: []
  },
  '死門': { 
    type: 'bad',    score: -20,
    meaning_en: 'Death Gate · Ending, stagnation',
    meaning_zh: '死門 · 终结、停滞、丧事',
    suits: []
  }
};

/**
 * 八神吉凶(奇门遁甲)
 */
export const EIGHT_GODS_NATURE: Record<string, {
  type: 'auspicious' | 'neutral' | 'inauspicious';
  score: number;
}> = {
  '值符': { type: 'auspicious',   score: 15 },   // 大吉,主神
  '螣蛇': { type: 'inauspicious', score: -10 },  // 怪异
  '太陰': { type: 'auspicious',   score: 10 },   // 阴贵
  '六合': { type: 'auspicious',   score: 12 },   // 和合
  '白虎': { type: 'inauspicious', score: -15 },  // 凶杀
  '玄武': { type: 'inauspicious', score: -8 },   // 暗害
  '九地': { type: 'auspicious',   score: 8 },    // 安稳
  '九天': { type: 'auspicious',   score: 12 }    // 远行
};

/**
 * 九星吉凶(奇门遁甲)
 */
export const NINE_STARS_NATURE: Record<string, {
  type: 'good' | 'neutral' | 'bad';
  score: number;
}> = {
  '天蓬': { type: 'bad',     score: -12 },  // 凶,盗贼
  '天任': { type: 'good',    score: 12 },   // 吉,稳健
  '天冲': { type: 'neutral', score: 0 },    // 中,激进
  '天輔': { type: 'good',    score: 15 },   // 大吉,文章
  '天英': { type: 'neutral', score: 0 },    // 中,虚名
  '天芮': { type: 'bad',     score: -10 },  // 凶,病
  '天柱': { type: 'bad',     score: -8 },   // 凶,毁折
  '天心': { type: 'good',    score: 12 },   // 大吉,医药
  '天禽': { type: 'good',    score: 10 }    // 吉,中宫之星
};

/**
 * 三奇六仪权重(乙丙丁为三奇,大吉)
 */
export const SAN_QI_LIU_YI_BONUS: Record<string, number> = {
  '乙': 15,  // 乙奇(日奇)
  '丙': 18,  // 丙奇(月奇)
  '丁': 15,  // 丁奇(星奇)
  '戊': 0,
  '己': -5,
  '庚': -8,  // 庚为凶仪
  '辛': 0,
  '壬': 0,
  '癸': 0
};
```

## 验证清单

```
□ qimen-direction-map.ts 实现完整
□ DIRECTION_TO_QIMEN_PALACE 8 方位映射正确
□ EIGHT_DOORS_NATURE 8 门吉凶
□ EIGHT_GODS_NATURE 8 神吉凶
□ NINE_STARS_NATURE 9 星吉凶
□ SAN_QI_LIU_YI_BONUS 三奇六仪加分
□ tsc --noEmit 通过

🛑 等用户确认进入 Step 3
```

---

# 第 3 部分:Step 3 - 五行 + 用神计算辅助

## Step 3.1: 五行交互工具

文件:`lib/syncro/wuxing-utils.ts`(新建)

```typescript
// lib/syncro/wuxing-utils.ts

export type WuXing = '木' | '火' | '土' | '金' | '水';

/**
 * 五行相生:木生火、火生土、土生金、金生水、水生木
 */
const SHENG: Record<WuXing, WuXing> = {
  '木': '火',
  '火': '土',
  '土': '金',
  '金': '水',
  '水': '木'
};

/**
 * 五行相克:木克土、土克水、水克火、火克金、金克木
 */
const KE: Record<WuXing, WuXing> = {
  '木': '土',
  '土': '水',
  '水': '火',
  '火': '金',
  '金': '木'
};

/**
 * A 对 B 的关系
 * 'same' = A 跟 B 同类(比劫)
 * 'shengSelf' = A 生 B(食伤)
 * 'shengOther' = B 生 A(印星)
 * 'keSelf' = A 克 B(财星)
 * 'keOther' = B 克 A(官杀)
 */
export type WuXingRelation = 'same' | 'shengSelf' | 'shengOther' | 'keSelf' | 'keOther';

export function getWuXingRelation(a: WuXing, b: WuXing): WuXingRelation {
  if (a === b) return 'same';
  if (SHENG[a] === b) return 'shengSelf';     // A 生 B
  if (SHENG[b] === a) return 'shengOther';    // B 生 A
  if (KE[a] === b) return 'keSelf';           // A 克 B
  if (KE[b] === a) return 'keOther';          // B 克 A
  
  // 不应该到这里
  return 'same';
}

/**
 * 关系对【用神】角度的得分
 * 计算"A 是用神,B 是另一个元素"对用神的影响
 */
export function scoreForYongShen(yongShenRelation: WuXingRelation): number {
  switch (yongShenRelation) {
    case 'same':         return 12;   // 同类比劫,助力
    case 'shengOther':   return 10;   // B 生用神 A,大吉
    case 'shengSelf':    return -3;   // 用神 A 泄气
    case 'keOther':      return -12;  // B 克用神 A,凶
    case 'keSelf':       return 5;    // 用神 A 克 B(财星),中性偏吉
  }
}

/**
 * 天干 → 五行映射
 */
export const STEM_TO_WUXING: Record<string, WuXing> = {
  '甲': '木', '乙': '木',
  '丙': '火', '丁': '火',
  '戊': '土', '己': '土',
  '庚': '金', '辛': '金',
  '壬': '水', '癸': '水'
};

/**
 * 地支 → 五行映射
 */
export const BRANCH_TO_WUXING: Record<string, WuXing> = {
  '寅': '木', '卯': '木',
  '巳': '火', '午': '火',
  '辰': '土', '戌': '土', '丑': '土', '未': '土',
  '申': '金', '酉': '金',
  '亥': '水', '子': '水'
};

/**
 * 时辰 id → 地支
 */
export const HOUR_PERIOD_TO_BRANCH: Record<string, string> = {
  zi:   '子',
  chou: '丑',
  yin:  '寅',
  mao:  '卯',
  chen: '辰',
  si:   '巳',
  wu:   '午',
  wei:  '未',
  shen: '申',
  you:  '酉',
  xu:   '戌',
  hai:  '亥'
};
```

## Step 3.2: 任务关键词提取

文件:`lib/syncro/task-keyword-extractor.ts`(新建)

```typescript
// lib/syncro/task-keyword-extractor.ts

/**
 * 8 大任务类型,对应奇门用神
 * 简化版:不做完整自然语言理解,用关键词匹配
 */
export type TaskType = 
  | 'wealth'         // 求财
  | 'career'         // 事业
  | 'relationship'   // 人际/感情
  | 'health'         // 健康
  | 'decision'       // 决断
  | 'travel'         // 出行
  | 'communication'  // 沟通
  | 'creation'       // 创作/学习
  | 'other';

export interface TaskKeywords {
  primary_type: TaskType;
  secondary_types: TaskType[];
  raw_keywords: string[];
}

const KEYWORD_PATTERNS: Record<TaskType, RegExp[]> = {
  wealth: [
    /\b(money|wealth|invest|business|sale|deal|contract|profit|finance|sign|close)\b/i,
    /(钱|财|生意|签|投资|赚|收入|合同|交易|销售|买|卖|商谈)/
  ],
  career: [
    /\b(job|career|interview|promote|hire|resign|work|company|boss|colleague)\b/i,
    /(工作|事业|面试|升职|跳槽|辞职|公司|老板|同事|项目)/
  ],
  relationship: [
    /\b(meet|date|partner|marry|wedding|divorce|relationship|friend|family|conflict)\b/i,
    /(感情|对象|结婚|约会|分手|相亲|朋友|家人|矛盾|冲突|和好)/
  ],
  health: [
    /\b(health|hospital|doctor|sick|exercise|sleep|medicine)\b/i,
    /(健康|医院|医生|生病|锻炼|睡觉|吃药|身体)/
  ],
  decision: [
    /\b(decide|choose|whether|should|or|either)\b/i,
    /(决定|选择|要不要|是否|该不该)/
  ],
  travel: [
    /\b(travel|trip|fly|visit|move|relocate|airport|flight)\b/i,
    /(出行|出差|旅行|搬家|飞机|火车|远行)/
  ],
  communication: [
    /\b(talk|discuss|negotiate|present|speech|email|message)\b/i,
    /(谈话|讨论|沟通|演讲|汇报|说服|对话)/
  ],
  creation: [
    /\b(create|write|design|study|learn|exam|test|build)\b/i,
    /(创作|写作|设计|学习|考试|做|制作|建立)/
  ],
  other: []
};

export function extractTaskKeywords(taskDescription: string): TaskKeywords {
  const matches: Record<TaskType, number> = {
    wealth: 0,
    career: 0,
    relationship: 0,
    health: 0,
    decision: 0,
    travel: 0,
    communication: 0,
    creation: 0,
    other: 0
  };
  
  const rawKeywords: string[] = [];
  
  for (const [type, patterns] of Object.entries(KEYWORD_PATTERNS) as [TaskType, RegExp[]][]) {
    for (const pattern of patterns) {
      const matchResult = taskDescription.match(pattern);
      if (matchResult) {
        matches[type] += matchResult.length;
        rawKeywords.push(...matchResult);
      }
    }
  }
  
  // 找到 primary type
  let primaryType: TaskType = 'other';
  let primaryCount = 0;
  for (const [type, count] of Object.entries(matches) as [TaskType, number][]) {
    if (count > primaryCount) {
      primaryCount = count;
      primaryType = type;
    }
  }
  
  // secondary types(其他 match > 0 的)
  const secondaryTypes: TaskType[] = [];
  for (const [type, count] of Object.entries(matches) as [TaskType, number][]) {
    if (type !== primaryType && count > 0) {
      secondaryTypes.push(type);
    }
  }
  
  return {
    primary_type: primaryType,
    secondary_types: secondaryTypes,
    raw_keywords: [...new Set(rawKeywords)]
  };
}

/**
 * 任务类型 → 奇门用神(指导八门匹配)
 */
export const TASK_TO_QIMEN_FAVORED_DOORS: Record<TaskType, string[]> = {
  wealth: ['生門', '開門'],           // 求财用生门
  career: ['開門', '生門'],           // 事业用开门
  relationship: ['休門', '生門'],     // 人际用休门
  health: ['休門', '生門'],           // 健康用休门
  decision: ['開門', '景門'],         // 决断用开门
  travel: ['開門', '生門'],           // 出行用开门
  communication: ['景門', '開門'],    // 沟通用景门
  creation: ['景門', '生門'],         // 创作用景门
  other: ['開門']
};

/**
 * 任务类型 → 方位的传统匹配偏好
 */
export const TASK_TO_DIRECTION_BONUS: Record<TaskType, Record<string, number>> = {
  wealth:        { SE: 5, E: 3 },              // 财位偏东南
  career:        { S: 5, SE: 3 },              // 事业偏南
  relationship:  { SW: 5, NE: 3 },             // 人际偏西南
  health:        { N: 3, E: 3 },               // 健康偏东
  decision:      { W: 5, NW: 3 },              // 决断偏西
  travel:        { NW: 5, E: 3 },              // 出行偏西北
  communication: { E: 3, S: 3 },               // 沟通偏东南
  creation:      { S: 3, SE: 3 },              // 创作偏南
  other:         {}
};
```

## 验证清单

```
□ wuxing-utils.ts 实现五行交互
□ task-keyword-extractor.ts 实现任务类型提取
□ TASK_TO_QIMEN_FAVORED_DOORS 映射
□ TASK_TO_DIRECTION_BONUS 映射
□ tsc 通过
□ 写 2 个 unit test:
  - getWuXingRelation 各种情况
  - extractTaskKeywords 中英文识别

🛑 等用户确认进入 Step 4
```

---

# 第 4 部分:Step 4 - 5 维度打分模型

## Step 4.1: 核心打分函数

文件:`lib/syncro/calculate-score.ts`(新建)

```typescript
// lib/syncro/calculate-score.ts

import { Lunar } from 'lunar-typescript';
import { QimenUtil } from '@/lib/qimen/QimenUtil';
import { 
  DIRECTION_TO_QIMEN_PALACE,
  EIGHT_DOORS_NATURE,
  EIGHT_GODS_NATURE,
  NINE_STARS_NATURE,
  SAN_QI_LIU_YI_BONUS
} from './qimen-direction-map';
import {
  getWuXingRelation,
  scoreForYongShen,
  STEM_TO_WUXING,
  BRANCH_TO_WUXING,
  HOUR_PERIOD_TO_BRANCH,
  type WuXing
} from './wuxing-utils';
import {
  extractTaskKeywords,
  TASK_TO_QIMEN_FAVORED_DOORS,
  TASK_TO_DIRECTION_BONUS,
  type TaskKeywords
} from './task-keyword-extractor';
import type { DirectionId } from './current-system';
import type { HourPeriod } from './types';

/**
 * 单个方位 × 时辰组合的【因子明细】
 * 内部用,不暴露给用户(也不给 LLM,只给 LLM 看 total_score 和 level)
 */
export interface ScoreFactors {
  // 维度 1: 奇门盘信号(权重 35%)
  qimen_signals: {
    door_score: number;        // 八门得分(根据八门吉凶)
    god_score: number;         // 八神得分
    star_score: number;        // 九星得分
    san_qi_bonus: number;      // 三奇六仪加分
    is_kong_wang: boolean;     // 是否空亡
    favored_door_match: boolean; // 是否匹配任务的喜门
    subtotal: number;          // 维度小计
  };
  
  // 维度 2: 用神方位匹配(权重 25%)
  yong_shen_direction: {
    yong_shen_wuxing: WuXing;
    direction_wuxing: WuXing;
    relation: string;
    subtotal: number;
  };
  
  // 维度 3: 时辰天干 vs 用神(权重 20%)
  hour_yong_shen: {
    hour_stem_wuxing: WuXing;
    relation: string;
    subtotal: number;
  };
  
  // 维度 4: 日主 vs 方位(权重 10%)
  day_master_direction: {
    day_master_wuxing: WuXing;
    direction_wuxing: WuXing;
    relation: string;
    subtotal: number;
  };
  
  // 维度 5: 任务匹配方位含义(权重 10%)
  task_direction_match: {
    task_type: string;
    bonus: number;
    subtotal: number;
  };
  
  // 总分
  total_score: number;
}

/**
 * 计算单个组合的得分
 */
export function calculateCombinationScore(input: {
  // 用户命局
  yongShenWuXing: WuXing;        // 用神五行
  dayMasterWuXing: WuXing;        // 日主五行
  
  // 时空
  hourPeriod: HourPeriod;         // 时辰 id
  direction: DirectionId;         // 方位 id
  combinationTime: Date;          // 该组合对应的具体时间(用于奇门盘)
  
  // 任务
  taskKeywords: TaskKeywords;
}): ScoreFactors {
  
  // ============= 维度 1: 奇门盘信号(35%)=============
  
  const lunar = Lunar.fromDate(input.combinationTime);
  const qimenPan = QimenUtil.create(lunar);
  
  const palaceInfo = DIRECTION_TO_QIMEN_PALACE[input.direction];
  const cell = qimenPan.九宮[palaceInfo.palace_index];
  
  // 八门得分
  const doorInfo = EIGHT_DOORS_NATURE[cell.八門];
  const doorScore = doorInfo?.score || 0;
  
  // 八神得分
  const godInfo = EIGHT_GODS_NATURE[cell.八神];
  const godScore = godInfo?.score || 0;
  
  // 九星得分
  const starInfo = NINE_STARS_NATURE[cell.九星];
  const starScore = starInfo?.score || 0;
  
  // 三奇六仪加分(看天盘干)
  let sanQiBonus = 0;
  if (cell.天盤干 && cell.天盤干.length > 0) {
    for (const stem of cell.天盤干) {
      sanQiBonus += SAN_QI_LIU_YI_BONUS[stem] || 0;
    }
  }
  
  // 空亡扣分
  const isKongWang = cell.是否空亡 || false;
  const kongWangPenalty = isKongWang ? -15 : 0;
  
  // 任务喜门匹配
  const favoredDoors = TASK_TO_QIMEN_FAVORED_DOORS[input.taskKeywords.primary_type] || [];
  const favoredDoorMatch = favoredDoors.includes(cell.八門);
  const favoredDoorBonus = favoredDoorMatch ? 8 : 0;
  
  // 维度 1 小计(乘以 0.35 权重)
  const qimenSubtotal = (
    doorScore + godScore + starScore + sanQiBonus + kongWangPenalty + favoredDoorBonus
  ) * 0.35;
  
  // ============= 维度 2: 用神方位匹配(25%)=============
  
  const dirWuXing = palaceInfo.element as WuXing;
  const yongShenRelation = getWuXingRelation(input.yongShenWuXing, dirWuXing);
  const yongShenDirectionScore = scoreForYongShen(yongShenRelation) * 1.5;
  
  const yongShenSubtotal = yongShenDirectionScore * 0.25 * 3;  // 调整权重
  
  // ============= 维度 3: 时辰天干 vs 用神(20%)=============
  
  // 时辰干支(从奇门盘获取)
  const hourStem = qimenPan.時干支?.[0] || '甲';
  const hourStemWuXing = STEM_TO_WUXING[hourStem] || '木';
  const hourRelation = getWuXingRelation(input.yongShenWuXing, hourStemWuXing);
  const hourScore = scoreForYongShen(hourRelation);
  
  const hourSubtotal = hourScore * 0.20 * 3;
  
  // ============= 维度 4: 日主 vs 方位(10%)=============
  
  const dayMasterRelation = getWuXingRelation(input.dayMasterWuXing, dirWuXing);
  const dayMasterScore = scoreForDayMaster(dayMasterRelation);
  
  const dayMasterSubtotal = dayMasterScore * 0.10 * 3;
  
  // ============= 维度 5: 任务匹配方位含义(10%)=============
  
  const directionBonusMap = TASK_TO_DIRECTION_BONUS[input.taskKeywords.primary_type] || {};
  const taskDirectionBonus = directionBonusMap[input.direction] || 0;
  
  const taskSubtotal = taskDirectionBonus * 0.10 * 3;
  
  // ============= 总分 =============
  
  const totalScore = 
    qimenSubtotal + 
    yongShenSubtotal + 
    hourSubtotal + 
    dayMasterSubtotal + 
    taskSubtotal;
  
  return {
    qimen_signals: {
      door_score: doorScore,
      god_score: godScore,
      star_score: starScore,
      san_qi_bonus: sanQiBonus,
      is_kong_wang: isKongWang,
      favored_door_match: favoredDoorMatch,
      subtotal: qimenSubtotal
    },
    yong_shen_direction: {
      yong_shen_wuxing: input.yongShenWuXing,
      direction_wuxing: dirWuXing,
      relation: yongShenRelation,
      subtotal: yongShenSubtotal
    },
    hour_yong_shen: {
      hour_stem_wuxing: hourStemWuXing,
      relation: hourRelation,
      subtotal: hourSubtotal
    },
    day_master_direction: {
      day_master_wuxing: input.dayMasterWuXing,
      direction_wuxing: dirWuXing,
      relation: dayMasterRelation,
      subtotal: dayMasterSubtotal
    },
    task_direction_match: {
      task_type: input.taskKeywords.primary_type,
      bonus: taskDirectionBonus,
      subtotal: taskSubtotal
    },
    total_score: Math.round(totalScore * 100) / 100
  };
}

/**
 * 日主对方位的关系评分(权重 10%,影响较小)
 */
function scoreForDayMaster(relation: string): number {
  switch (relation) {
    case 'same':         return 5;    // 比劫帮身
    case 'shengOther':   return 8;    // 印星生身
    case 'shengSelf':    return -3;   // 日主泄气
    case 'keOther':      return -5;   // 官杀克身
    case 'keSelf':       return 3;    // 财星
    default:             return 0;
  }
}

/**
 * 得分到 Current 等级
 */
export function scoreToCurrentLevel(score: number): string {
  if (score >= 25) return 'open_current';
  if (score >= 8) return 'following_current';
  if (score >= -8) return 'stillwater';
  if (score >= -25) return 'crosscurrent';
  return 'undertow';
}
```

## Step 4.2: 单元测试

文件:`lib/syncro/__tests__/calculate-score.test.ts`(新建)

```typescript
import { calculateCombinationScore, scoreToCurrentLevel } from '../calculate-score';
import { extractTaskKeywords } from '../task-keyword-extractor';

describe('calculate-score', () => {
  const fixedTime = new Date('2024-05-10T14:30:00Z');
  
  it('should calculate score for a valid combination', () => {
    const taskKeywords = extractTaskKeywords('I have a job interview tomorrow');
    
    const factors = calculateCombinationScore({
      yongShenWuXing: '木',
      dayMasterWuXing: '木',
      hourPeriod: 'wei',
      direction: 'E',
      combinationTime: fixedTime,
      taskKeywords
    });
    
    expect(factors.total_score).toBeDefined();
    expect(factors.qimen_signals.subtotal).toBeDefined();
    expect(factors.yong_shen_direction.subtotal).toBeDefined();
  });
  
  it('east direction should be good for wood yong_shen', () => {
    const taskKeywords = extractTaskKeywords('需要灵感写代码');
    
    const eastFactors = calculateCombinationScore({
      yongShenWuXing: '木',
      dayMasterWuXing: '木',
      hourPeriod: 'wei',
      direction: 'E',
      combinationTime: fixedTime,
      taskKeywords
    });
    
    const westFactors = calculateCombinationScore({
      yongShenWuXing: '木',
      dayMasterWuXing: '木',
      hourPeriod: 'wei',
      direction: 'W',
      combinationTime: fixedTime,
      taskKeywords
    });
    
    // E 方位是木,W 方位是金,金克木
    // 用神为木时,E 应该比 W 得分高
    expect(eastFactors.yong_shen_direction.subtotal).toBeGreaterThan(
      westFactors.yong_shen_direction.subtotal
    );
  });
  
  it('should map scores correctly to levels', () => {
    expect(scoreToCurrentLevel(50)).toBe('open_current');
    expect(scoreToCurrentLevel(15)).toBe('following_current');
    expect(scoreToCurrentLevel(0)).toBe('stillwater');
    expect(scoreToCurrentLevel(-15)).toBe('crosscurrent');
    expect(scoreToCurrentLevel(-40)).toBe('undertow');
  });
});
```

## 验证清单

```
□ calculate-score.ts 实现
□ 5 维度打分逻辑完整
□ 奇门盘信号集成
□ scoreToCurrentLevel 映射正确
□ 3 个单元测试通过

🛑 等用户确认进入 Step 5
```

---

# 第 5 部分:Step 5 - 96 组合矩阵生成

## Step 5.1: 矩阵生成主函数

文件:`lib/syncro/calculate-matrix.ts`(新建)

```typescript
// lib/syncro/calculate-matrix.ts

import { calculateCombinationScore, scoreToCurrentLevel } from './calculate-score';
import { extractTaskKeywords } from './task-keyword-extractor';
import { STEM_TO_WUXING, BRANCH_TO_WUXING, type WuXing } from './wuxing-utils';
import { DIRECTIONS, type DirectionId } from './current-system';
import { HOUR_PERIODS, type HourPeriod } from './types';

/**
 * 96 组合矩阵中每个 cell 的【本地计算结果】
 * 这是注入给 LLM 的【确定性数据】
 */
export interface MatrixCell {
  hour_period: HourPeriod;
  direction_id: DirectionId;
  
  hour_start_iso: string;
  hour_end_iso: string;
  
  // 等级(本地计算,LLM 不能改)
  current_level: 'open_current' | 'following_current' | 'stillwater' | 'crosscurrent' | 'undertow';
  
  // 内部数据(注入给 LLM 用于生成文案)
  _internal: {
    total_score: number;
    key_factors: string[];       // 影响这个等级的关键因素(给 LLM 写 rationale 用)
    qimen_data: {
      door: string;              // 八门(中文)
      god: string;               // 八神
      star: string;              // 九星
      is_kong_wang: boolean;
    };
  };
  
  // 这些字段由 LLM 填充
  short_advice: string;
  detailed_advice: string;
  rationale: string;
}

/**
 * 主函数:生成完整 96 组合矩阵
 */
export function calculateSyncroMatrix(input: {
  profile: any;
  taskDescription: string;
  startTime: Date;        // 用户访问的时间
  userTimezone: string;
}): Record<string, MatrixCell> {
  
  // 1. 提取用户命局关键信息
  const yongShenWuXing = extractYongShenWuXing(input.profile);
  const dayMasterWuXing = extractDayMasterWuXing(input.profile);
  
  // 2. 解析任务
  const taskKeywords = extractTaskKeywords(input.taskDescription);
  
  // 3. 生成接下来 12 个时辰
  const hourPeriods = generateNext12HourPeriods(input.startTime);
  
  const matrix: Record<string, MatrixCell> = {};
  
  // 4. 遍历 12 时辰 × 8 方位
  for (const period of hourPeriods) {
    for (const direction of Object.keys(DIRECTIONS) as DirectionId[]) {
      const factors = calculateCombinationScore({
        yongShenWuXing,
        dayMasterWuXing,
        hourPeriod: period.id,
        direction,
        combinationTime: period.start,
        taskKeywords
      });
      
      const level = scoreToCurrentLevel(factors.total_score);
      
      // 提取关键因素(给 LLM 写 rationale 时引用)
      const keyFactors = extractKeyFactors(factors);
      
      // 从奇门盘获取 cell 数据(用于 LLM 文案中提及"八门""九星"等)
      // 注意:这里 factors 已经计算过了,但我们需要重新查 qimenPan 来拿原始数据
      // 优化:可以在 calculate-score.ts 中把这些原始数据也返回出来
      
      const key = `${period.id}__${direction}`;
      matrix[key] = {
        hour_period: period.id,
        direction_id: direction,
        hour_start_iso: period.start.toISOString(),
        hour_end_iso: period.end.toISOString(),
        current_level: level as any,
        _internal: {
          total_score: factors.total_score,
          key_factors: keyFactors,
          qimen_data: {
            door: '', // 在 Step 6 我们会重构 calculate-score 把这个返回出来
            god: '',
            star: '',
            is_kong_wang: factors.qimen_signals.is_kong_wang
          }
        },
        short_advice: '',
        detailed_advice: '',
        rationale: ''
      };
    }
  }
  
  return matrix;
}

/**
 * 从 ScoreFactors 提取最关键的 2-3 个因素
 * 给 LLM 写 rationale 时引用
 */
function extractKeyFactors(factors: any): string[] {
  const items: Array<{name: string, score: number}> = [];
  
  items.push({ name: 'qimen', score: Math.abs(factors.qimen_signals.subtotal) });
  items.push({ name: 'yong_shen_direction', score: Math.abs(factors.yong_shen_direction.subtotal) });
  items.push({ name: 'hour_yong_shen', score: Math.abs(factors.hour_yong_shen.subtotal) });
  items.push({ name: 'day_master_direction', score: Math.abs(factors.day_master_direction.subtotal) });
  items.push({ name: 'task_direction', score: Math.abs(factors.task_direction_match.subtotal) });
  
  // 按绝对得分排序,取前 3
  items.sort((a, b) => b.score - a.score);
  return items.slice(0, 3).map(i => i.name);
}

/**
 * 从 profile 提取用神五行
 */
function extractYongShenWuXing(profile: any): WuXing {
  // 优先取 base_analysis 中的 primary_yong_shen
  const ys = profile?.base_analysis?.content?.yong_shen?.primary_element 
    || profile?.user_profile?.yong_shen?.primary 
    || '木';
  
  // 如果是天干形式(如"乙"),转为五行
  if (STEM_TO_WUXING[ys]) return STEM_TO_WUXING[ys];
  
  // 如果是五行直接形式,验证
  if (['木', '火', '土', '金', '水'].includes(ys)) return ys as WuXing;
  
  return '木';  // 默认
}

function extractDayMasterWuXing(profile: any): WuXing {
  const dm = profile?.base_analysis?.content?.bazi?.day_master 
    || profile?.user_profile?.bazi?.day_master 
    || '甲';
  
  return STEM_TO_WUXING[dm] || '木';
}

/**
 * 生成接下来 12 个 2 小时时段
 */
function generateNext12HourPeriods(startTime: Date): Array<{
  id: HourPeriod;
  start: Date;
  end: Date;
}> {
  const periods: any[] = [];
  
  const hourPeriodsOrder: HourPeriod[] = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai'];
  
  // 找到当前时辰
  const currentHour = startTime.getHours();
  let currentIdx = 0;
  if (currentHour >= 23 || currentHour < 1) currentIdx = 0;
  else if (currentHour < 3) currentIdx = 1;
  else if (currentHour < 5) currentIdx = 2;
  else if (currentHour < 7) currentIdx = 3;
  else if (currentHour < 9) currentIdx = 4;
  else if (currentHour < 11) currentIdx = 5;
  else if (currentHour < 13) currentIdx = 6;
  else if (currentHour < 15) currentIdx = 7;
  else if (currentHour < 17) currentIdx = 8;
  else if (currentHour < 19) currentIdx = 9;
  else if (currentHour < 21) currentIdx = 10;
  else currentIdx = 11;
  
  // 当前时辰的起始时间
  const baseHour = [-1, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21][currentIdx];
  
  const currentStart = new Date(startTime);
  if (baseHour === -1) {
    // 子时跨日
    if (currentHour >= 23) {
      currentStart.setHours(23, 0, 0, 0);
    } else {
      // 已经过了 0 点但还在子时
      currentStart.setDate(currentStart.getDate() - 1);
      currentStart.setHours(23, 0, 0, 0);
    }
  } else {
    currentStart.setHours(baseHour, 0, 0, 0);
  }
  
  for (let i = 0; i < 12; i++) {
    const periodStart = new Date(currentStart);
    periodStart.setHours(periodStart.getHours() + i * 2);
    
    const periodEnd = new Date(periodStart);
    periodEnd.setHours(periodEnd.getHours() + 2);
    
    const idx = (currentIdx + i) % 12;
    
    periods.push({
      id: hourPeriodsOrder[idx],
      start: periodStart,
      end: periodEnd
    });
  }
  
  return periods;
}
```

## Step 5.2: 端到端测试

文件:`lib/syncro/__tests__/calculate-matrix.test.ts`(新建)

```typescript
import { calculateSyncroMatrix } from '../calculate-matrix';

describe('calculate-matrix', () => {
  it('should generate 96 combinations', () => {
    const mockProfile = {
      base_analysis: {
        content: {
          bazi: { day_master: '乙' },
          yong_shen: { primary_element: '水' }
        }
      }
    };
    
    const matrix = calculateSyncroMatrix({
      profile: mockProfile,
      taskDescription: 'Tomorrow I need to make an important business decision',
      startTime: new Date('2024-05-10T10:00:00Z'),
      userTimezone: 'America/New_York'
    });
    
    expect(Object.keys(matrix)).toHaveLength(96);
    
    // 验证每个 cell 完整
    for (const key of Object.keys(matrix)) {
      const cell = matrix[key];
      expect(cell.current_level).toMatch(/open_current|following_current|stillwater|crosscurrent|undertow/);
      expect(cell._internal.total_score).toBeDefined();
      expect(cell._internal.key_factors).toHaveLength(3);
    }
  });
  
  it('should be deterministic - same input gives same output', () => {
    const mockProfile = {
      base_analysis: {
        content: {
          bazi: { day_master: '丙' },
          yong_shen: { primary_element: '木' }
        }
      }
    };
    
    const input = {
      profile: mockProfile,
      taskDescription: 'Looking for new job opportunities',
      startTime: new Date('2024-05-10T10:00:00Z'),
      userTimezone: 'America/New_York'
    };
    
    const matrix1 = calculateSyncroMatrix(input);
    const matrix2 = calculateSyncroMatrix(input);
    
    // 两次结果应该完全一致(等级 + 得分)
    for (const key of Object.keys(matrix1)) {
      expect(matrix1[key].current_level).toBe(matrix2[key].current_level);
      expect(matrix1[key]._internal.total_score).toBe(matrix2[key]._internal.total_score);
    }
  });
  
  it('should distribute levels reasonably', () => {
    const mockProfile = {
      base_analysis: {
        content: {
          bazi: { day_master: '甲' },
          yong_shen: { primary_element: '水' }
        }
      }
    };
    
    const matrix = calculateSyncroMatrix({
      profile: mockProfile,
      taskDescription: 'I want to find love',
      startTime: new Date('2024-05-10T10:00:00Z'),
      userTimezone: 'UTC'
    });
    
    // 统计 5 个等级的分布
    const distribution: any = {
      open_current: 0,
      following_current: 0,
      stillwater: 0,
      crosscurrent: 0,
      undertow: 0
    };
    
    for (const key of Object.keys(matrix)) {
      distribution[matrix[key].current_level]++;
    }
    
    console.log('Distribution:', distribution);
    
    // 不应该全部是 stillwater(算法没起作用)
    expect(distribution.stillwater).toBeLessThan(80);
    
    // 应该有一些极值
    expect(distribution.open_current + distribution.following_current).toBeGreaterThan(5);
  });
});
```

## 验证清单

```
□ calculate-matrix.ts 实现
□ 96 组合完整生成
□ 等级映射正确
□ 确定性测试通过(同输入 → 同输出)
□ 等级分布合理(不是全 stillwater)
□ 跑 console.log 看实际分布

🛑 等用户确认进入 Step 6
```

---

# 第 6 部分:Step 6 - 修改 LLM Service(只生成文案)

## Step 6.1: 重写 syncro-deepseek-prompt.ts

文件:`lib/llm/prompts/syncro-deepseek-prompt.ts`(完全替换)

```typescript
import { 
  ORIENTAL_COUNSELOR_BASE,
  buildCurrentDateContext,
  buildProfileContextSection,
  buildLanguageGuidance,
  detectLanguage,
  stitchPromptSections
} from './oriental-counselor-base';
import {
  SYNCRO_QIMEN_DUNJIA_IDENTITY,
  SYNCRO_OUTPUT_BRANDING
} from './syncro-base';
import type { MatrixCell } from '@/lib/syncro/calculate-matrix';

export function buildSyncroPrompt(input: {
  profile: any;
  task_description: string;
  user_location: { latitude: number; longitude: number; timezone: string };
  locale: string;
  matrix: Record<string, MatrixCell>;  // ⭐ 已经计算好的矩阵
}): { system: string; user: string } {
  
  const { profile, task_description, user_location, locale, matrix } = input;
  const baseAnalysis = profile?.base_analysis?.content;
  const outputLanguage = detectLanguage(task_description, locale);
  
  const system = stitchPromptSections(
    SYNCRO_QIMEN_DUNJIA_IDENTITY,
    SYNCRO_OUTPUT_BRANDING,
    ORIENTAL_COUNSELOR_BASE,
    buildCurrentDateContext(),
    buildProfileContextSection(profile, baseAnalysis),
    buildLanguageGuidance(locale, task_description),
    
    `# 当前任务:Syncro 96 组合文案生成

用户即将要做的事情:
"${task_description}"

用户当前位置:
经度 ${user_location.longitude.toFixed(4)}, 纬度 ${user_location.latitude.toFixed(4)}
时区:${user_location.timezone}

# ⭐⭐⭐ 极其重要:矩阵已经计算好了

后台已经基于以下完整命理模型,精确计算了每个组合的等级:

5 个维度(已加权):
  1. 奇门遁甲盘信号(权重 35%)
     - 八门吉凶
     - 八神吉凶
     - 九星吉凶
     - 三奇六仪
     - 空亡判断
  2. 用神方位匹配(权重 25%)
     - 用神 vs 方位五行
  3. 时辰天干 vs 用神(权重 20%)
  4. 日主 vs 方位(权重 10%)
  5. 任务匹配方位含义(权重 10%)

# ⛔ 严格禁止

你【绝不能】:
  ✗ 修改任何 current_level(已经是计算结果)
  ✗ 重新判断哪个组合是 open_current
  ✗ 质疑等级的准确性

你只需要:
  ✓ 为每个组合写 short_advice(30-50 字)
  ✓ 为每个组合写 detailed_advice(100-200 字)
  ✓ 为每个组合写 rationale(100-200 字)

# 96 组合数据(已计算)

${JSON.stringify(matrix, null, 2)}

# 你的工作

为每个 key(共 96 个),填入 short_advice / detailed_advice / rationale 三个字段。

写作要求:

1. **short_advice**(30-50 字)
   - 直接的行动指引,符合该方位 × 时辰 × 等级
   - 不重复"open_current"等级名
   - 用动词开头:"Move...", "Wait...", "Pause..."
   
2. **detailed_advice**(100-200 字)
   - 展开命理依据 + 具体行动
   - 引用用户的命局元素(日主/用神/大运)
   - 引用 _internal.qimen_data 中的奇门信号(如有)
   - 适合此方位 × 此时辰的能量组合

3. **rationale**(100-200 字)
   - 解释为什么是这个等级
   - 引用 _internal.key_factors 中提到的因素
   - 把数学得分翻译成命理语言
   - 例:"此方位为坎位,五行属水。你的用神为水,
        本时辰天干为壬亦水,三水齐汇,得分 +28.5。
        加上奇门盘值符星落此位,故为 open_current。"
     
     ⚠️ 但不要直接给用户看"+28.5"等数字
     用文字描述:"水势汇聚""三方助力""值符当头"等

# 关键规则

1. **96 个 key 必须全部填充**
2. **不修改 current_level、total_score 等字段**
3. **使用语言**: ${outputLanguage}
4. **品牌**: 遵守输出品牌 — 用户可见处只用 Syncro,
   可用奇门遁甲术语但要解释,如"值符星"→"主吉星"

# 输出格式(严格 JSON)

\`\`\`json
{
  "matrix": {
    "zi__N": {
      "short_advice": "...",
      "detailed_advice": "...",
      "rationale": "..."
    },
    "zi__NE": { ... },
    // ... 共 96 个 key,只包含这 3 个字段
  }
}
\`\`\`

# 严格 JSON

只输出 JSON,无 markdown 围栏。
96 个 key 全部填充。`
  );
  
  const user = `请为已计算好的 96 组合矩阵,生成 short_advice / detailed_advice / rationale 文案。
不要修改 current_level。
${outputLanguage}。
严格 JSON。`;
  
  return { system, user };
}
```

## Step 6.2: 重写 syncro-reading-service.ts

文件:`lib/llm/services/syncro-reading-service.ts`(完全替换)

```typescript
import { callLLM } from '@/lib/llm/router';
import { buildSyncroPrompt } from '@/lib/llm/prompts/syncro-deepseek-prompt';
import { calculateSyncroMatrix } from '@/lib/syncro/calculate-matrix';
import { getStoredProfile, recordProfileUsage } from '@/lib/profile/stored-profiles-service';

export async function generateSyncroMatrix(input: {
  profile_id: string;
  task_description: string;
  user_location: any;
  locale: string;
}) {
  // 1. 加载 profile
  const profile = await getStoredProfile(input.profile_id);
  if (!profile) throw new Error('Profile not found');
  
  if (!profile.base_analysis?.content) {
    throw new Error('Profile has no base_analysis');
  }
  
  // 2. ⭐ 本地计算 96 组合矩阵(确定性 + 可重复)
  console.log('[syncro] Computing 96 combinations locally...');
  const localMatrix = calculateSyncroMatrix({
    profile,
    taskDescription: input.task_description,
    startTime: new Date(),
    userTimezone: input.user_location.timezone
  });
  
  // 统计本地计算结果
  const distribution = computeDistribution(localMatrix);
  console.log('[syncro] Local matrix distribution:', distribution);
  
  // 3. 构建 prompt(注入已计算好的矩阵)
  const { system, user } = buildSyncroPrompt({
    profile,
    task_description: input.task_description,
    user_location: input.user_location,
    locale: input.locale,
    matrix: localMatrix
  });
  
  console.log('[syncro] Calling DeepSeek V4 Pro for 96 text outputs...');
  const startTime = Date.now();
  
  // 4. 调用 DeepSeek(文案只用 medium thinking,因为不需要"思考",只需要"写作")
  const result = await callLLM({
    call_type: 'deep_analysis',
    system,
    messages: [{ role: 'user', content: user }],
    max_tokens: 18000,
    thinking_effort: 'medium',  // ⭐ 从 high 改为 medium(只写文案)
    response_format: 'json'
  });
  
  // 5. 解析 JSON
  let parsedAdvice: any;
  try {
    const cleaned = result.content
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    parsedAdvice = JSON.parse(cleaned);
  } catch (e: any) {
    console.error('[syncro] JSON parse failed:', e.message);
    throw new Error('Syncro text generation output is not valid JSON');
  }
  
  // 6. 合并:本地等级 + LLM 文案
  const finalMatrix: any = {};
  for (const key of Object.keys(localMatrix)) {
    const localCell = localMatrix[key];
    const llmAdvice = parsedAdvice.matrix?.[key] || {};
    
    finalMatrix[key] = {
      ...localCell,
      // ⭐ LLM 只能填充这 3 个字段,其他用本地的
      short_advice: llmAdvice.short_advice || generateFallbackShort(localCell),
      detailed_advice: llmAdvice.detailed_advice || generateFallbackDetailed(localCell),
      rationale: llmAdvice.rationale || generateFallbackRationale(localCell),
      // 去掉 _internal(不返回给前端)
      _internal: undefined
    };
  }
  
  // 7. 校验 96 个 key 都有文案
  const incompleteKeys = Object.keys(finalMatrix).filter(k => 
    !finalMatrix[k].short_advice || !finalMatrix[k].detailed_advice
  );
  if (incompleteKeys.length > 0) {
    console.warn('[syncro] Incomplete keys:', incompleteKeys.length);
  }
  
  // 8. 记录使用
  await recordProfileUsage(input.profile_id, 'syncro');
  
  const elapsedMs = Date.now() - startTime;
  
  return {
    matrix: finalMatrix,
    meta: {
      model: result.actual_model,
      tokens_used: result.meta.tokens_used,
      cost_usd: result.meta.cost_usd || 0,
      latency_ms: elapsedMs,
      local_computation: true,
      distribution
    }
  };
}

function computeDistribution(matrix: any) {
  const dist: any = {
    open_current: 0,
    following_current: 0,
    stillwater: 0,
    crosscurrent: 0,
    undertow: 0
  };
  for (const key of Object.keys(matrix)) {
    dist[matrix[key].current_level]++;
  }
  return dist;
}

// Fallback 文案(LLM 偶尔遗漏 key 时)
function generateFallbackShort(cell: any): string {
  const levelMap: any = {
    open_current: 'Move with confidence — the current is fully with you.',
    following_current: 'The current supports you, with some effort.',
    stillwater: 'The water is still. Pause and observe.',
    crosscurrent: 'Crosscurrent. Reconsider this direction.',
    undertow: 'Strong undertow. Hold back, choose another path.'
  };
  return levelMap[cell.current_level] || 'Take a measured approach.';
}

function generateFallbackDetailed(cell: any): string {
  return generateFallbackShort(cell) + ' This pattern emerges from the combination of your chart and the current moment.';
}

function generateFallbackRationale(cell: any): string {
  return `This level reflects the balance between your day master, favorable element, and the timing-direction combination at this moment.`;
}
```

## 验证清单

```
□ syncro-deepseek-prompt.ts 重写完成
□ Prompt 中明确禁止 LLM 修改 current_level
□ Prompt 中注入已计算好的 matrix
□ syncro-reading-service.ts 重写完成
□ 流程:本地计算 → LLM 生成文案 → 合并 → 返回
□ Fallback 机制(LLM 遗漏 key 时)
□ tsc 通过

🛑 等用户确认进入 Step 7
```

---

# 第 7 部分:Step 7 - 端到端验证

## Step 7.1: 集成测试

```
任务:

清空浏览器,跑完整 Syncro 流程:

测试用例:
  Profile: 1977-02-17 03:00 男(乙木日主,用神为水)
  Task: "Tomorrow morning I have a job interview at 10 AM"
  Location: New York (40.71, -74.00)

【验证 1: 本地计算确定性】

跑 5 次相同输入:
  for (let i = 0; i < 5; i++) {
    const matrix = calculateSyncroMatrix({...sameInput});
    console.log(`Run ${i}: ${matrix['mao__E'].current_level}`);
  }

✓ 5 次应该完全一致(等级 + 得分)

【验证 2: 等级分布合理】

总 96 组合,分布应该不是全 stillwater:
  ✓ 至少 5-15 个 open_current 或 following_current
  ✓ 至少 5-15 个 crosscurrent 或 undertow
  ✓ stillwater 不超过 50 个

如果全是 stillwater → 算法没起作用,检查 calculate-score.ts

【验证 3: 不同用户应该不同】

用户 A (用神水) vs 用户 B (用神火):
  同时间 + 同方位 + 同任务
  → 等级分布应该不同

验证:
  const matrixA = calculateSyncroMatrix({profile: profileA, ...});
  const matrixB = calculateSyncroMatrix({profile: profileB, ...});
  
  let diffCount = 0;
  for (const key of Object.keys(matrixA)) {
    if (matrixA[key].current_level !== matrixB[key].current_level) {
      diffCount++;
    }
  }
  
  console.log(`Different levels: ${diffCount}/96`);
  ✓ 应该 > 20(否则算法没有个性化)

【验证 4: 北/南方位差异】

对用神为【水】的用户:
  N 方位(坎宫,五行水)should 平均得分 > S 方位(离宫,五行火)
  
  let northScores = [];
  let southScores = [];
  for (let i = 0; i < 12; i++) {
    const period = hourPeriods[i];
    // 计算 N 和 S 在同时辰的得分
    ...
  }
  
  ✓ avg(northScores) > avg(southScores)

【验证 5: LLM 文案质量】

跑完整 API:
  POST /api/syncro/compute
  
  检查返回:
  □ 96 组合都有 short_advice
  □ 96 组合都有 detailed_advice
  □ 96 组合都有 rationale
  □ 等级跟本地计算一致(LLM 没改)
  □ rationale 中提到具体命局元素(日主/用神等)
  □ 不出现"奇门遁甲""三奇六仪"等术语暴露给用户

【验证 6: 时间一致性】

如果用户 2 分钟后再访问:
  current_level 不应该大幅变化(只有时辰切换时才变)

【验证 7: 缓存】

写一个简单 test:
  console.log 在 syncro-reading-service.ts 中加日志
  
  调用一次 → 看到 "Computing 96 combinations locally..."
  再调一次相同输入 → ?
  
  注意:目前没有缓存层,每次都重算
  如果需要,可以在 P1 加 Redis 缓存(同 profile + 任务 + 30 分钟内)

【提交报告】

完成后向用户:
1. 5 个验证的结果
2. console.log 实际输出
3. 一个完整 96 组合的等级分布
4. LLM 文案样本(挑 5 个不同等级的)
5. DeepSeek tokens / cost
6. 任何异常或建议
```

## 验证清单

```
□ 验证 1: 确定性通过
□ 验证 2: 分布合理
□ 验证 3: 用户个性化
□ 验证 4: 方位敏感
□ 验证 5: LLM 文案完整
□ 验证 6: 时间一致性
□ 验证 7: 性能可接受

🛑 等用户最终确认 Syncro v5.1 上线就绪
```

---

# Syncro v5.1 完整重构清单

```
✅ Step 1: 集成 anthonylee1994/qimen
✅ Step 2: 八卦方位 + 奇门宫位映射
✅ Step 3: 五行 + 用神 + 任务关键词工具
✅ Step 4: 5 维度打分模型
✅ Step 5: 96 组合矩阵生成
✅ Step 6: LLM Service 重写(只生成文案)
✅ Step 7: 端到端验证

核心升级 vs v5.0:
  ⭐ 96 组合等级【本地计算确定性】
  ⭐ 集成真实奇门遁甲算法
  ⭐ 5 维度数学打分
  ⭐ LLM 只负责文案(thinking 从 high → medium,省成本)
  ⭐ 可信度从 30-50% → 85%
  ⭐ 命理上严谨,对懂行人站得住脚

商业价值:
  - 用户问"为什么是 Open Current" → 我们能解释具体计算
  - 同样输入永远同样结果 → 可重复验证
  - 退款率下降 → 用户更信任
  - 营销上"基于真实奇门遁甲"= 真的
```

---

# 给 Cursor 的最终提醒

```
本任务包含 Step 1-7。

实施顺序(严格按序):
1. Step 1: 集成 qimen 库(确认测试通过)
2. Step 2: 方位映射 + 奇门数据表
3. Step 3: 五行 + 任务工具
4. Step 4: 打分模型(关键!)
5. Step 5: 矩阵生成
6. Step 6: LLM Service 重写
7. Step 7: 端到端测试

绝不允许:
  ✗ 跳过测试(每个 Step 必须验证)
  ✗ 跨 Step 实施
  ✗ 让 LLM 修改 current_level

完成后:
  ✓ Syncro 真的【在算】,不是【在装】
  ✓ 可以告诉用户"基于奇门遁甲算法"= 真的
  ✓ 这是 pojulife 的【真正护城河】
```

**Cursor: 完成 Step 1-7 后,Syncro v5.1 计算引擎上线就绪。**
