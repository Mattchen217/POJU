# Syncro 终极修复 - 完整可复制代码版

> ⛔ **致 Cursor:这次不允许你"按理解发挥"**
>
> 本文档每一行代码都是【完整可复制】的。
> 你的任务:
> 1. 复制粘贴
> 2. 在真机测试
> 3. 贴日志和截图
> 4. 不要"优化"我的代码
> 5. 不要"调整"数值
> 6. 不要"重构"结构
>
> 任何"我觉得这样更好"的发挥都会被视为失败。

---

# 上次失败的根本原因

```
我(指令作者)的错:用了太多抽象概念
  - "同心圆系统" 
  - "占容器 75%"
  - "vmin 自适应"
  
Cursor 的错:在抽象指令下自由发挥
  - 方位符百分比定位 → 全堆中心
  - 12 时辰并行 → 大量失败
  - 粒子套圆框 → 被遮罩限制

这次彻底改:
  - 全部用固定 px(不用 %)
  - 全部用完整代码(不用描述)
  - 12 时辰严格串行(不允许并行)
```

---

# 🔴 Part 1:罗盘视图完整重写(替换现有文件)

## 1.1 主组件 - 完整代码复制粘贴

文件:`components/syncro/SyncroCompassMode.tsx`(完全替换,不要保留原代码)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { SyncroParticleCore } from './SyncroParticleCore';
import { PostureHintOverlay } from './PostureHintOverlay';
import { WhyThisCurrentModal } from './WhyThisCurrentModal';

// ============================================================
// 关键尺寸常量 - 不要修改这些数值
// ============================================================
const RING_SIZE = 380;          // 整个罗盘区域
const PARTICLE_SIZE = 380;      // 粒子动效尺寸(铺满整个区域)
const LABEL_RADIUS = 170;       // 方位符距中心的距离(px)
const CENTER_INFO_WIDTH = 140;  // 中心信息宽度
// ============================================================

const DIRECTIONS = [
  { id: 'N',  angle: 0 },
  { id: 'NE', angle: 45 },
  { id: 'E',  angle: 90 },
  { id: 'SE', angle: 135 },
  { id: 'S',  angle: 180 },
  { id: 'SW', angle: 225 },
  { id: 'W',  angle: 270 },
  { id: 'NW', angle: 315 }
];

interface Props {
  matrix: Record<string, any>;
  activeHour: string;
  alpha: number;
  beta: number;
}

