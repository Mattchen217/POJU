# Oracle 动态交互实现 · 第 2 部分 · 卡片背面与正面组件

> **本系列共 4 份文档,这是第 2 份**
>
> 阅读顺序:
> - ✅ 第 1 部分:数据结构 + 抽签算法 + 类型定义
> - ▶ **第 2 部分(本文):5 套卡片正面布局组件 + 卡片背面 PNG 组件**
> - ⏳ 第 3 部分:翻转 + 抽签序列 + RAG 调用
> - ⏳ 第 4 部分:Oracle 主介绍页文案更新 + 测试页面 + Cursor 步骤化指令

---

## 一、卡片背面组件(显示用户做好的 PNG)

非常简单——只是一个 Image 组件。但需要做几件事:
- 确保 9:16 比例
- 加微妙的浮现动画(从下方 + 透明度淡入)
- 应用对应等级的边框/阴影

### 文件:`src/components/oracle/glyph-back/GlyphBackImage.tsx`

```tsx
'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { LEVEL_META, type GlyphLevel } from '@/types/oracle';

interface GlyphBackImageProps {
  /** 等级 - 决定显示哪张 PNG */
  level: GlyphLevel;
  /** 是否启用浮现动画(默认 true) */
  animate?: boolean;
  /** 动画完成回调 */
  onAnimationComplete?: () => void;
}

/**
 * 卡片背面图像组件
 * 显示对应等级的精美 PNG 卡片背面
 */
export function GlyphBackImage({ 
  level, 
  animate = true,
  onAnimationComplete,
}: GlyphBackImageProps) {
  const meta = LEVEL_META[level];
  
  return (
    <motion.div
      className={`
        relative aspect-[9/16] w-full
        rounded-[24px] overflow-hidden
        bg-black
      `}
      style={{
        boxShadow: `0 0 40px ${meta.shadow_color}`,
      }}
      initial={animate ? { opacity: 0, y: 80, scale: 0.9 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 1.8,
        ease: [0.22, 1, 0.36, 1], // ease-ornate
      }}
      onAnimationComplete={onAnimationComplete}
    >
      <Image
        src={`/oracle/wind-cards/${meta.back_image_filename}`}
        alt={`${meta.display_name} card back`}
        fill
        sizes="(max-width: 768px) 100vw, 400px"
        priority
        className="object-cover"
      />
      
      {/* 微妙的玻璃边框叠加 */}
      <div 
        className={`
          absolute inset-0 pointer-events-none rounded-[24px]
          border-[1.5px] ${meta.border_class}
        `}
      />
    </motion.div>
  );
}
```

### 使用示例

```tsx
<GlyphBackImage 
  level="divine_tailwind"
  onAnimationComplete={() => console.log('Card revealed')}
/>
```

---

## 二、卡片正面 - 统一布局组件

5 套卡片正面**共用一个组件**,通过 `level` prop 和 `LEVEL_META` 配置自动应用对应的颜色和符号。

### 设计目标

- 统一的布局结构(顶部符号 → 等级名 → 签号 → 签诗 → 签语 → 装饰 → 水印)
- 不同等级有不同的色调
- Eye of Storm 用 ◉ 单符号(不是星号)
- Divine Tailwind 有金色装饰强调
- **没有"好坏"区别对待**(按用户要求)

### 文件:`src/components/oracle/glyph-front/GlyphFront.tsx`

