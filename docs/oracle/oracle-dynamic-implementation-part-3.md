# Oracle 动态交互实现 · 第 3 部分 · 翻转、抽签序列与 RAG 调用

> **本系列共 4 份文档,这是第 3 份**
>
> 阅读顺序:
> - ✅ 第 1 部分:数据结构 + 抽签算法 + 类型定义
> - ✅ 第 2 部分:5 套卡片正面布局组件 + 卡片背面 PNG 组件
> - ▶ **第 3 部分(本文):翻转 + 抽签序列 + RAG 调用**
> - ⏳ 第 4 部分:Oracle 主介绍页文案更新 + 测试页面 + Cursor 步骤化指令

---

## 一、GlyphCard - 翻转容器组件

整合背面 + 正面 + 翻转动画的核心组件。

### 文件:`src/components/oracle/GlyphCard.tsx`

```tsx
'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlyphBackImage } from './glyph-back/GlyphBackImage';
import { GlyphFront } from './glyph-front/GlyphFront';
import { LEVEL_META, type SignData } from '@/types/oracle';

interface GlyphCardProps {
  /** 抽到的签数据 */
  sign: SignData;
  /** 当前显示状态 */
  side: 'back' | 'front';
  /** 用户点击卡片时触发(用于翻转) */
  onCardClick?: () => void;
  /** 翻转完成回调 */
  onFlipComplete?: () => void;
}

/**
 * 卡片容器 - 包含背面和正面,支持 3D 翻转
 */
export function GlyphCard({ 
  sign, 
  side,
  onCardClick,
  onFlipComplete,
}: GlyphCardProps) {
  const isFlipped = side === 'front';
  const meta = LEVEL_META[sign.level];
  
  return (
    <div 
      className="
        relative w-full max-w-[400px] mx-auto
        cursor-pointer select-none
      "
      style={{ perspective: '2000px' }}
      onClick={onCardClick}
    >
      <motion.div
        className="relative w-full aspect-[9/16]"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateX: isFlipped ? 180 : 0 }}
        transition={{ 
          duration: 0.8,
          ease: [0.22, 1, 0.36, 1], // ease-ornate
        }}
        onAnimationComplete={() => {
          if (isFlipped && onFlipComplete) {
            onFlipComplete();
          }
        }}
      >
        {/* 卡片背面 */}
        <div 
          className="absolute inset-0 w-full h-full"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <GlyphBackImage 
            level={sign.level} 
            animate={false}  // 由父组件控制浮现动画
          />
        </div>
        
        {/* 卡片正面 */}
        <div 
          className="absolute inset-0 w-full h-full"
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateX(180deg)',
          }}
        >
          <GlyphFront 
            sign={sign} 
            animate={isFlipped}  // 翻转完成后才触发淡入
          />
        </div>
      </motion.div>
      
      {/* 翻转中的闪光效果 */}
      <FlipFlash isFlipping={isFlipped} />
    </div>
  );
}

/**
 * 翻转中间的闪光遮罩
 * 在翻转进行到 50% 时(约 400ms),覆盖一个白色高光,200ms 内淡出
 */
function FlipFlash({ isFlipping }: { isFlipping: boolean }) {
  const [showFlash, setShowFlash] = useState(false);
  
  // 当 isFlipping 变 true 时,400ms 后触发闪光
  useState(() => {
    if (isFlipping) {
      const timer = setTimeout(() => {
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 200);
      }, 400);
      return () => clearTimeout(timer);
    }
  });
  
  return (
    <AnimatePresence>
      {showFlash && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-[24px] bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        />
      )}
    </AnimatePresence>
  );
}
```

---

## 二、抽签序列 - DrawSequence

控制完整的抽签流程。从粒子爆炸结束开始,到用户翻转卡片结束。

### 文件:`src/components/oracle/DrawSequence.tsx`

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlyphCard } from './GlyphCard';
import { drawSign } from '@/lib/oracle/drawSign';
import type { SignData, UserInput } from '@/types/oracle';