export function SyncroCompassMode({ matrix, activeHour, alpha, beta }: Props) {
  const t = useTranslations('syncro');
  const [whyModalOpen, setWhyModalOpen] = useState(false);
  
  // 根据 alpha 算出当前指向的方位
  const currentDirection = alphaToDirection(alpha);
  const cellKey = `${activeHour}__${currentDirection}`;
  const cell = matrix[cellKey];
  
  return (
    <div className="compass-page">
      {/* 1. 姿态提示浮层 */}
      <PostureHintOverlay mode="compass" beta={beta} />
      
      {/* 2. 主视觉:罗盘区 */}
      <div 
        className="compass-area"
        style={{
          position: 'relative',
          width: RING_SIZE,
          height: RING_SIZE,
          margin: '40px auto 0'
        }}
      >
        {/* 旋转容器:包住粒子 + 方位符 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            transform: `rotate(${-alpha}deg)`,
            transition: 'transform 200ms cubic-bezier(0.2, 0, 0.2, 1)',
            transformOrigin: 'center center'
          }}
        >
          {/* 粒子动效层:不要任何 border-radius / overflow:hidden */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: PARTICLE_SIZE,
              height: PARTICLE_SIZE,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none'
            }}
          >
            <SyncroParticleCore />
          </div>
          
          {/* 8 个方位符:每个用 px 精确定位 */}
          {DIRECTIONS.map(dir => {
            const rad = ((dir.angle - 90) * Math.PI) / 180;
            const x = Math.cos(rad) * LABEL_RADIUS;
            const y = Math.sin(rad) * LABEL_RADIUS;
            
            return (
              <div
                key={dir.id}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'rgba(160, 164, 184, 0.85)',
                  letterSpacing: 1.5,
                  pointerEvents: 'none',
                  userSelect: 'none'
                }}
              >
                {dir.id}
              </div>
            );
          })}
        </div>
        
        {/* 中心信息:不旋转,独立定位 */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: CENTER_INFO_WIDTH,
            textAlign: 'center',
            zIndex: 5,
            pointerEvents: 'none'
          }}
        >
          {cell ? (
            <CurrentDisplay cell={cell} hourId={activeHour} />
          ) : (
            <div style={{ color: '#8A8AA0', fontSize: 11 }}>
              {t('generating')}
            </div>
          )}
        </div>
      </div>
      
      {/* 3. Why this current 按钮 */}
      <div style={{ textAlign: 'center', marginTop: 80 }}>
        <button
          onClick={() => setWhyModalOpen(true)}
          style={{
            padding: '8px 18px',
            background: 'rgba(212, 165, 116, 0.12)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            color: '#D4A574',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: 0.3,
            border: 'none',
            borderRadius: 20,
            boxShadow: 'inset 0 0 0 0.5px rgba(212, 165, 116, 0.3)',
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          {t('why_this_current')}
        </button>
      </div>
      
      {/* Modal */}
      {whyModalOpen && cell && (
        <WhyThisCurrentModal
          cell={cell}
          direction={currentDirection}
          hourId={activeHour}
          onClose={() => setWhyModalOpen(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// 子组件:中心 Current 信息
// ============================================================
function CurrentDisplay({ cell, hourId }: { cell: any; hourId: string }) {
  const colorMap: Record<string, string> = {
    'open_current': '#00D9B8',
    'following_current': '#4ECDC4',
    'stillwater': '#8A8AA0',
    'crosscurrent': '#E89F4D',
    'undertow': '#C85A5A'
  };
  
  const labelMap: Record<string, string> = {
    'open_current': '通流',
    'following_current': '顺流',
    'stillwater': '守静',
    'crosscurrent': '逆流',
    'undertow': '暗潮'
  };
  
  return (
    <div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 500,
          color: colorMap[cell.current_level] || '#A0A4B8',
          letterSpacing: 0.5,
          lineHeight: 1.2
        }}
      >
        {labelMap[cell.current_level] || '—'}
      </div>
    </div>
  );
}

// ============================================================
// 工具函数:alpha 角度 → 8 方位
// ============================================================
function alphaToDirection(alpha: number): string {
  // alpha: 0-360 度(0 = 北)
  // 8 方位每 45 度一个
  const idx = Math.round(alpha / 45) % 8;
  return DIRECTIONS[idx].id;
}
```

## 1.2 容器样式

文件:`styles/syncro-compass.css`(完全替换)

```css
/* 整个罗盘页:简单的全屏容器 */
.compass-page {
  position: relative;
  width: 100%;
  min-height: calc(100vh - 200px);  /* 减掉时辰条 + 底部 nav */
  padding-top: 0;
  padding-bottom: 130px;  /* 给底部模式切换留空间 */
}

/* 不要给 .compass-area 加任何样式,所有样式都用 inline style */
/* 不要加 overflow: hidden 到任何地方 */
/* 不要加 border-radius: 50% 到任何地方 */
```

## ⚠️ Cursor:Part 1 验证清单

```
真机测试,iPhone Safari:

□ 罗盘区域显示完整圆形粒子(380px × 380px)
□ 8 个方位符【分散】在粒子动效外缘
  - 不是堆在中心!
  - N 在上,S 在下,E 在右,W 在左,NE/SE/SW/NW 在斜角
□ 中心显示 Current 等级文字("守静"等)
□ 中心信息【不旋转】
□ 转动手机:方位符 + 粒子整体旋转
□ N 始终指向真北

如果方位符还是堆在中心:
  → console.log 打印 DIRECTIONS 数组的 x, y 计算值
  → 把日志给用户看,定位 bug

🛑 不通过不要进入 Part 2
```

---

# 🔴 Part 2:AR 视图(复用 Part 1 + 中心摄像头)

```tsx
// components/syncro/SyncroARMode.tsx
// 跟 Compass 几乎一样,只是中心层换成圆形摄像头视窗

'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { SyncroParticleCore } from './SyncroParticleCore';
import { PostureHintOverlay } from './PostureHintOverlay';
import { WhyThisCurrentModal } from './WhyThisCurrentModal';

const RING_SIZE = 380;
const PARTICLE_SIZE = 380;
const LABEL_RADIUS = 170;
const CAMERA_WINDOW_SIZE = 150;

const DIRECTIONS = [
  { id: 'N',  angle: 0 },   { id: 'NE', angle: 45 },
  { id: 'E',  angle: 90 },  { id: 'SE', angle: 135 },
  { id: 'S',  angle: 180 }, { id: 'SW', angle: 225 },
  { id: 'W',  angle: 270 }, { id: 'NW', angle: 315 }
];

const HALO_COLORS: Record<string, string> = {
  'open_current':       'rgba(0, 217, 184, 0.7)',
  'following_current':  'rgba(78, 205, 196, 0.6)',
  'stillwater':         'rgba(138, 138, 160, 0.4)',
  'crosscurrent':       'rgba(232, 159, 77, 0.6)',
  'undertow':           'rgba(200, 90, 90, 0.6)'
};

interface Props {
  matrix: Record<string, any>;
  activeHour: string;
  alpha: number;
  beta: number;
}

export function SyncroARMode({ matrix, activeHour, alpha, beta }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  
  // 启动摄像头
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch (e) {
        console.error('[AR] camera failed:', e);
      }
    })();
    
    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);
  
  const direction = alphaToDirection(alpha);
  const cell = matrix[`${activeHour}__${direction}`];
  const haloColor = HALO_COLORS[cell?.current_level] || 'rgba(255, 255, 255, 0.15)';
  
  return (
    <div className="compass-page">
      <PostureHintOverlay mode="ar" beta={beta} />
      
      <div style={{
        position: 'relative',
        width: RING_SIZE,
        height: RING_SIZE,
        margin: '40px auto 0'
      }}>
        {/* 旋转层:粒子 + 方位符(跟 Compass 完全一样)*/}
        <div style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%',
          transform: `rotate(${-alpha}deg)`,
          transition: 'transform 200ms ease-out'
        }}>
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: PARTICLE_SIZE,
            height: PARTICLE_SIZE,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}>
            <SyncroParticleCore />
          </div>
          
          {DIRECTIONS.map(dir => {
            const rad = ((dir.angle - 90) * Math.PI) / 180;
            const x = Math.cos(rad) * LABEL_RADIUS;
            const y = Math.sin(rad) * LABEL_RADIUS;
            return (
              <div key={dir.id} style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                fontSize: 14, fontWeight: 500,
                color: 'rgba(160, 164, 184, 0.85)',
                letterSpacing: 1.5,
                pointerEvents: 'none'
              }}>
                {dir.id}
              </div>
            );
          })}
        </div>
        
        {/* 中心:圆形摄像头视窗(不旋转)*/}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: CAMERA_WINDOW_SIZE,
          height: CAMERA_WINDOW_SIZE,
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: `
            0 0 32px ${haloColor},
            0 0 64px ${haloColor.replace('0.7', '0.3').replace('0.6', '0.25').replace('0.4', '0.15')},
            inset 0 0 0 2px ${haloColor}
          `,
          transition: 'box-shadow 600ms ease',
          zIndex: 5
        }}>
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          
          {/* 视窗内的信息叠加 */}
          {cell && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'radial-gradient(circle, rgba(7,9,26,0.5) 0%, transparent 70%)',
              color: '#fff',
              textShadow: '0 1px 4px rgba(0,0,0,0.8)'
            }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                {getCurrentLabel(cell.current_level)}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Why this current */}
      <div style={{ textAlign: 'center', marginTop: 80 }}>
        <button
          onClick={() => setWhyOpen(true)}
          style={{
            padding: '8px 18px',
            background: 'rgba(212, 165, 116, 0.12)',
            backdropFilter: 'blur(20px)',
            color: '#D4A574',
            fontSize: 11, fontWeight: 500,
            border: 'none', borderRadius: 20,
            cursor: 'pointer', fontFamily: 'inherit'
          }}
        >
          为何此时
        </button>
      </div>
      
      {whyOpen && cell && (
        <WhyThisCurrentModal cell={cell} direction={direction} hourId={activeHour} onClose={() => setWhyOpen(false)} />
      )}
    </div>
  );
}