```tsx
'use client';

import { motion } from 'framer-motion';
import { LEVEL_META, type SignData } from '@/types/oracle';

interface GlyphFrontProps {
  /** 抽到的签数据 */
  sign: SignData;
  /** 是否启用淡入动画(默认 true) */
  animate?: boolean;
}

/**
 * 卡片正面组件
 * 5 个等级共用此组件,通过 LEVEL_META 配置自动差异化
 */
export function GlyphFront({ sign, animate = true }: GlyphFrontProps) {
  const meta = LEVEL_META[sign.level];
  
  return (
    <motion.div
      className="
        relative aspect-[9/16] w-full
        rounded-[24px] overflow-hidden
        bg-gradient-to-b from-[#1A0F2E] to-[#0B0815]
      "
      style={{
        boxShadow: `0 0 40px ${meta.shadow_color}`,
      }}
      initial={animate ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ 
        duration: 0.5,
        ease: 'easeOut',
      }}
    >
      {/* 等级特定的背景光晕(微妙) */}
      <BackgroundAura level={sign.level} />
      
      {/* 内容容器 - 整体 padding,使用 flex 垂直分布 */}
      <div className="relative z-10 h-full flex flex-col justify-between px-[8%] py-[10%]">
        
        {/* 顶部区:等级符号 + 等级名 + 签号 */}
        <motion.div
          className="text-center"
          initial={animate ? { opacity: 0, y: -10 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {/* 等级符号 */}
          <div 
            className="text-2xl tracking-[0.3em] mb-3"
            style={{ color: meta.primary_color }}
          >
            {meta.top_symbol}
          </div>
          
          {/* 等级名(英文,EB Garamond) */}
          <h2 
            className="font-serif text-3xl md:text-4xl mb-1 tracking-wide"
            style={{ 
              color: meta.primary_color,
              fontFamily: 'EB Garamond, serif',
            }}
          >
            {meta.display_name}
          </h2>
          
          {/* 副标题 */}
          <p 
            className="text-sm md:text-base italic opacity-70 mb-4"
            style={{ color: meta.accent_color }}
          >
            {meta.subtitle}
          </p>
          
          {/* 签号 */}
          <div className="text-xs md:text-sm tracking-[0.2em] text-white/50">
            GLYPH No. {String(sign.sign_number).padStart(3, '0')}
          </div>
        </motion.div>
        
        {/* 中部区:4 行签诗 */}
        <motion.div
          className="text-center my-6"
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          {/* 上分隔线 */}
          <div 
            className="mx-auto w-12 h-[1px] mb-6"
            style={{ backgroundColor: meta.accent_color, opacity: 0.4 }}
          />
          
          {/* 4 行签诗 */}
          <div 
            className="space-y-2 font-serif italic"
            style={{ 
              color: meta.accent_color,
              fontFamily: 'EB Garamond, serif',
            }}
          >
            {sign.verse_lines_en.map((line, idx) => (
              <motion.p 
                key={idx}
                className="text-base md:text-lg leading-relaxed"
                initial={animate ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={{ 
                  duration: 0.4, 
                  delay: 0.7 + idx * 0.1 
                }}
              >
                {line}
              </motion.p>
            ))}
          </div>
          
          {/* 下分隔线 */}
          <div 
            className="mx-auto w-12 h-[1px] mt-6"
            style={{ backgroundColor: meta.accent_color, opacity: 0.4 }}
          />
        </motion.div>
        
        {/* 签语区 */}
        <motion.div
          className="text-center px-2"
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.2 }}
        >
          <p 
            className="text-sm md:text-base italic leading-relaxed"
            style={{ color: '#E5E5E5' }}
          >
            "{sign.summary_line_en}"
          </p>
        </motion.div>
        
        {/* 底部区:等级特色装饰 + 水印 */}
        <motion.div
          className="text-center"
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.5 }}
        >
          {/* 等级特色装饰符号 */}
          <LevelDecoration level={sign.level} />
          
          {/* 水印 */}
          <p className="text-xs tracking-[0.3em] text-white/30 mt-3">
            easternos.com
          </p>
        </motion.div>
      </div>
      
      {/* 玻璃边框 */}
      <div 
        className={`
          absolute inset-0 pointer-events-none rounded-[24px]
          border-[1.5px] ${meta.border_class}
          shadow-[inset_0_0_30px_rgba(139,92,246,0.05)]
        `}
      />
    </motion.div>
  );
}

/**
 * 背景光晕 - 根据等级显示不同的微妙光效
 */
function BackgroundAura({ level }: { level: SignData['level'] }) {
  const meta = LEVEL_META[level];
  
  // 不同等级的光晕位置
  const positions: Record<typeof level, string> = {
    divine_tailwind: 'bg-gradient-radial from-yellow-500/15 via-transparent to-transparent at-top',
    fair_sky:        'bg-gradient-radial from-purple-400/12 via-transparent to-transparent at-top-left',
    still_water:     'bg-gradient-radial from-indigo-500/10 via-transparent to-transparent at-center',
    crosswind:       'bg-gradient-radial from-purple-600/12 via-transparent to-transparent at-right',
    eye_of_storm:    'bg-gradient-radial from-yellow-500/15 via-transparent to-transparent at-center',
  };
  
  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{
        background: getAuraGradient(level),
      }}
    />
  );
}

/**
 * 计算光晕 CSS gradient
 */
function getAuraGradient(level: SignData['level']): string {
  const positions: Record<typeof level, string> = {
    divine_tailwind: 'radial-gradient(ellipse at 50% 25%, rgba(255, 215, 0, 0.12), transparent 60%)',
    fair_sky:        'radial-gradient(ellipse at 30% 30%, rgba(167, 139, 250, 0.10), transparent 60%)',
    still_water:     'radial-gradient(ellipse at 50% 50%, rgba(99, 102, 241, 0.08), transparent 60%)',
    crosswind:       'radial-gradient(ellipse at 70% 50%, rgba(124, 58, 237, 0.10), transparent 60%)',
    eye_of_storm:    'radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.12), transparent 50%)',
  };
  
  return positions[level];
}

/**
 * 等级特色装饰符号
 */
function LevelDecoration({ level }: { level: SignData['level'] }) {
  const meta = LEVEL_META[level];
  
  // 5 个等级各自的装饰符号
  const decorations: Record<typeof level, JSX.Element> = {
    divine_tailwind: (
      <div className="flex items-center justify-center gap-2">
        <span style={{ color: meta.primary_color, opacity: 0.6 }}>❀</span>
        <span style={{ color: meta.primary_color, opacity: 0.4 }}>·</span>
        <span style={{ color: meta.primary_color, opacity: 0.6 }}>❀</span>
      </div>
    ),
    fair_sky: (
      <div className="flex items-center justify-center gap-2">
        <span style={{ color: meta.primary_color, opacity: 0.6 }}>▲</span>
        <span style={{ color: meta.primary_color, opacity: 0.4 }}>·</span>
        <span style={{ color: meta.primary_color, opacity: 0.6 }}>▲</span>
      </div>
    ),
    still_water: (
      <div className="flex items-center justify-center gap-2">
        <span style={{ color: meta.primary_color, opacity: 0.6 }}>◯</span>
        <span style={{ color: meta.primary_color, opacity: 0.4 }}>·</span>
        <span style={{ color: meta.primary_color, opacity: 0.6 }}>◯</span>
      </div>
    ),
    crosswind: (
      <div className="flex items-center justify-center gap-2">
        <span style={{ color: meta.primary_color, opacity: 0.6 }}>✕</span>
        <span style={{ color: meta.primary_color, opacity: 0.4 }}>·</span>
        <span style={{ color: meta.primary_color, opacity: 0.6 }}>✕</span>
      </div>
    ),
    eye_of_storm: (
      <div className="flex items-center justify-center gap-2">
        <span style={{ color: meta.primary_color, opacity: 0.7 }}>◉</span>
      </div>
    ),
  };
  
  return decorations[level];
}
```

