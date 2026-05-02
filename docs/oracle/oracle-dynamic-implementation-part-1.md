# Oracle 动态交互实现 · 第 1 部分 · 数据与算法

> **本系列共 4 份文档,这是第 1 份**
>
> - 第 1 部分(本文):数据结构 + 抽签算法 + 类型定义
> - 第 2 部分:5 套卡片正面布局组件
> - 第 3 部分:翻转 + 抽签序列 + RAG 调用
> - 第 4 部分:Oracle 主介绍页文案更新 + 测试页面 + Cursor 步骤化指令

---

## 一、概述

实现 Oracle 抽签的完整动态交互流程:

```
用户进入功能视图 Stage 1 → Stage 2 输入 → Stage 3 Spline 粒子球
  ↓
Stage 4: 长按 3 秒 → Spline 内置爆炸 → Spline 消失
  ↓ React 端接管(本文档实现)
Stage 5: 抽签算法 → 决定签号 1-100 → 加载对应 PNG
Stage 6: 卡片背面浮现(淡入 + 上升)
        显示 [💾 Save] [⎋ Share] [👁 View Front]
        点击卡片或 View Front 按钮
Stage 7: 3D 翻转 800ms
Stage 8: 卡片正面整体淡入(无毛笔写入)
        显示英文签诗 + 签语 + 签号 + 等级名
        显示 [💾 Save] [⎋ Share] [📖 Full Reading]
Stage 9: 点 Full Reading
        缩略卡片到顶部 + 下方展开报告
        调用 LLM 生成完整解读
        底部引流钩子
        显示 [🔄 Ask Again] [✕ Close]
```

---

## 二、TypeScript 类型定义

### 文件:`src/types/oracle.ts`

```typescript
/**
 * Oracle 签的等级
 * 5 个等级,对应 5 张精美 PNG 背面
 */
export type GlyphLevel = 
  | 'divine_tailwind'   // 神风相送
  | 'fair_sky'          // 晴空可行
  | 'still_water'       // 止水沉深
  | 'crosswind'         // 逆风有意
  | 'eye_of_storm';     // 风暴中心

/**
 * 单签数据结构
 * 100 签的 JSON 数据中每个元素的格式
 */
export interface SignData {
  /** 签号,1-100 */
  sign_number: number;
  
  /** 等级 */
  level: GlyphLevel;
  
  /** 4 行英文签诗(显示在卡片正面) */
  verse_lines_en: string[];
  
  /** 1 句英文签语,即 summary line(显示在卡片正面) */
  summary_line_en: string;
  
  /** 完整 MD 内容(中英文混合,提供给 LLM 用于 RAG 解读) */
  raw_md_content: string;
  
  /** 中文等级标识,用于调试和日志(可选) */
  level_zh?: string;
  
  /** 典故故事人物(可选,用于 LLM 提示) */
  story_figure?: string;
}

/**
 * 用户输入的信息
 */
export interface UserInput {
  /** 出生年 */
  birthYear: number;
  /** 出生月 */
  birthMonth: number;
  /** 出生日 */
  birthDay: number;
  /** 出生时辰(12 时辰之一,如 'zi', 'chou' 等;'unknown' 表示不确定) */
  birthShichen: string;
  /** 用户问题(60 字符以内) */
  question: string;
}

/**
 * 抽签结果(传递给后续组件)
 */
export interface DrawResult {
  /** 抽到的签 */
  sign: SignData;
  /** 抽签时间戳 */
  drawnAt: number;
  /** 当时的用户输入 */
  userInput: UserInput;
}

/**
 * LLM 生成的完整解读报告
 */
export interface FullReading {
  /** 情境分析 */
  situation: string;
  /** 签的深层含义 */
  meaning: string;
  /** 智慧典故 */
  wisdom: string;
  /** 今日行动(数组,3 个) */
  actions: string[];
  /** 反思问题(数组,2 个) */
  reflections: string[];
  /** 何时回访 */
  revisit_timing: string;
}

/**
 * 等级元信息(用于卡片背面 PNG 路径、卡片正面颜色等)
 */
export interface LevelMeta {
  /** 等级 ID */
  level: GlyphLevel;
  /** 英文名(显示用) */
  display_name: string;
  /** 副标题 */
  subtitle: string;
  /** 顶部符号(SVG 字符) */
  top_symbol: string;
  /** 主色 hex */
  primary_color: string;
  /** 副色 hex */
  accent_color: string;
  /** 卡片背面 PNG 文件名 */
  back_image_filename: string;
  /** 边框 Tailwind class */
  border_class: string;
  /** 阴影色 */
  shadow_color: string;
}

/**
 * 5 个等级的元信息表
 */
export const LEVEL_META: Record<GlyphLevel, LevelMeta> = {
  divine_tailwind: {
    level: 'divine_tailwind',
    display_name: 'Divine Tailwind',
    subtitle: 'Sign of Grace',
    top_symbol: '✦ ✦ ✦ ✦ ✦',
    primary_color: '#FFD700',
    accent_color: '#F0ABFC',
    back_image_filename: 'divine-tailwind.png',
    border_class: 'border-yellow-400/40',
    shadow_color: 'rgba(255, 215, 0, 0.20)',
  },
  fair_sky: {
    level: 'fair_sky',
    display_name: 'Fair Sky',
    subtitle: 'Sign of Openness',
    top_symbol: '✦ ✦ ✦ ✦',
    primary_color: '#A78BFA',
    accent_color: '#C4B5FD',
    back_image_filename: 'fair-sky.png',
    border_class: 'border-purple-400/40',
    shadow_color: 'rgba(167, 139, 250, 0.20)',
  },
  still_water: {
    level: 'still_water',
    display_name: 'Still Water',
    subtitle: 'Sign of Stillness',
    top_symbol: '✦ ✦ ✦',
    primary_color: '#6366F1',
    accent_color: '#818CF8',
    back_image_filename: 'still-water.png',
    border_class: 'border-indigo-400/40',
    shadow_color: 'rgba(99, 102, 241, 0.18)',
  },
  crosswind: {
    level: 'crosswind',
    display_name: 'Crosswind',
    subtitle: 'Sign of Tension',
    top_symbol: '✦ ✦',
    primary_color: '#7C3AED',
    accent_color: '#A855F7',
    back_image_filename: 'crosswind.png',
    border_class: 'border-purple-500/40',
    shadow_color: 'rgba(124, 58, 237, 0.20)',
  },
  eye_of_storm: {
    level: 'eye_of_storm',
    display_name: 'Eye of Storm',
    subtitle: 'Sign of the Still Center',
    top_symbol: '◉',  // 唯一的非星号
    primary_color: '#FBBF24',  // 中心金色
    accent_color: '#3B0764',   // 外围深紫
    back_image_filename: 'eye-of-storm.png',
    border_class: 'border-purple-900/50',
    shadow_color: 'rgba(251, 191, 36, 0.15)',
  },
};
```