function alphaToDirection(alpha: number): string {
  const idx = Math.round(alpha / 45) % 8;
  return DIRECTIONS[idx].id;
}

function getCurrentLabel(level: string): string {
  const map: Record<string, string> = {
    'open_current': '通流',
    'following_current': '顺流',
    'stillwater': '守静',
    'crosscurrent': '逆流',
    'undertow': '暗潮'
  };
  return map[level] || '—';
}
```

---

# 🔴 Part 3:MAP 视图(复用 Part 1 + 8 个点)

```tsx
// components/syncro/SyncroMapMode.tsx

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SyncroParticleCore } from './SyncroParticleCore';
import { WhyThisCurrentModal } from './WhyThisCurrentModal';

const RING_SIZE = 380;
const PARTICLE_SIZE = 380;
const LABEL_RADIUS = 170;
const POINT_RADIUS = 140;       // 8 个点的距离(在方位符内一点)
const POINT_SIZE = 12;          // 点尺寸(用户反馈太大,缩小)

const DIRECTIONS = [
  { id: 'N',  angle: 0 },   { id: 'NE', angle: 45 },
  { id: 'E',  angle: 90 },  { id: 'SE', angle: 135 },
  { id: 'S',  angle: 180 }, { id: 'SW', angle: 225 },
  { id: 'W',  angle: 270 }, { id: 'NW', angle: 315 }
];