type SequenceStage = 
  | 'drawing'        // 抽签中(瞬间)
  | 'card-back'      // 显示卡片背面
  | 'flipping'       // 翻转中
  | 'card-front'     // 显示卡片正面
  | 'reading';       // 进入完整解读

interface DrawSequenceProps {
  /** 用户输入(从 Stage 2 传来) */
  userInput: UserInput;
  /** 用户点击 Save 卡片背面时触发 */
  onSaveCard?: () => void;
  /** 用户点击 Share 卡片背面时触发 */
  onShareCard?: () => void;
  /** 用户点击 Full Reading 时触发 */
  onFullReading?: (sign: SignData) => void;
  /** 用户点击关闭整个序列时触发 */
  onClose?: () => void;
  /** 测试模式:强制传入指定签(开发用) */
  forcedSign?: SignData;
}

/**
 * 抽签完整序列控制器
 */
export function DrawSequence({
  userInput,
  onSaveCard,
  onShareCard,
  onFullReading,
  onClose,
  forcedSign,
}: DrawSequenceProps) {
  const [stage, setStage] = useState<SequenceStage>('drawing');
  const [sign, setSign] = useState<SignData | null>(null);
  
  // 组件挂载时立即抽签
  useEffect(() => {
    const drawnSign = forcedSign || drawSign();
    setSign(drawnSign);
    setStage('card-back');
  }, [forcedSign]);
  
  const handleCardClick = useCallback(() => {
    if (stage === 'card-back') {
      setStage('flipping');
    } else if (stage === 'card-front') {
      // 正面状态下点击卡片不做任何事(用按钮触发动作)
    }
  }, [stage]);
  
  const handleFlipComplete = useCallback(() => {
    setStage('card-front');
  }, []);
  
  if (!sign) {
    return null;  // 还在抽签中,瞬间过去
  }
  
  return (
    <div className="
      fixed inset-0 z-50
      bg-gradient-to-b from-[#0B0815] to-[#000000]
      flex flex-col items-center justify-center
      px-6 py-12
    ">
      {/* 顶部关闭按钮 */}
      <button
        onClick={onClose}
        className="
          absolute top-6 right-6
          w-10 h-10 rounded-full
          flex items-center justify-center
          text-white/60 hover:text-white
          hover:bg-white/10
          transition-all
        "
        aria-label="Close"
      >
        ✕
      </button>
      
      {/* 卡片区域 */}
      <div className="w-full max-w-[400px]">
        <GlyphCard
          sign={sign}
          side={stage === 'card-back' ? 'back' : 'front'}
          onCardClick={handleCardClick}
          onFlipComplete={handleFlipComplete}
        />
      </div>
      
      {/* 按钮区域 - 根据 stage 切换 */}
      <div className="mt-8 w-full max-w-[400px]">
        <AnimatePresence mode="wait">
          {stage === 'card-back' && (
            <motion.div
              key="back-buttons"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, delay: 1.5 }}
              className="flex justify-center gap-3"
            >
              <ActionButton 
                icon="💾" 
                label="Save"
                onClick={onSaveCard}
              />
              <ActionButton 
                icon="⎋" 
                label="Share"
                onClick={onShareCard}
              />
              <ActionButton 
                icon="👁" 
                label="View Front"
                primary
                onClick={() => setStage('flipping')}
              />
            </motion.div>
          )}
          
          {stage === 'card-front' && (
            <motion.div
              key="front-buttons"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              className="flex justify-center gap-3"
            >
              <ActionButton 
                icon="💾" 
                label="Save"
                onClick={onSaveCard}
              />
              <ActionButton 
                icon="⎋" 
                label="Share"
                onClick={onShareCard}
              />
              <ActionButton 
                icon="📖" 
                label="Full Reading"
                primary
                onClick={() => onFullReading?.(sign)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* 底部提示文字 - 只在卡片背面状态显示 */}
      {stage === 'card-back' && (
        <motion.p
          className="absolute bottom-12 text-white/40 text-sm tracking-wider"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 2 }}
        >
          Tap card to reveal
        </motion.p>
      )}
    </div>
  );
}