---

## 三、抽签算法

### 文件:`src/lib/oracle/drawSign.ts`

```typescript
import type { SignData, GlyphLevel, UserInput, DrawResult } from '@/types/oracle';

// 注意: signs.json 由用户的 MD 解析脚本生成
// 路径: public/oracle/data/signs.json
// 应包含 100 个 SignData 元素
import signsData from '@/../public/oracle/data/signs.json';

// 类型断言:确保 JSON 数据符合类型定义
const ALL_SIGNS: SignData[] = signsData as SignData[];

/**
 * 抽签 - 完全随机,每签机会均等
 * 模拟传统签筒摇晃掉出一根的物理过程
 * 
 * @returns 随机抽到的一签
 */
export function drawSign(): SignData {
  if (ALL_SIGNS.length === 0) {
    throw new Error('No signs data found. Make sure signs.json is generated.');
  }
  
  const totalSigns = ALL_SIGNS.length;  // 应该是 100
  const randomIndex = Math.floor(Math.random() * totalSigns);
  return ALL_SIGNS[randomIndex];
}

/**
 * 包装函数:抽签 + 时间戳 + 用户输入
 */
export function drawSignWithContext(userInput: UserInput): DrawResult {
  return {
    sign: drawSign(),
    drawnAt: Date.now(),
    userInput,
  };
}

// ──────────────────────────────────────────
// 测试用辅助函数(开发阶段用,产品中不使用)
// ──────────────────────────────────────────

/**
 * 测试用:强制抽某个等级的签
 * 用于开发时快速验证 5 张卡片视觉
 */
export function drawSignByLevel(level: GlyphLevel): SignData {
  const signsOfLevel = ALL_SIGNS.filter(s => s.level === level);
  if (signsOfLevel.length === 0) {
    throw new Error(`No signs found for level: ${level}. Check your signs.json data.`);
  }
  const randomIndex = Math.floor(Math.random() * signsOfLevel.length);
  return signsOfLevel[randomIndex];
}

/**
 * 测试用:强制抽指定签号
 */
export function drawSignByNumber(signNumber: number): SignData {
  const sign = ALL_SIGNS.find(s => s.sign_number === signNumber);
  if (!sign) {
    throw new Error(`Sign #${signNumber} not found in signs.json.`);
  }
  return sign;
}