const POINT_COLORS: Record<string, string> = {
  'open_current': '#00D9B8',
  'following_current': '#4ECDC4',
  'stillwater': '#8A8AA0',
  'crosscurrent': '#E89F4D',
  'undertow': '#C85A5A'
};

interface Props {
  matrix: Record<string, any>;
  activeHour: string;
}

export function SyncroMapMode({ matrix, activeHour }: Props) {
  const [selectedDir, setSelectedDir] = useState('N');
  const [whyOpen, setWhyOpen] = useState(false);
  
  const cell = matrix[`${activeHour}__${selectedDir}`];
  
  return (
    <div className="compass-page">
      <div style={{
        position: 'relative',
        width: RING_SIZE,
        height: RING_SIZE,
        margin: '40px auto 0'
      }}>
        {/* 粒子背景(不旋转,MAP 是静态)*/}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: PARTICLE_SIZE,
          height: PARTICLE_SIZE,
          transform: 'translate(-50%, -50%)',
          opacity: 0.5,  // 减弱,作为背景
          pointerEvents: 'none'
        }}>
          <SyncroParticleCore />
        </div>
        
        {/* 方位符(不旋转)*/}
        {DIRECTIONS.map(dir => {
          const rad = ((dir.angle - 90) * Math.PI) / 180;
          const x = Math.cos(rad) * LABEL_RADIUS;
          const y = Math.sin(rad) * LABEL_RADIUS;
          return (
            <div key={dir.id} style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              fontSize: 14, fontWeight: 500,
              color: 'rgba(160, 164, 184, 0.85)',
              letterSpacing: 1.5,
              pointerEvents: 'none'
            }}>
              {dir.id}
            </div>
          );
        })}
        
        {/* 8 个可点击的方位点 */}
        {DIRECTIONS.map(dir => {
          const rad = ((dir.angle - 90) * Math.PI) / 180;
          const x = Math.cos(rad) * POINT_RADIUS;
          const y = Math.sin(rad) * POINT_RADIUS;
          const dirCell = matrix[`${activeHour}__${dir.id}`];
          const color = POINT_COLORS[dirCell?.current_level] || '#444';
          const isSelected = dir.id === selectedDir;
          
          return (
            <button
              key={dir.id}
              onClick={() => setSelectedDir(dir.id)}
              style={{
                position: 'absolute',
                top: '50%', left: '50%',
                width: isSelected ? POINT_SIZE + 4 : POINT_SIZE,
                height: isSelected ? POINT_SIZE + 4 : POINT_SIZE,
                borderRadius: '50%',
                background: isSelected ? '#D4A574' : color,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                boxShadow: isSelected 
                  ? '0 0 20px rgba(212, 165, 116, 0.5)' 
                  : `0 0 8px ${color}`,
                transition: 'all 200ms ease',
                zIndex: 3
              }}
              aria-label={dir.id}
            />
          );
        })}
        
        {/* 中心信息(显示当前选中方位)*/}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 130,
          textAlign: 'center',
          zIndex: 5,
          pointerEvents: 'none'
        }}>
          <div style={{
            fontSize: 10, color: '#D4A574',
            letterSpacing: 2, marginBottom: 6
          }}>
            {selectedDir}
          </div>
          {cell && (
            <div style={{
              fontSize: 18, fontWeight: 500,
              color: POINT_COLORS[cell.current_level]
            }}>
              {getCurrentLabel(cell.current_level)}
            </div>
          )}
        </div>
      </div>
      
      {/* 提示 */}
      <div style={{
        textAlign: 'center',
        fontSize: 10,
        color: '#8A8AA0',
        marginTop: 16
      }}>
        点击圆环上的方位以查看解读
      </div>
      
      <div style={{ textAlign: 'center', marginTop: 40 }}>
        <button
          onClick={() => setWhyOpen(true)}
          style={{
            padding: '8px 18px',
            background: 'rgba(212, 165, 116, 0.12)',
            color: '#D4A574', fontSize: 11,
            border: 'none', borderRadius: 20,
            cursor: 'pointer', fontFamily: 'inherit'
          }}
        >
          为何此时
        </button>
      </div>
      
      {whyOpen && cell && (
        <WhyThisCurrentModal cell={cell} direction={selectedDir} hourId={activeHour} onClose={() => setWhyOpen(false)} />
      )}
    </div>
  );
}