---

## 三、字体配置

### 文件:`src/app/layout.tsx`(更新 fonts 部分)

```tsx
import { EB_Garamond, Inter } from 'next/font/google';

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  variable: '--font-eb-garamond',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export default function RootLayout({ children }) {
  return (
    <html className={`${ebGaramond.variable} ${inter.variable}`}>
      <body className="font-sans">
        {children}
      </body>
    </html>
  );
}
```

### 文件:`tailwind.config.ts`(更新 fontFamily)

```typescript
const config = {
  // ... 其他配置
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-eb-garamond)', 'Georgia', 'serif'],
      },
    },
  },
};
```

---

## 四、关于"按用户要求,5 张统一不加副文字"的说明

### 用户的明确要求

> "既然没好坏，就不区别对待"

按此要求,**5 个等级的卡片正面结构完全统一**,不为 Eye of Storm 或 Crosswind 添加额外的"安抚副文字"。

### 这是怎么落实的

```
✅ 所有 5 套都用同一个 GlyphFront 组件
✅ 区别仅在颜色/符号/装饰(LEVEL_META 配置)
✅ Eye of Storm 没有特殊的"The eye is the calm" 那段
   (这段只在 LLM 生成的完整解读报告里出现,不在卡片正面)
✅ Crosswind 没有"This is not a sign to push harder"
   (同样只在完整解读报告里出现)
```