/**
 * 工具函数:获取所有等级的签数统计
 * 用于调试,确认你的 100 签数据分布
 */
export function getLevelDistribution(): Record<GlyphLevel, number> {
  const distribution: Record<GlyphLevel, number> = {
    divine_tailwind: 0,
    fair_sky: 0,
    still_water: 0,
    crosswind: 0,
    eye_of_storm: 0,
  };
  
  ALL_SIGNS.forEach(sign => {
    distribution[sign.level]++;
  });
  
  return distribution;
}

/**
 * 工具函数:验证 signs.json 数据完整性
 * 在开发模式下应用启动时调用
 */
export function validateSignsData(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (ALL_SIGNS.length !== 100) {
    errors.push(`Expected 100 signs, found ${ALL_SIGNS.length}`);
  }
  
  // 检查签号是否 1-100 连续
  const signNumbers = ALL_SIGNS.map(s => s.sign_number).sort((a, b) => a - b);
  for (let i = 1; i <= 100; i++) {
    if (!signNumbers.includes(i)) {
      errors.push(`Missing sign number: ${i}`);
    }
  }
  
  // 检查每签的必需字段
  ALL_SIGNS.forEach(sign => {
    if (!sign.verse_lines_en || sign.verse_lines_en.length !== 4) {
      errors.push(`Sign ${sign.sign_number}: verse_lines_en must have 4 lines`);
    }
    if (!sign.summary_line_en) {
      errors.push(`Sign ${sign.sign_number}: missing summary_line_en`);
    }
    if (!sign.level || !['divine_tailwind', 'fair_sky', 'still_water', 'crosswind', 'eye_of_storm'].includes(sign.level)) {
      errors.push(`Sign ${sign.sign_number}: invalid level "${sign.level}"`);
    }
    if (!sign.raw_md_content) {
      errors.push(`Sign ${sign.sign_number}: missing raw_md_content (needed for LLM)`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
```

---

## 四、JSON 数据结构定义(给你的 MD 解析脚本)

你的 MD 解析脚本最终需要生成这样的 JSON:

### 文件:`public/oracle/data/signs.json`

```json
[
  {
    "sign_number": 1,
    "level": "divine_tailwind",
    "level_zh": "上上签",
    "story_figure": "钟离成道",
    "verse_lines_en": [
      "The First Dawn, a destiny aligned,",
      "The stars and the hour are perfectly timed.",
      "This vision you hold is no small decree:",
      "Walk with your truth, and the world calls for thee."
    ],
    "summary_line_en": "A universe is being born from your choices. The momentum of creation is behind you—everything is ready.",
    "raw_md_content": "1 观音灵签解签1钟离成道\n\n吉凶宫位: 上上签子宫 Divine Tailwind 001\n\n开天辟地作良缘...\n\n[完整 MD 内容,含中英文]"
  },
  {
    "sign_number": 2,
    "level": "crosswind",
    "level_zh": "中下签",
    "story_figure": "苏秦不第",
    "verse_lines_en": [
      "The great whale bides its time within the stream,",
      "Too soon to soar, or chase the distant dream.",
      "Wait for the tide; let silent power grow,",
      "One day, the Gates will open—and you will know."
    ],
    "summary_line_en": "True greatness is not rushed. Remain in your depth for now; the moment of transformation is coming, but it is not today.",
    "raw_md_content": "2 观音灵签解签2苏秦不第\n\n吉凶宫位: 中下签子宫 Crosswind 002\n\n鲸鱼未变守江河...\n\n[完整 MD 内容]"
  }
]
```

### 数据字段说明

| 字段 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `sign_number` | number | ✓ | 签号 1-100 |
| `level` | string | ✓ | 5 个等级值之一 |
| `level_zh` | string | ✗ | 中文等级(调试用) |
| `story_figure` | string | ✗ | 典故人物(调试用) |
| `verse_lines_en` | string[] | ✓ | 4 行英文签诗 |
| `summary_line_en` | string | ✓ | 1 句英文签语 |
| `raw_md_content` | string | ✓ | 完整 MD 内容,提供给 LLM |

### 等级映射规则

从你的 MD 数据看,中文等级 → 英文等级映射如下:

```
上上签 → divine_tailwind
上签   → divine_tailwind  (如果有)
上中签 → fair_sky
上吉签 → fair_sky          (如果有)
中签   → still_water
中吉签 → still_water        (如果有)
中下签 → crosswind
中平签 → crosswind          (如果有)
下签   → crosswind          (如果有,看具体内容)
下下签 → eye_of_storm
```

**MD 解析脚本要做的等级映射伪代码**:

```javascript
function mapLevel(zhLevel) {
  if (zhLevel.includes('上上')) return 'divine_tailwind';
  if (zhLevel.includes('上中') || zhLevel.includes('上吉') || zhLevel === '上签') return 'fair_sky';
  if (zhLevel === '中签' || zhLevel.includes('中吉')) return 'still_water';
  if (zhLevel.includes('中下') || zhLevel.includes('中平') || zhLevel === '下签') return 'crosswind';
  if (zhLevel.includes('下下')) return 'eye_of_storm';
  throw new Error(`Unknown level: ${zhLevel}`);
}
```

---

## 五、文件目录结构

完整的 Oracle 模块目录结构:

```
public/
└── oracle/
    ├── data/
    │   └── signs.json                    ← 100 签数据(由 MD 解析生成)
    └── wind-cards/
        ├── divine-tailwind.png           ← 你已做好
        ├── fair-sky.png                  ← 你已做好
        ├── still-water.png               ← 你已做好
        ├── crosswind.png                 ← 你已做好
        └── eye-of-storm.png              ← 你已做好

src/
├── types/
│   └── oracle.ts                         ← 本文档第二节
│
├── lib/
│   └── oracle/
│       ├── drawSign.ts                   ← 本文档第三节
│       └── api.ts                        ← 第 3 部分文档
│
├── components/
│   └── oracle/
│       ├── glyph-back/
│       │   └── GlyphBackImage.tsx        ← 第 2 部分文档
│       │
│       ├── glyph-front/
│       │   ├── GlyphFront.tsx            ← 第 2 部分文档(统一组件)
│       │   ├── EyeOfStormDecor.tsx       ← 第 2 部分文档(此级特殊装饰)
│       │   └── DivineTailwindDecor.tsx   ← 第 2 部分文档(金色装饰)
│       │
│       ├── GlyphCard.tsx                 ← 第 3 部分文档(翻转容器)
│       ├── DrawSequence.tsx              ← 第 3 部分文档(序列控制)
│       ├── FullReading.tsx               ← 第 3 部分文档(完整解读)
│       └── OracleFlow.tsx                ← 第 3 部分文档(主流程)
│
└── app/
    └── (oracle)/
        ├── oracle/
        │   └── page.tsx                  ← 第 4 部分文档(主入口)
        └── (dev)/
            └── oracle-test/
                └── page.tsx              ← 第 4 部分文档(测试页面)
```

---

## 六、强制要求(给 Cursor)

```
🚫 不要重新设计抽签算法
   - drawSign() 必须是 1-100 均等随机
   - 不要按等级概率抽
   - 不要"优化"成"先按等级再按权重"

🚫 不要添加未在文档定义的字段
   - SignData 类型严格按定义
   - 用户后续可能添加,但 Cursor 不能擅自添加

🚫 不要"美化"5 张 PNG
   - PNG 是用户做的精美图,直接显示
   - 不要在 PNG 上叠加任何额外效果(除非文档明确要求)

🚫 不要把 raw_md_content 显示给用户
   - 这是给 LLM 用的内部数据
   - 用户只看到 verse_lines_en + summary_line_en

✅ 严格按 LEVEL_META 配置渲染
✅ 用 TypeScript 类型严格约束
✅ 100 签数据加载时调用 validateSignsData() 检查完整性
✅ 在开发模式下,validation 失败要在 console 报错
```

---

## 七、本文档完成状态

```
✅ TypeScript 类型定义完成
✅ 抽签算法完成(均等随机)
✅ JSON 数据结构定义
✅ 等级映射规则
✅ 文件目录结构
✅ 强制要求(给 Cursor)
```

**下一步**: 阅读 `oracle-dynamic-implementation-part-2.md`,实现 5 套卡片正面布局组件。

---

✦