function getCurrentLabel(level: string): string {
  const map: Record<string, string> = {
    'open_current': '通流',
    'following_current': '顺流',
    'stillwater': '守静',
    'crosscurrent': '逆流',
    'undertow': '暗潮'
  };
  return map[level] || '—';
}
```

---

# 🔴 Part 4:12 时辰严格串行生成(核心修复)

## 4.1 后端 API - 一次只生成一个时辰

文件:`app/api/syncro/llm_hour/route.ts`(新建,替代旧的 llm_batch)

```typescript
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;  // 单时辰 60s 上限
export const dynamic = 'force-dynamic';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface Body {
  hour_id: string;
  hour_label: string;       // "酉时" / "Hour of the Rooster"
  hour_range: string;       // "17:00-19:00"
  cells: Array<{            // 8 cells 一次性生成
    key: string;
    direction: string;      // N / NE / E / ...
    current_level: string;  // open_current / ...
  }>;
  task_description: string;
  profile_summary: string;
  locale: string;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let body: Body;
  
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  
  console.log(`[llm_hour] ${body.hour_id} start, cells=${body.cells.length}`);
  
  const langInstruction = body.locale === 'zh' 
    ? '用简体中文输出。'
    : 'Output in English.';
  
  const system = `You are Syncro analyzer. For the given hour and 8 directions, generate practical guidance.

# User task
"${body.task_description}"

# Output JSON ONLY - no preamble, no explanation:
{
  "advice": {
    "N": {
      "short": "<50-80 chars,one-sentence direct advice>",
      "detailed": "<150-200 chars,2-3 sentences action advice>",
      "rationale": "<100-150 chars,why this for the user's task>"
    },
    "NE": { ... },
    // ... 8 directions total: N, NE, E, SE, S, SW, W, NW
  }
}

# Rules
${langInstruction}
- All 8 directions MUST be included
- DO NOT use: astrology, divination, fortune-telling, 占卜, 算命, 命理
- Use: pojulife / reading / analysis / 解读 / 分析`;

  const userMsg = `Hour: ${body.hour_label} (${body.hour_range})

The 8 directions for this hour have these current levels (already computed):
${body.cells.map(c => `  ${c.direction}: ${c.current_level}`).join('\n')}

Profile context: ${body.profile_summary}

Generate advice for all 8 directions. Output JSON only.`;

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://easternos.com',
        'X-Title': 'pojulife'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat-v3.1',
        stream: false,
        max_tokens: 3500,        // 8 cells × ~400 tokens
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMsg }
        ]
      }),
      signal: AbortSignal.timeout(55000)
    });
    
    if (!response.ok) {
      const errText = await response.text();
      console.error(`[llm_hour] ${body.hour_id} HTTP error:`, response.status, errText);
      return NextResponse.json({ 
        error: 'llm_http_error',
        status: response.status,
        detail: errText.slice(0, 200)
      }, { status: 500 });
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error(`[llm_hour] ${body.hour_id} no content in response`);
      return NextResponse.json({ error: 'no_content' }, { status: 500 });
    }
    
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error(`[llm_hour] ${body.hour_id} JSON parse failed:`, content.slice(0, 200));
      return NextResponse.json({ error: 'parse_failed' }, { status: 500 });
    }
    
    if (!parsed.advice) {
      return NextResponse.json({ error: 'missing_advice' }, { status: 500 });
    }
    
    // 转换为 cell_key 索引
    const adviceByKey: Record<string, any> = {};
    for (const cell of body.cells) {
      const dirAdvice = parsed.advice[cell.direction];
      if (dirAdvice) {
        adviceByKey[cell.key] = {
          short_advice: dirAdvice.short || '',
          detailed_advice: dirAdvice.detailed || '',
          rationale: dirAdvice.rationale || ''
        };
      }
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`[llm_hour] ${body.hour_id} done in ${elapsed}ms, cells=${Object.keys(adviceByKey).length}/8`);
    
    return NextResponse.json({
      hour_id: body.hour_id,
      advice: adviceByKey,
      elapsed_ms: elapsed
    });
    
  } catch (e: any) {
    console.error(`[llm_hour] ${body.hour_id} exception:`, e.message);
    return NextResponse.json({ 
      error: 'exception',
      message: e.message 
    }, { status: 500 });
  }
}
```

## 4.2 客户端串行调用

文件:`components/syncro/SyncroResultLoader.tsx`(关键修改)

```typescript
// ⚠️ Cursor:严格按这个逻辑执行,不要改成并行!