### 为什么这样做正确

```
品牌承诺:"There are no good glyphs and no bad glyphs"

如果 Eye of Storm 卡片正面有特殊安抚文字,
就暗示了"这张签需要安抚",
等于变相承认了"这张签不好"。

统一对待 = 真的把"无好坏"做成产品行为,
而不只是说说。
```

---

## 五、视觉示例(供 Cursor 参考)

5 张卡片正面统一渲染样式:

### Divine Tailwind 正面

```
┌────────────────────────────────────────┐
│                                        │
│                                        │
│        ✦ ✦ ✦ ✦ ✦   (金色)              │
│                                        │
│       Divine Tailwind  (大字 EB Garamond)│
│         Sign of Grace  (italic)         │
│                                        │
│         GLYPH No. 001   (灰色)         │
│                                        │
│              ────                      │
│                                        │
│       The First Dawn,                  │
│       a destiny aligned,    (italic)   │
│       The stars and the                 │
│       hour are perfectly timed.         │
│       This vision you hold              │
│       is no small decree:               │
│       Walk with your truth,             │
│       and the world calls for thee.    │
│                                        │
│              ────                      │
│                                        │
│       "A universe is being born         │
│        from your choices..."            │
│                                        │
│                                        │
│                                        │
│            ❀  ·  ❀                    │
│                                        │
│           easternos.com                 │
│                                        │
└────────────────────────────────────────┘
背景:深紫底 + 顶部金色光晕
```

### Eye of Storm 正面

```
┌────────────────────────────────────────┐
│                                        │
│                                        │
│              ◉           (金色)         │
│                                        │
│        Eye of Storm    (大字)           │
│   Sign of the Still Center  (italic)    │
│                                        │
│         GLYPH No. 003   (灰色)         │
│                                        │
│              ────                      │
│                                        │
│         [4 行英文签诗]                  │
│                                        │
│              ────                      │
│                                        │
│         "[英文签语]"                    │
│                                        │
│                                        │
│              ◉                         │
│                                        │
│           easternos.com                 │
│                                        │
└────────────────────────────────────────┘
背景:深紫底 + 中心金色光晕
```

注意:Eye of Storm 正面**没有任何额外安抚文字**,与其他 4 张完全统一结构。

---

## 六、组件预览测试

为了让 Cursor 能验证 5 张正面是否正确渲染,创建一个 dev-only 预览页面。

### 文件:`src/app/(dev)/oracle-fronts-preview/page.tsx`

