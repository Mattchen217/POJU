# Oracle 动态交互实现 · 第 4 部分 · 主流程 / 文案 / 测试 / 步骤化指令

> **本系列共 4 份文档,这是第 4 份(收尾)**
>
> 阅读顺序:
> - ✅ 第 1 部分:数据结构 + 抽签算法 + 类型定义
> - ✅ 第 2 部分:5 套卡片正面布局组件 + 卡片背面 PNG 组件
> - ✅ 第 3 部分:翻转 + 抽签序列 + RAG 调用
> - ▶ **第 4 部分(本文):主流程整合 + 文案更新 + 测试页面 + Cursor 步骤化指令**

---

## 一、OracleFlow - 主流程组件

把 Spline 集成、抽签序列、完整解读串成一个完整的页面状态机。

### 状态机设计

```
PHASE 1: 主介绍页 (静态)
    ↓ 用户点击 "Start Your Oracle"
PHASE 2: 信息输入页 (Modal/全屏)
    - 输入出生信息 + 问题
    ↓ 用户点击 "Begin"
PHASE 3: Spline 召唤页
    - Spline 文件加载 + 长按 3 秒 + 爆炸
    ↓ Spline 爆炸完成 (内置 4-5 秒后)
PHASE 4: 抽签序列 (DrawSequence)
    - 卡片背面浮现
    - 翻转
    - 卡片正面
    ↓ 用户点击 "Full Reading"
PHASE 5: 完整解读 (FullReading)
    - LLM 调用
    - 报告显示
    - 自动保存
    ↓ 
    - 点击 Ask Again → 回到 PHASE 2 (清空问题保留出生信息)
    - 点击 Close → 回到 PHASE 1
```

### 文件:`src/components/oracle/OracleFlow.tsx`