const HOUR_ORDER = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 
                    'wu', 'wei', 'shen', 'you', 'xu', 'hai'];

async function loadAllHoursSerially(
  startHour: string, 
  matrix: any,
  sessionId: string,
  taskDescription: string,
  profileSummary: string,
  locale: string,
  onProgress: (hourId: string, status: 'started' | 'done' | 'failed') => void
) {
  // 从当前时辰开始,环形顺序
  const startIdx = HOUR_ORDER.indexOf(startHour);
  const ordered = [
    ...HOUR_ORDER.slice(startIdx),
    ...HOUR_ORDER.slice(0, startIdx)
  ];
  
  console.log('[Syncro] 串行生成顺序:', ordered);
  
  // ⭐ for...of + await,严格串行
  for (const hourId of ordered) {
    onProgress(hourId, 'started');
    
    const cellKeys = Object.keys(matrix).filter(k => k.startsWith(`${hourId}__`));
    if (cellKeys.length === 0) {
      console.warn(`[Syncro] ${hourId} 没有 cells,跳过`);
      continue;
    }
    
    const cells = cellKeys.map(key => {
      const [, direction] = key.split('__');
      return {
        key,
        direction,
        current_level: matrix[key]?.current_level || 'stillwater'
      };
    });
    
    try {
      const response = await fetch('/api/syncro/llm_hour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hour_id: hourId,
          hour_label: getHourLabel(hourId, locale),
          hour_range: getHourRange(hourId),
          cells,
          task_description: taskDescription,
          profile_summary: profileSummary,
          locale
        }),
        signal: AbortSignal.timeout(60000)
      });
      
      if (!response.ok) {
        console.error(`[Syncro] ${hourId} 失败 ${response.status}`);
        onProgress(hourId, 'failed');
        // ⭐ 失败不阻塞,继续下一个
        continue;
      }
      
      const data = await response.json();
      
      // 合并到 matrix
      // (注意:这里需要 setMatrix,具体看你的 state 管理)
      updateMatrixWithAdvice(data.advice);
      
      onProgress(hourId, 'done');
      console.log(`[Syncro] ✅ ${hourId} 完成`);
      
    } catch (e: any) {
      console.error(`[Syncro] ${hourId} 异常:`, e.message);
      onProgress(hourId, 'failed');
      continue;  // ⭐ 继续下一个
    }
  }
  
  console.log('[Syncro] 全部时辰处理完毕');
}