```tsx
'use client';

import { GlyphFront } from '@/components/oracle/glyph-front/GlyphFront';
import { GlyphBackImage } from '@/components/oracle/glyph-back/GlyphBackImage';
import type { SignData, GlyphLevel } from '@/types/oracle';

// 5 个 Mock 签 - 用于开发预览
const MOCK_SIGNS: SignData[] = [
  {
    sign_number: 1,
    level: 'divine_tailwind',
    verse_lines_en: [
      'The First Dawn, a destiny aligned,',
      'The stars and the hour are perfectly timed.',
      'This vision you hold is no small decree:',
      'Walk with your truth, and the world calls for thee.',
    ],
    summary_line_en: 'A universe is being born from your choices. The momentum of creation is behind you.',
    raw_md_content: '...',
  },
  {
    sign_number: 4,
    level: 'fair_sky',
    verse_lines_en: [
      'The clouds part for those who keep walking.',
      'Not every favor arrives with thunder.',
      "Today's quiet is also a kind of yes.",
      'Trust the lift you cannot fully see.',
    ],
    summary_line_en: 'Open sky rewards open hands. The way is clear—now walk it.',
    raw_md_content: '...',
  },
  {
    sign_number: 6,
    level: 'still_water',
    verse_lines_en: [
      'Beneath the surface, depth is forming.',
      'No ripple announces what is true now.',
      'Sit with what is. Do not chase.',
      'The answer is already on its way.',
    ],
    summary_line_en: 'Stillness is not waiting. It is the work itself, done quietly.',
    raw_md_content: '...',
  },
  {
    sign_number: 2,
    level: 'crosswind',
    verse_lines_en: [
      'The great whale bides its time within the stream,',
      'Too soon to soar, or chase the distant dream.',
      'Wait for the tide; let silent power grow,',
      'One day, the Gates will open—and you will know.',
    ],
    summary_line_en: 'True greatness is not rushed. The moment is coming, but it is not today.',
    raw_md_content: '...',
  },
  {
    sign_number: 3,
    level: 'eye_of_storm',
    verse_lines_en: [
      'Around you, the winds are loud and fast.',
      'But here, where you sit, all is quiet.',
      'Trust what you see from this still place.',
      'The eye holds the truth the storm cannot.',
    ],
    summary_line_en: 'Clarity lives in the one place nothing can reach. You are already there.',
    raw_md_content: '...',
  },
];

export default function OracleFrontsPreviewPage() {
  return (
    <div className="min-h-screen bg-black p-8">
      <h1 className="text-white text-2xl mb-8">
        Oracle Card Fronts & Backs Preview
      </h1>
      
      {/* 5 张正面 */}
      <section className="mb-12">
        <h2 className="text-white text-xl mb-4">Card Fronts (Mock Data)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {MOCK_SIGNS.map(sign => (
            <div key={sign.sign_number} className="space-y-2">
              <div className="text-white text-sm">
                #{sign.sign_number} - {sign.level}
              </div>
              <div className="w-full max-w-[280px]">
                <GlyphFront sign={sign} />
              </div>
            </div>
          ))}
        </div>
      </section>
      
      {/* 5 张背面 */}
      <section>
        <h2 className="text-white text-xl mb-4">Card Backs (PNG Images)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {(['divine_tailwind', 'fair_sky', 'still_water', 'crosswind', 'eye_of_storm'] as GlyphLevel[]).map(level => (
            <div key={level} className="space-y-2">
              <div className="text-white text-sm">{level}</div>
              <div className="w-full max-w-[280px]">
                <GlyphBackImage level={level} animate={false} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

访问 `http://localhost:3000/oracle-fronts-preview` 即可看到 10 张卡片(5 正面 + 5 背面)同时渲染。

---

## 七、自检清单

### 视觉自检(每张卡片正面都要过)

```
□ 9:16 比例正确?
□ 顶部等级符号居中?
   - Divine Tailwind: 5 颗金星
   - Fair Sky: 4 颗紫星
   - Still Water: 3 颗淡紫星
   - Crosswind: 2 颗深紫星
   - Eye of Storm: ◉ 金色单符号(不是星号!)
□ 等级名用 EB Garamond 衬线字体?
□ 副标题斜体?
□ 签号格式 "GLYPH No. 001"(三位数,前导零)?
□ 4 行签诗居中,EB Garamond Italic?
□ 上下分隔线对齐?
□ 签语带英文双引号?
□ 装饰符号在底部:
   - DT: ❀ · ❀
   - FS: ▲ · ▲
   - SW: ◯ · ◯
   - CW: ✕ · ✕
   - ES: ◉ (单个)
□ easternos.com 水印底部居中?
□ 边框颜色匹配等级 primary_color?
□ 背景光晕在正确位置(顶部/中心/侧边)?
```

### 功能自检

```
□ 5 套正面都用同一个 GlyphFront 组件?
□ 没有为某个等级写特殊版本?
□ Eye of Storm 没有"The eye is the calm" 副文字?
□ Crosswind 没有"This is not adversity" 副文字?
□ 所有等级正面结构完全统一?
□ 签号自动补零(1 → 001, 12 → 012)?
□ 4 行签诗每行单独动画进入(0.1s 间隔)?
```

### 代码自检

```
□ 所有 props 用 TypeScript 严格类型?
□ LEVEL_META 表正确导入?
□ 没有把 sign.raw_md_content 显示给用户?
□ Image 用 Next.js Image 组件(优化加载)?
□ 字体正确加载(EB Garamond + Inter)?
```

---

## 八、本文档完成状态

```
✅ 卡片背面组件(GlyphBackImage)
✅ 卡片正面统一组件(GlyphFront)
✅ 5 个等级的视觉差异化(LEVEL_META 驱动)
✅ 等级特色装饰符号
✅ 字体配置(EB Garamond + Inter)
✅ 预览页面
✅ 自检清单
```

**下一步**:阅读 `oracle-dynamic-implementation-part-3.md`,实现翻转 + 抽签序列 + RAG 调用。

---

✦