```tsx
'use client';

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OracleIntro } from './OracleIntro';
import { OracleInput } from './OracleInput';
import { OracleSummon } from './OracleSummon';
import { DrawSequence } from './DrawSequence';
import { FullReading } from './FullReading';
import { saveCardBack } from '@/lib/oracle/saveCard';
import { shareCardBack } from '@/lib/oracle/shareCard';
import { saveOracleEntry } from '@/lib/oracle/saveToArchive';
import type { SignData, UserInput, FullReading as FullReadingType } from '@/types/oracle';

type Phase = 'intro' | 'input' | 'summon' | 'draw' | 'reading';

export function OracleFlow() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [userInput, setUserInput] = useState<UserInput | null>(null);
  const [drawnSign, setDrawnSign] = useState<SignData | null>(null);
  const [fullReading, setFullReading] = useState<FullReadingType | null>(null);
  
  // PHASE 1 → PHASE 2
  const handleStart = useCallback(() => {
    setPhase('input');
  }, []);
  
  // PHASE 2 → PHASE 3 (用户提交输入)
  const handleInputSubmit = useCallback((input: UserInput) => {
    setUserInput(input);
    setPhase('summon');
  }, []);
  
  // PHASE 2 关闭(返回 PHASE 1)
  const handleInputClose = useCallback(() => {
    setPhase('intro');
  }, []);
  
  // PHASE 3 → PHASE 4 (Spline 爆炸完成)
  const handleSummonComplete = useCallback(() => {
    setPhase('draw');
  }, []);
  
  // PHASE 4 内的事件
  const handleSaveCard = useCallback(async () => {
    if (!drawnSign) return;
    const result = await saveCardBack(drawnSign.level, drawnSign.sign_number);
    if (result.success) {
      // 显示 Toast 提示
      console.log('Card saved');
    }
  }, [drawnSign]);
  
  const handleShareCard = useCallback(async () => {
    if (!drawnSign) return;
    await shareCardBack(drawnSign.level, drawnSign.sign_number);
  }, [drawnSign]);
  
  // PHASE 4 → PHASE 5 (用户点击 Full Reading)
  const handleFullReading = useCallback((sign: SignData) => {
    setDrawnSign(sign);
    setPhase('reading');
  }, []);
  
  // PHASE 4 关闭
  const handleDrawClose = useCallback(() => {
    setPhase('intro');
    setDrawnSign(null);
    setFullReading(null);
  }, []);
  
  // PHASE 5 内:报告生成完成时,自动保存到 Archive
  const handleReadingGenerated = useCallback(async (reading: FullReadingType) => {
    if (!drawnSign || !userInput) return;
    
    setFullReading(reading);
    
    // 自动保存到本地 Archive
    try {
      await saveOracleEntry({
        sign: drawnSign,
        userInput,
        fullReading: reading,
      });
    } catch (error) {
      console.error('Failed to save to archive:', error);
    }
  }, [drawnSign, userInput]);
  
  // PHASE 5 → PHASE 2 (Ask Again)
  const handleAskAgain = useCallback(() => {
    // 保留出生信息,清空问题
    if (userInput) {
      setUserInput({
        ...userInput,
        question: '',
      });
    }
    setDrawnSign(null);
    setFullReading(null);
    setPhase('input');
  }, [userInput]);
  
  // PHASE 5 → PHASE 1 (Close)
  const handleClose = useCallback(() => {
    setPhase('intro');
    setUserInput(null);
    setDrawnSign(null);
    setFullReading(null);
  }, []);
  
  return (
    <AnimatePresence mode="wait">
      {phase === 'intro' && (
        <motion.div key="intro" exit={{ opacity: 0 }}>
          <OracleIntro onStart={handleStart} />
        </motion.div>
      )}
      
      {phase === 'input' && (
        <motion.div key="input" exit={{ opacity: 0 }}>
          <OracleInput 
            initialInput={userInput || undefined}
            onSubmit={handleInputSubmit}
            onClose={handleInputClose}
          />
        </motion.div>
      )}
      
      {phase === 'summon' && userInput && (
        <motion.div key="summon" exit={{ opacity: 0 }}>
          <OracleSummon 
            userInput={userInput}
            onComplete={handleSummonComplete}
          />
        </motion.div>
      )}
      
      {phase === 'draw' && userInput && (
        <motion.div key="draw" exit={{ opacity: 0 }}>
          <DrawSequence
            userInput={userInput}
            onSaveCard={handleSaveCard}
            onShareCard={handleShareCard}
            onFullReading={handleFullReading}
            onClose={handleDrawClose}
          />
        </motion.div>
      )}
      
      {phase === 'reading' && drawnSign && userInput && (
        <motion.div key="reading" exit={{ opacity: 0 }}>
          <FullReading
            sign={drawnSign}
            userInput={userInput}
            onAskAgain={handleAskAgain}
            onClose={handleClose}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

## 二、OracleSummon - Spline 召唤组件

集成你做好的 Spline 文件,处理长按 + 爆炸 + 完成回调。

### 文件:`src/components/oracle/OracleSummon.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import Spline from '@splinetool/react-spline';
import type { UserInput } from '@/types/oracle';

interface OracleSummonProps {
  userInput: UserInput;
  onComplete: () => void;
}

/**
 * Spline 召唤页
 * 
 * 注意: Spline 文件已包含:
 *   - 粒子球持续运动
 *   - 鼠标交互
 *   - 长按 3 秒检测
 *   - 爆炸动画
 *   - 粒子消失
 * 
 * React 端只需要:
 *   - 加载 Spline 文件
 *   - 等待爆炸完成时间(3 秒长按 + 1.5 秒爆炸 = 4500ms)
 *   - 触发 onComplete 进入下一阶段
 */