// 进入页面后,先确保当前时辰生成好,然后启动后台串行
useEffect(() => {
  async function init() {
    // 1. 先生成当前时辰(用户必须看到)
    await generateCurrentHour(currentHourId);
    
    // 2. 然后后台串行生成剩余 11 个
    loadAllHoursSerially(
      nextHourAfter(currentHourId),  // 从下一个时辰开始
      matrix,
      sessionId,
      taskDescription,
      profileSummary,
      locale,
      (hourId, status) => {
        // 更新 UI 状态
        setHourStatusMap(prev => ({ ...prev, [hourId]: status }));
      }
    );
  }
  init();
}, []);
```

## 4.3 时辰圆点状态显示

```typescript
// 状态优先级:done > started > pending > failed

function getHourDotColor(hourId: string, currentHourId: string, statusMap: any): string {
  if (hourId === currentHourId) return '#D4A574';  // 当前金色
  
  const status = statusMap[hourId];
  if (status === 'done') return '#4ECDC4';     // 已生成绿色
  if (status === 'failed') return '#C85A5A';   // 失败红色
  return '#444';                                // 未生成灰色
}
```

## ⚠️ Part 4 验证清单

```
真机测试:

□ console 看到:"[Syncro] 串行生成顺序: [...]" 打印 12 个时辰
□ 一个一个时辰按顺序日志出现:
  - "[Syncro] ✅ zi 完成"
  - "[Syncro] ✅ chou 完成"
  - ... (按顺序,不是乱序!)
□ 时辰圆点按顺序变绿(不是随机几个绿)
□ 即使中间有 1-2 个失败(红色),也不阻塞后续
□ 最终至少 10/12 个时辰成功(>80%)

如果还是大量失败:
  贴出后端日志(看 [llm_hour] 那些错误)
  可能是:
  - OpenRouter API key 问题
  - DeepSeek 模型名错误
  - prompt 太长
  - 网络问题
```

---

# 🔴 Part 5:不允许做的事

```
⛔ 不允许把代码改成"更好的写法"
⛔ 不允许把 inline style 改成 className
⛔ 不允许调整任何 px 数值
⛔ 不允许把串行改成并行(包括 Promise.all / Promise.allSettled)
⛔ 不允许"重构"为更通用的组件
⛔ 不允许说"已实现"但没真机测试
⛔ 不允许跳到下一个 Part(必须 Part 1 通过才能 Part 2)
```

---

# 总结

```
本次修复的核心改变:

技术层:
  ✓ 从抽象描述 → 完整代码复制
  ✓ 从 % vmin → 固定 px
  ✓ 从同心圆嵌套 → 单层 + 子元素 absolute
  ✓ 从并行 LLM → 严格串行
  ✓ 从 16 cells/batch → 8 cells/hour

体验层:
  ✓ 方位符在外缘
  ✓ 粒子自然铺满
  ✓ 中心信息独立
  ✓ 整体跟手机转
  ✓ 时辰按顺序点亮
```

---

**致 Cursor:这是终极版本。再失败就是你的问题,不是指令的问题。
完整代码已给,复制粘贴,真机测试,贴日志。完毕。**