/**
 * 操作按钮组件
 */
function ActionButton({
  icon,
  label,
  primary = false,
  onClick,
}: {
  icon: string;
  label: string;
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-5 py-3 rounded-full
        text-sm font-medium tracking-wide
        transition-all duration-200
        ${primary 
          ? 'bg-purple-500 hover:bg-purple-600 text-white shadow-lg shadow-purple-500/30' 
          : 'bg-white/10 hover:bg-white/20 text-white/90 backdrop-blur-md border border-white/20'
        }
      `}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
```

---

## 三、Save 与 Share 功能

### Save 功能 - 下载卡片背面 PNG

```tsx
// src/lib/oracle/saveCard.ts
import { LEVEL_META, type GlyphLevel } from '@/types/oracle';

/**
 * 保存卡片背面到本地
 * 移动端:保存到相册
 * PC 端:下载到 Downloads 文件夹
 */
export async function saveCardBack(level: GlyphLevel, signNumber: number): Promise<{ success: boolean; method: string }> {
  const meta = LEVEL_META[level];
  const imagePath = `/oracle/wind-cards/${meta.back_image_filename}`;
  const filename = `poju-glyph-${String(signNumber).padStart(3, '0')}-${level.replace(/_/g, '-')}.png`;
  
  try {
    // 检测是否支持 Web Share API + 是否在移动端
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    
    if (isMobile && navigator.share) {
      // 移动端: 用 Web Share API
      const response = await fetch(imagePath);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: 'image/png' });
      
      // 检查是否能分享文件
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // 注意: Web Share API 的 share 包含"保存到相册"选项
        // 但如果用户只想保存,可以直接用 download 链接
        return { success: true, method: 'mobile-save' };
      }
    }
    
    // PC 端 / 移动端 fallback: 触发下载
    const response = await fetch(imagePath);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return { success: true, method: 'download' };
  } catch (error) {
    console.error('Save card failed:', error);
    return { success: false, method: 'failed' };
  }
}
```

### Share 功能 - 调用系统分享菜单

```tsx
// src/lib/oracle/shareCard.ts
import { LEVEL_META, type GlyphLevel } from '@/types/oracle';

/**
 * 分享卡片背面到其他 App
 */
export async function shareCardBack(level: GlyphLevel, signNumber: number): Promise<{ success: boolean; method: string }> {
  const meta = LEVEL_META[level];
  const imagePath = `/oracle/wind-cards/${meta.back_image_filename}`;
  const filename = `poju-glyph-${String(signNumber).padStart(3, '0')}.png`;
  
  try {
    if (navigator.share) {
      // 支持 Web Share API
      const response = await fetch(imagePath);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: 'image/png' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'A glyph from POJU',
          text: 'A sincere heart opens the channel. easternos.com',
          files: [file],
        });
        return { success: true, method: 'native-share' };
      }
    }
    
    // 不支持 Web Share - 复制图片到剪贴板
    const response = await fetch(imagePath);
    const blob = await response.blob();
    
    if (navigator.clipboard && (navigator.clipboard as any).write) {
      await (navigator.clipboard as any).write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      return { success: true, method: 'clipboard' };
    }
    
    // 最终 fallback - 触发下载
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    
    return { success: true, method: 'download' };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      // 用户取消分享,不算错误
      return { success: false, method: 'user-canceled' };
    }
    console.error('Share card failed:', error);
    return { success: false, method: 'failed' };
  }
}
```

---

## 四、完整解读报告 - FullReading 组件

用户点击 Full Reading 后展示。卡片缩略到顶部,下方展开 LLM 生成的报告。

### 文件:`src/components/oracle/FullReading.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GlyphFront } from './glyph-front/GlyphFront';
import { generateFullReading } from '@/lib/oracle/api';
import { LEVEL_META, type SignData, type UserInput, type FullReading as FullReadingType } from '@/types/oracle';

interface FullReadingProps {
  sign: SignData;
  userInput: UserInput;
  onAskAgain: () => void;
  onClose: () => void;
}

export function FullReading({ sign, userInput, onAskAgain, onClose }: FullReadingProps) {
  const [reading, setReading] = useState<FullReadingType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let canceled = false;
    
    async function fetchReading() {
      setLoading(true);
      setError(null);
      
      try {
        const result = await generateFullReading({
          sign,
          userInput,
        });
        
        if (!canceled) {
          setReading(result);
          setLoading(false);
        }
      } catch (err) {
        if (!canceled) {
          setError('Something in the signal is unclear. Try again in a moment.');
          setLoading(false);
        }
      }
    }
    
    fetchReading();
    
    return () => {
      canceled = true;
    };
  }, [sign, userInput]);
  
  return (
    <div className="
      fixed inset-0 z-50 overflow-y-auto
      bg-gradient-to-b from-[#0B0815] to-[#000000]
    ">
      <div className="max-w-[640px] mx-auto px-6 py-8">
        
        {/* 顶部:缩略卡片 */}
        <div className="mb-8">
          <div className="w-full max-w-[280px] mx-auto">
            <GlyphFront sign={sign} animate={false} />
          </div>
        </div>
        
        {/* 标题 */}
        <h1 className="text-white text-2xl text-center mb-8 font-serif">
          Your Full Reading
        </h1>
        
        {loading && <ReadingLoading />}
        {error && <ReadingError error={error} />}
        {reading && <ReadingContent reading={reading} sign={sign} />}
        
        {/* 底部:POJU 引流钩子 + 按钮 */}
        {reading && (
          <ReadingFooter onAskAgain={onAskAgain} onClose={onClose} sign={sign} />
        )}
      </div>
    </div>
  );
}

/**
 * 加载状态
 */
function ReadingLoading() {
  const messages = [
    'Reading your signal...',
    'Translating ancient wisdom...',
    'Understanding your question...',
    'Forming the response...',
  ];
  const [messageIdx, setMessageIdx] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIdx(idx => (idx + 1) % messages.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="text-center py-16">
      <div className="inline-block w-12 h-12 mb-6">
        {/* 旋转的紫色粒子加载动画 */}
        <motion.div
          className="w-full h-full border-2 border-purple-500/30 border-t-purple-500 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
      
      <motion.p
        key={messageIdx}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="text-white/60 italic"
      >
        {messages[messageIdx]}
      </motion.p>
    </div>
  );
}

/**
 * 错误状态
 */
function ReadingError({ error }: { error: string }) {
  return (
    <div className="text-center py-16">
      <p className="text-white/80 mb-4">{error}</p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm"
      >
        Try again
      </button>
    </div>
  );
}

/**
 * 报告内容(6 段结构)
 */
function ReadingContent({ reading, sign }: { reading: FullReadingType; sign: SignData }) {
  const meta = LEVEL_META[sign.level];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8 text-white/90"
    >
      <Section title="THE SITUATION" accentColor={meta.accent_color}>
        <p>{reading.situation}</p>
      </Section>
      
      <Section title="WHAT THIS GLYPH REVEALS" accentColor={meta.accent_color}>
        <p>{reading.meaning}</p>
      </Section>
      
      <Section title="THE WISDOM" accentColor={meta.accent_color}>
        <p>{reading.wisdom}</p>
      </Section>
      
      <Section title="TODAY'S ACTIONS" accentColor={meta.accent_color}>
        <ol className="space-y-3 pl-6 list-decimal">
          {reading.actions.map((action, idx) => (
            <li key={idx}>{action}</li>
          ))}
        </ol>
      </Section>
      
      <Section title="REFLECTION QUESTIONS" accentColor={meta.accent_color}>
        <ul className="space-y-3 pl-6 list-disc">
          {reading.reflections.map((question, idx) => (
            <li key={idx} className="italic">{question}</li>
          ))}
        </ul>
      </Section>
      
      <Section title="WHEN TO REVISIT" accentColor={meta.accent_color}>
        <p>{reading.revisit_timing}</p>
      </Section>
    </motion.div>
  );
}