export function OracleSummon({ userInput, onComplete }: OracleSummonProps) {
  const [isPressing, setIsPressing] = useState(false);
  const [pressStartTime, setPressStartTime] = useState<number | null>(null);
  const [hasExploded, setHasExploded] = useState(false);
  
  // 长按检测
  const handlePressStart = () => {
    setIsPressing(true);
    setPressStartTime(Date.now());
  };
  
  const handlePressEnd = () => {
    if (pressStartTime) {
      const duration = Date.now() - pressStartTime;
      
      if (duration >= 3000 && !hasExploded) {
        // 长按 3 秒达成 → Spline 内部已触发爆炸
        // 等待爆炸动画完成(约 1.5 秒)再进入下一阶段
        setHasExploded(true);
        setTimeout(() => {
          onComplete();
        }, 1500);
      }
    }
    setIsPressing(false);
    setPressStartTime(null);
  };
  
  return (
    <div className="
      fixed inset-0 z-50
      bg-gradient-to-b from-[#0B0815] to-[#000000]
      flex items-center justify-center
    ">
      {/* Spline 场景 */}
      <div 
        className="absolute inset-0"
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressEnd}
      >
        <Spline
          scene="/spline/oracle-explosion.splinecode"
        />
      </div>
      
      {/* 提示文字 - 当未爆炸时显示 */}
      {!hasExploded && (
        <div className="
          absolute bottom-32 left-1/2 -translate-x-1/2
          text-white/70 text-center
          pointer-events-none
        ">
          {!isPressing ? (
            <p className="text-lg italic">Hold to summon your glyph</p>
          ) : (
            <p className="text-lg italic">
              {pressStartTime && Date.now() - pressStartTime > 2000 
                ? 'Almost there...' 
                : 'Hold steady...'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 四、OracleInput - 信息输入页

Stage 2 输入页面,含三规则提醒 + 出生信息 + 问题输入。

### 文件:`src/components/oracle/OracleInput.tsx`

```tsx
'use client';

import { useState } from 'react';
import type { UserInput } from '@/types/oracle';

interface OracleInputProps {
  initialInput?: UserInput;
  onSubmit: (input: UserInput) => void;
  onClose: () => void;
}

const SHICHEN_OPTIONS = [
  { value: 'unknown', label: 'Not sure' },
  { value: 'zi',   label: '11 PM – 1 AM · Midnight (Zi)' },
  { value: 'chou', label: '1 AM – 3 AM · Late Night (Chou)' },
  { value: 'yin',  label: '3 AM – 5 AM · Pre-Dawn (Yin)' },
  { value: 'mao',  label: '5 AM – 7 AM · Sunrise (Mao)' },
  { value: 'chen', label: '7 AM – 9 AM · Morning (Chen)' },
  { value: 'si',   label: '9 AM – 11 AM · Late Morning (Si)' },
  { value: 'wu',   label: '11 AM – 1 PM · Noon (Wu)' },
  { value: 'wei',  label: '1 PM – 3 PM · Early Afternoon (Wei)' },
  { value: 'shen', label: '3 PM – 5 PM · Afternoon (Shen)' },
  { value: 'you',  label: '5 PM – 7 PM · Sunset (You)' },
  { value: 'xu',   label: '7 PM – 9 PM · Evening (Xu)' },
  { value: 'hai',  label: '9 PM – 11 PM · Night (Hai)' },
];

export function OracleInput({ initialInput, onSubmit, onClose }: OracleInputProps) {
  const [year, setYear] = useState(initialInput?.birthYear?.toString() || '');
  const [month, setMonth] = useState(initialInput?.birthMonth?.toString() || '');
  const [day, setDay] = useState(initialInput?.birthDay?.toString() || '');
  const [shichen, setShichen] = useState(initialInput?.birthShichen || 'unknown');
  const [question, setQuestion] = useState(initialInput?.question || '');
  
  const isValid = year && month && day && question.trim().length > 0;
  
  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit({
      birthYear: parseInt(year, 10),
      birthMonth: parseInt(month, 10),
      birthDay: parseInt(day, 10),
      birthShichen: shichen,
      question: question.trim(),
    });
  };
  
  return (
    <div className="
      fixed inset-0 z-50 overflow-y-auto
      bg-gradient-to-b from-[#0B0815] to-[#000000]
    ">
      <div className="max-w-xl mx-auto px-6 py-16 relative">
        
        {/* 关闭按钮 */}
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
        
        {/* 简化版三条规则提醒 */}
        <div className="text-center mb-12">
          <h2 className="font-serif text-2xl text-purple-200 mb-6">
            You're about to ask
          </h2>
          
          <div className="space-y-2 text-white/80 italic mb-6">
            <p>One question.</p>
            <p>Honest question.</p>
            <p>60 characters.</p>
          </div>
          
          <p className="text-purple-300 italic">
            A sincere heart opens the channel.
          </p>
          
          {/* 用户确认要加的"无好坏"提醒 */}
          <div className="mt-8 pt-8 border-t border-white/10">
            <p className="text-white/60 italic text-sm leading-relaxed">
              There are no good glyphs and no bad glyphs.<br />
              Only honest mirrors of this moment.
            </p>
          </div>
        </div>
        
        {/* 表单 */}
        <div className="space-y-8">
          
          {/* 出生信息 */}
          <div>
            <label className="block text-white/80 mb-3 text-sm tracking-wide">
              Your birth date
            </label>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="number"
                placeholder="Year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min={1900}
                max={new Date().getFullYear()}
                className="
                  px-4 py-3 rounded-lg
                  bg-white/5 border border-white/20
                  text-white placeholder:text-white/40
                  focus:border-purple-400 focus:outline-none
                  transition-colors
                "
              />
              <input
                type="number"
                placeholder="Month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                min={1}
                max={12}
                className="
                  px-4 py-3 rounded-lg
                  bg-white/5 border border-white/20
                  text-white placeholder:text-white/40
                  focus:border-purple-400 focus:outline-none
                  transition-colors
                "
              />
              <input
                type="number"
                placeholder="Day"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                min={1}
                max={31}
                className="
                  px-4 py-3 rounded-lg
                  bg-white/5 border border-white/20
                  text-white placeholder:text-white/40
                  focus:border-purple-400 focus:outline-none
                  transition-colors
                "
              />
            </div>
          </div>
          
          {/* 时辰 */}
          <div>
            <label className="block text-white/80 mb-3 text-sm tracking-wide">
              Your birth hour
            </label>
            <select
              value={shichen}
              onChange={(e) => setShichen(e.target.value)}
              className="
                w-full px-4 py-3 rounded-lg
                bg-white/5 border border-white/20
                text-white
                focus:border-purple-400 focus:outline-none
                transition-colors
              "
            >
              {SHICHEN_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-[#0B0815]">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* 问题 */}
          <div>
            <label className="block text-white/80 mb-3 text-sm tracking-wide">
              Your question
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, 60))}
              placeholder="e.g. Should I take this new job offer?"
              rows={3}
              className="
                w-full px-4 py-3 rounded-lg
                bg-white/5 border border-white/20
                text-white placeholder:text-white/40
                focus:border-purple-400 focus:outline-none
                transition-colors
                resize-none
              "
            />
            <div className="text-right text-white/40 text-xs mt-1">
              {question.length} / 60
            </div>
            <p className="text-white/50 text-sm italic mt-3">
              Think of one thing. One real thing. 
              If it's many, choose the one that weighs most.
            </p>
          </div>
          
          {/* 提交按钮 */}
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className={`
              w-full py-4 rounded-full font-medium tracking-wide
              transition-all
              ${isValid 
                ? 'bg-purple-500 hover:bg-purple-600 text-white shadow-lg shadow-purple-500/30 cursor-pointer' 
                : 'bg-white/10 text-white/40 cursor-not-allowed'
              }
            `}
          >
            Begin →
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 五、Oracle 主路由页面

### 文件:`src/app/(oracle)/oracle/page.tsx`

```tsx
import { OracleFlow } from '@/components/oracle/OracleFlow';

export default function OraclePage() {
  return <OracleFlow />;
}
```

就这么简单 - OracleFlow 内部状态机管理所有阶段切换。

---

## 六、测试页面 - 强制抽特定卡片

为了开发时能快速验证 5 张卡片的效果,创建一个 dev-only 测试页面。

### 文件:`src/app/(dev)/oracle-test/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { DrawSequence } from '@/components/oracle/DrawSequence';
import { FullReading } from '@/components/oracle/FullReading';
import { drawSignByLevel, drawSignByNumber, getLevelDistribution, validateSignsData } from '@/lib/oracle/drawSign';
import type { SignData, UserInput, GlyphLevel } from '@/types/oracle';

// 测试用的固定 UserInput
const MOCK_USER_INPUT: UserInput = {
  birthYear: 1990,
  birthMonth: 5,
  birthDay: 15,
  birthShichen: 'mao',
  question: 'Should I change my career path?',
};

export default function OracleTestPage() {
  const [forcedSign, setForcedSign] = useState<SignData | null>(null);
  const [showFullReading, setShowFullReading] = useState(false);
  
  // 数据完整性检查结果
  const validation = validateSignsData();
  const distribution = getLevelDistribution();
  
  if (forcedSign && showFullReading) {
    return (
      <FullReading
        sign={forcedSign}
        userInput={MOCK_USER_INPUT}
        onAskAgain={() => {
          setForcedSign(null);
          setShowFullReading(false);
        }}
        onClose={() => {
          setForcedSign(null);
          setShowFullReading(false);
        }}
      />
    );
  }
  
  if (forcedSign) {
    return (
      <DrawSequence
        userInput={MOCK_USER_INPUT}
        forcedSign={forcedSign}
        onSaveCard={() => alert('Save card (test)')}
        onShareCard={() => alert('Share card (test)')}
        onFullReading={(sign) => {
          setShowFullReading(true);
        }}
        onClose={() => setForcedSign(null)}
      />
    );
  }
  
  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl mb-8">Oracle Test Page (Dev Only)</h1>
      
      {/* 数据完整性检查 */}
      <section className="mb-12 p-6 bg-white/5 rounded-lg">
        <h2 className="text-lg mb-4">Data Validation</h2>
        {validation.valid ? (
          <p className="text-green-400">✓ All 100 signs valid</p>
        ) : (
          <div className="text-red-400 space-y-1">
            <p>✗ Validation errors:</p>
            <ul className="list-disc pl-6">
              {validation.errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
      
      {/* 等级分布 */}
      <section className="mb-12 p-6 bg-white/5 rounded-lg">
        <h2 className="text-lg mb-4">Level Distribution</h2>
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(distribution).map(([level, count]) => (
            <div key={level} className="text-center">
              <div className="text-purple-300 text-sm">{level}</div>
              <div className="text-3xl">{count}</div>
              <div className="text-white/40 text-xs">
                {(count / 100 * 100).toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </section>
      
      {/* 强制抽各等级 */}
      <section className="mb-12">
        <h2 className="text-lg mb-4">Force Draw by Level</h2>
        <div className="grid grid-cols-5 gap-3">
          {(['divine_tailwind', 'fair_sky', 'still_water', 'crosswind', 'eye_of_storm'] as GlyphLevel[]).map(level => (
            <button
              key={level}
              onClick={() => {
                try {
                  setForcedSign(drawSignByLevel(level));
                } catch (e) {
                  alert(`Error: ${(e as Error).message}`);
                }
              }}
              className="
                px-4 py-3 rounded-lg
                bg-purple-500/20 hover:bg-purple-500/40
                border border-purple-500/40
                text-sm
              "
            >
              {level.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </section>
      
      {/* 强制抽指定签号 */}
      <section className="mb-12">
        <h2 className="text-lg mb-4">Force Draw by Sign Number</h2>
        <div className="grid grid-cols-10 gap-2">
          {Array.from({ length: 100 }, (_, i) => i + 1).map(num => (
            <button
              key={num}
              onClick={() => {
                try {
                  setForcedSign(drawSignByNumber(num));
                } catch (e) {
                  alert(`Sign #${num} not found`);
                }
              }}
              className="
                py-2 rounded
                bg-white/5 hover:bg-white/15
                text-xs
              "
            >
              {num}
            </button>
          ))}
        </div>
      </section>
      
      {/* 真实随机抽签 */}
      <section>
        <h2 className="text-lg mb-4">Real Random Draw</h2>
        <button
          onClick={() => {
            // 用真实随机抽签触发完整流程
            window.location.href = '/oracle';
          }}
          className="
            px-8 py-3 rounded-full
            bg-purple-500 hover:bg-purple-600
            text-white
          "
        >
          Go to /oracle (Real Flow)
        </button>
      </section>
    </div>
  );
}
```

---

## 七、Cursor 步骤化指令

把以下指令**完整复制**给 Cursor。它会按步骤实施。

```markdown
---

# Cursor 任务:实现 Oracle 完整动态交互

## 目标

实现 POJU Oracle 抽签功能的完整动态交互。

5 张卡片背面 PNG 已由用户做好,放在 `public/oracle/wind-cards/`:
  - divine-tailwind.png
  - fair-sky.png
  - still-water.png
  - crosswind.png
  - eye-of-storm.png

100 签数据 JSON 由用户准备,放在 `public/oracle/data/signs.json`。

## 阅读顺序(请严格按顺序读)

1. @docs/oracle/oracle-dynamic-implementation-part-1.md  
   (数据结构 + 抽签算法)
   
2. @docs/oracle/oracle-dynamic-implementation-part-2.md  
   (5 套卡片正面布局组件 + 卡片背面 PNG 组件)
   
3. @docs/oracle/oracle-dynamic-implementation-part-3.md  
   (翻转 + 抽签序列 + RAG 调用)
   
4. @docs/oracle/oracle-dynamic-implementation-part-4.md  
   (主流程 + 文案 + 测试 + 本指令)

## 实施顺序

### 阶段 0:准备工作

```bash
# 1. 安装依赖
pnpm add @splinetool/react-spline @splinetool/runtime
pnpm add framer-motion
pnpm add idb
pnpm add @google/generative-ai

# 2. 配置环境变量(Google AI Studio 申请的 API Key)
echo "GOOGLE_GENERATIVE_AI_API_KEY=..." >> .env.local
# 可选: echo "GOOGLE_GENERATIVE_AI_MODEL=gemini-2.0-flash" >> .env.local
```

### 阶段 1:数据与类型(part 1)

按 part-1.md 创建:
- `src/types/oracle.ts` (类型定义)
- `src/lib/oracle/drawSign.ts` (抽签算法)

【完成后通知用户,等待用户确认 signs.json 已就位】

### 阶段 2:卡片组件(part 2)

按 part-2.md 创建:
- `src/components/oracle/glyph-back/GlyphBackImage.tsx`
- `src/components/oracle/glyph-front/GlyphFront.tsx`
- 字体配置(layout.tsx + tailwind.config.ts)

创建预览页 `/oracle-fronts-preview`,截图给用户看 5 张正面 + 5 张背面。

【完成后等待用户确认视觉通过】

### 阶段 3:翻转与序列(part 3)

按 part-3.md 创建:
- `src/components/oracle/GlyphCard.tsx` (翻转容器)
- `src/components/oracle/DrawSequence.tsx` (抽签序列)
- `src/lib/oracle/saveCard.ts` (保存卡片背面)
- `src/lib/oracle/shareCard.ts` (分享卡片背面)
- `src/components/oracle/FullReading.tsx` (完整解读)
- `src/lib/oracle/api.ts` (前端 API 调用)
- `src/app/api/oracle/full-reading/route.ts` (后端 RAG)
- `src/lib/oracle/saveToArchive.ts` (本地保存)

【完成后等待用户确认 RAG 流程通过】

### 阶段 4:主流程(part 4)

按 part-4.md 创建:
- `src/components/oracle/OracleFlow.tsx` (主状态机)
- `src/components/oracle/OracleSummon.tsx` (Spline 集成)
- `src/components/oracle/OracleIntro.tsx` (主介绍页,含"On the glyphs"新小节)
- `src/components/oracle/OracleInput.tsx` (信息输入页)
- `src/app/(oracle)/oracle/page.tsx` (路由)
- `src/app/(dev)/oracle-test/page.tsx` (测试页)

确保 Spline 文件路径:
- `public/spline/oracle-explosion.splinecode` (BAOZHA 文件,用户已上传)

【完成后截图整个流程,等用户最终确认】

## 强制要求

🚫 不要"优化" 5 张卡片背面 PNG (那是用户精心做的)
🚫 不要修改 LEVEL_META 配置(影响视觉一致性)
🚫 不要为 Eye of Storm 或 Crosswind 添加"安抚副文字"
   (用户明确要求 5 张统一不区别对待)
🚫 不要修改抽签算法(必须是 1-100 均等随机)
🚫 不要把 raw_md_content 显示给用户
🚫 不要把"Sign of [Level]"翻译成中文显示
🚫 不要在卡片任何位置出现中文

✅ 严格按文档代码实施,可粘贴可粘贴
✅ TypeScript 严格类型,no any
✅ 每完成一个阶段,截图并等待用户确认
✅ 启动时 console.log validateSignsData() 结果

## 自检清单(每阶段完成后)

阶段 1:
□ 类型定义完整,无 any
□ drawSign() 是 Math.floor(Math.random() * 100) 而不是按等级概率
□ 测试用辅助函数(drawSignByLevel, drawSignByNumber)都实现了

阶段 2:
□ /oracle-fronts-preview 能看到 5 张背面 + 5 张正面
□ 5 张正面用同一个 GlyphFront 组件,只通过 LEVEL_META 差异化
□ Eye of Storm 用 ◉ 不是 ✦
□ Eye of Storm 没有特殊副文字
□ Crosswind 没有特殊副文字
□ 字体正确(EB Garamond 衬线)

阶段 3:
□ 翻转动画 800ms,X 轴
□ 翻转中间有闪光
□ Save 按钮下载 / 分享卡片背面 PNG
□ Share 按钮调用 Web Share API
□ Full Reading 加载状态切换文字
□ Full Reading 显示 6 段结构(situation/meaning/wisdom/actions/reflections/revisit)
□ Full Reading 底部有 POJU 钩子和 $9.99 按钮
□ "✓ This reading is saved to your Archive" 提示出现
□ RAG API(Gemini)调用成功,返回有效 JSON

阶段 4:
□ /oracle 主介绍页有"On the glyphs"小节(新)
□ "On the glyphs" 在 5 级预告和三规则之间
□ 输入页有"There are no good glyphs and no bad glyphs"提醒
□ Spline 文件加载,长按 3 秒触发爆炸
□ 爆炸完成 4500ms 后进入抽签序列
□ Ask Again 保留出生信息,清空问题
□ Close 完全重置状态

总体:
□ 完整跑通一次:Intro → Input → Summon → Draw → Reading → Archive
□ 测试页 /oracle-test 5 个等级按钮都能强制抽
□ 检查 console: validateSignsData() 显示全 100 签有效
```

---

## 八、本系列文档完成

```
✅ Part 1: 数据结构 + 抽签算法 + 类型定义
✅ Part 2: 5 套卡片正面布局 + 卡片背面 PNG 组件
✅ Part 3: 翻转 + 抽签序列 + RAG 调用
✅ Part 4: 主流程 + 文案 + 测试 + 步骤化指令
```

---

## 九、文件交付清单

请把这 4 份 MD 文档放进项目:

```
项目根目录/
└── docs/
    └── oracle/
        ├── oracle-dynamic-implementation-part-1.md
        ├── oracle-dynamic-implementation-part-2.md
        ├── oracle-dynamic-implementation-part-3.md
        └── oracle-dynamic-implementation-part-4.md
```

然后在 Cursor 中开始实施(用第七节的步骤化指令)。

---

✦