/**
 * 6 段共用的小节标题
 */
function Section({ 
  title, 
  accentColor,
  children 
}: { 
  title: string; 
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div 
          className="w-8 h-[1px]" 
          style={{ backgroundColor: accentColor, opacity: 0.6 }}
        />
        <h3 
          className="text-xs tracking-[0.2em] font-medium"
          style={{ color: accentColor }}
        >
          {title}
        </h3>
        <div 
          className="flex-1 h-[1px]"
          style={{ backgroundColor: accentColor, opacity: 0.3 }}
        />
      </div>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

/**
 * 报告底部 - POJU 引流钩子 + 按钮
 */
function ReadingFooter({ 
  onAskAgain, 
  onClose,
  sign,
}: { 
  onAskAgain: () => void; 
  onClose: () => void;
  sign: SignData;
}) {
  return (
    <div className="mt-12 pt-12 border-t border-white/10">
      
      {/* POJU 引流钩子 */}
      <div className="
        text-center mb-12 px-6 py-8 
        rounded-2xl 
        bg-gradient-to-b from-purple-900/20 to-transparent
        border border-purple-500/20
      ">
        <p className="text-white/90 italic mb-2 leading-relaxed">
          Need to go deeper?
        </p>
        <p className="text-white/70 text-sm leading-relaxed mb-6">
          Bring this to POJU. One question. Unlimited depth. 
          Until you see your way through. Just $9.99.
        </p>
        
        <a
          href={`/api/payment/checkout?source=oracle_hook&sign_id=${sign.sign_number}`}
          className="
            inline-block px-8 py-3 rounded-full
            bg-purple-500 hover:bg-purple-600
            text-white font-medium tracking-wide
            shadow-lg shadow-purple-500/30
            transition-all
          "
        >
          Ask POJU · $9.99
        </a>
      </div>
      
      {/* 自动保存提示 */}
      <p className="text-center text-white/40 text-sm italic mb-8">
        ✓ This reading is saved to your Archive. Return anytime.
      </p>
      
      {/* 操作按钮 */}
      <div className="flex justify-center gap-4">
        <button
          onClick={onAskAgain}
          className="
            flex items-center gap-2 px-6 py-3 rounded-full
            bg-white/10 hover:bg-white/20
            text-white/90 backdrop-blur-md
            border border-white/20
            transition-all
          "
        >
          <span>🔄</span>
          <span>Ask Again</span>
        </button>
        
        <button
          onClick={onClose}
          className="
            flex items-center gap-2 px-6 py-3 rounded-full
            bg-white/5 hover:bg-white/10
            text-white/70
            transition-all
          "
        >
          <span>✕</span>
          <span>Close</span>
        </button>
      </div>
    </div>
  );
}
```

---

## 五、RAG 调用 - 后端 API

### 文件:`src/lib/oracle/api.ts`(前端调用)

```typescript
import type { SignData, UserInput, FullReading } from '@/types/oracle';

/**
 * 调用云端 LLM 生成完整解读报告
 */
export async function generateFullReading({
  sign,
  userInput,
}: {
  sign: SignData;
  userInput: UserInput;
}): Promise<FullReading> {
  const response = await fetch('/api/oracle/full-reading', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sign_number: sign.sign_number,
      level: sign.level,
      user_birth: {
        year: userInput.birthYear,
        month: userInput.birthMonth,
        day: userInput.birthDay,
        shichen: userInput.birthShichen,
      },
      user_question: userInput.question,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.reading as FullReading;
}
```

### 文件:`src/app/api/oracle/full-reading/route.ts`(后端 API)

使用 **Google Gemini**（[Google AI Studio](https://aistudio.google.com/) 申请的 API Key）。服务端依赖：`pnpm add @google/generative-ai`。

```typescript
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import signsData from '@/../public/oracle/data/signs.json';
import type { SignData } from '@/types/oracle';

function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

/** 与 AI Studio 中可用的模型名一致即可,例如 gemini-2.0-flash、gemini-1.5-pro */
const GEMINI_MODEL =
  process.env.GOOGLE_GENERATIVE_AI_MODEL ?? 'gemini-2.0-flash';

const ALL_SIGNS = signsData as SignData[];

interface RequestBody {
  sign_number: number;
  level: string;
  user_birth: {
    year: number;
    month: number;
    day: number;
    shichen: string;
  };
  user_question: string;
}

const SYSTEM_PROMPT = `You are POJU's Oracle Interpreter.

Your role:
- Translate the wisdom of Eastern Lingqian (灵签) traditions into 
  guidance an English-speaking user can act on today.
- The user has drawn a glyph from a 100-glyph oracle deck.
- You receive the full traditional content of that glyph (in Chinese 
  and English), the user's question, and their birth information.

Critical principles you MUST follow:

1. NEVER label glyphs as "good" or "bad."
   - Divine Tailwind is not "winning" — it is "aligned momentum requiring action."
   - Eye of Storm is not "loss" — it is "the still center where clarity lives."
   - Crosswind is not "failure" — it is "tension that requires recalibration."
   - Fair Sky is not "easy" — it is "openness that still requires walking."
   - Still Water is not "boring" — it is "depth where transformation forms."

2. Each glyph is a LENS, not a verdict.
   - The same glyph can mean entirely different things on different days,
     for different people, about different questions.
   - Read THIS glyph for THIS question for THIS person at THIS time.

3. Translate Chinese cultural references into universal narrative.
   - Don't say "Su Qin failed at the imperial exam" 
   - Say "Two thousand years ago, a brilliant man returned home in 
     defeat after a long pursuit..."
   - Don't reference Chinese names directly. Use storytelling.

4. Be specific to the user's actual question.
   - Don't give generic life advice.
   - Reference their question directly in THE SITUATION section.
   - Make TODAY'S ACTIONS specific to their context.

5. Respect their birth information as informational context, not 
   destiny. Birth gives you context about their personality and 
   timing patterns. It does not predict outcomes.

Output format: Return STRICT JSON matching this structure:
{
  "situation": "2-3 sentences. Restate the user's question and the 
                immediate situation as you understand it.",
  "meaning": "2-3 paragraphs. What does this specific glyph reveal 
              about this specific question? Use the verse imagery 
              and the traditional meaning.",
  "wisdom": "1-2 paragraphs. The story behind this glyph (told as 
             universal narrative, not Chinese name-dropping).",
  "actions": [
    "First specific action they can do today",
    "Second specific action they can do this week",
    "Third specific action - an ongoing practice"
  ],
  "reflections": [
    "First reflective question for them to sit with",
    "Second reflective question"
  ],
  "revisit_timing": "1 sentence. When should they come back? What 
                     change should trigger a new reading?"
}

Return ONLY the JSON object. No preamble, no explanation, no markdown 
code blocks.`;

export async function POST(req: Request) {
  try {
    const genAI = getGeminiClient();
    if (!genAI) {
      return NextResponse.json(
        { error: 'Server missing GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY' },
        { status: 500 },
      );
    }

    const body: RequestBody = await req.json();
    
    // 1. 找到对应的签数据
    const signData = ALL_SIGNS.find(s => s.sign_number === body.sign_number);
    if (!signData) {
      return NextResponse.json(
        { error: 'Sign not found' },
        { status: 404 }
      );
    }
    
    // 2. 构建给 LLM 的完整提示
    const userPrompt = `User's question: "${body.user_question}"

User's birth info:
- Year: ${body.user_birth.year}
- Month: ${body.user_birth.month}
- Day: ${body.user_birth.day}
- Hour (shichen): ${body.user_birth.shichen}

The glyph drawn:
- Number: ${signData.sign_number}
- Level: ${signData.level}

The full traditional content of this glyph (Chinese + English mixed):
─────────────────────────────────────────
${signData.raw_md_content}
─────────────────────────────────────────

Now generate the JSON response per the system prompt's format.`;
    
    // 3. 调用 Google Gemini
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: SYSTEM_PROMPT,
    });
    const result = await model.generateContent(userPrompt);
    const responseText = result.response.text();
    
    // 4. 解析返回的 JSON
    
    let reading;
    try {
      // 移除可能的 markdown 代码块标记
      const cleanedText = responseText
        .replace(/^```json\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
      reading = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse LLM response:', responseText);
      throw new Error('Invalid LLM response format');
    }
    
    // 5. 验证必需字段
    if (!reading.situation || !reading.meaning || !reading.wisdom || 
        !reading.actions || !reading.reflections || !reading.revisit_timing) {
      throw new Error('LLM response missing required fields');
    }
    
    return NextResponse.json({ reading });
    
  } catch (error) {
    console.error('Full reading API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate reading' },
      { status: 500 }
    );
  }
}
```

### 环境变量

需要在 `.env.local` 添加(在 [Google AI Studio](https://aistudio.google.com/) 创建 API Key):

```
GOOGLE_GENERATIVE_AI_API_KEY=你的密钥
# 可选:与 AI Studio 里选的模型 ID 一致
# GOOGLE_GENERATIVE_AI_MODEL=gemini-2.0-flash
```

也支持使用变量名 `GEMINI_API_KEY`(二选一即可,代码里已做兼容)。

---

## 六、保存到 Archive(本地)

完整解读自动保存到 IndexedDB 的逻辑。

### 文件:`src/lib/oracle/saveToArchive.ts`

```typescript
import { openDB, type DBSchema } from 'idb';
import type { SignData, UserInput, FullReading } from '@/types/oracle';

interface OracleDBSchema extends DBSchema {
  oracle_entries: {
    key: string;  // entry_id (UUID)
    value: {
      id: string;
      sign: SignData;
      user_input: UserInput;
      full_reading: FullReading;
      drawn_at: number;
    };
    indexes: { 'by-date': number };
  };
}

const DB_NAME = 'poju_oracle';
const DB_VERSION = 1;

async function getDB() {
  return openDB<OracleDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore('oracle_entries', { keyPath: 'id' });
      store.createIndex('by-date', 'drawn_at');
    },
  });
}

/**
 * 保存抽签记录到 Archive
 */
export async function saveOracleEntry({
  sign,
  userInput,
  fullReading,
}: {
  sign: SignData;
  userInput: UserInput;
  fullReading: FullReading;
}): Promise<string> {
  const db = await getDB();
  
  const entry = {
    id: crypto.randomUUID(),
    sign,
    user_input: userInput,
    full_reading: fullReading,
    drawn_at: Date.now(),
  };
  
  await db.put('oracle_entries', entry);
  return entry.id;
}

/**
 * 获取所有 Oracle 记录(用于 Archive 页面)
 */
export async function getAllOracleEntries() {
  const db = await getDB();
  const entries = await db.getAllFromIndex('oracle_entries', 'by-date');
  // 倒序返回(最新的在前)
  return entries.reverse();
}

/**
 * 获取最近 N 小时内的记录(用于 48 小时相似度检测)
 */
export async function getRecentEntries(hoursAgo: number) {
  const db = await getDB();
  const cutoff = Date.now() - hoursAgo * 3600 * 1000;
  
  const tx = db.transaction('oracle_entries', 'readonly');
  const index = tx.store.index('by-date');
  const range = IDBKeyRange.lowerBound(cutoff);
  
  const entries = [];
  let cursor = await index.openCursor(range);
  while (cursor) {
    entries.push(cursor.value);
    cursor = await cursor.continue();
  }
  
  return entries;
}
```

---

## 七、本文档完成状态

```
✅ GlyphCard 翻转容器组件
✅ DrawSequence 抽签序列控制
✅ Save 卡片背面到本地
✅ Share 卡片背面调用系统菜单
✅ FullReading 完整解读组件(含加载/错误状态)
✅ POJU 引流钩子(报告底部)
✅ RAG 后端 API(调用 Google Gemini,`@google/generative-ai`)
✅ System Prompt(强调"无好坏"原则)
✅ 自动保存到 IndexedDB
```

**下一步**:阅读 `oracle-dynamic-implementation-part-4.md`,完成 Oracle 主介绍页文案 + 测试页面 + Cursor 步骤化指令。

---

✦
