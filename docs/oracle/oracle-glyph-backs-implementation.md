# Oracle 卡片背面 · 5 级粒子艺术代码实现指南

> **这份文档专门给 Cursor 用**。Cursor 读完这份文档后,应该能直接编写 5 个卡片背面组件,不需要做任何创造性决策。
>
> **强制要求**:严格按照本文档的参数实现。不要"优化"、"改进"或"调整"——所有决定已在文档中明确给出。

---

## 文档目标

实现 5 个 React 组件,对应 Oracle 抽签的 5 个等级,每个组件渲染一个**精美的粒子艺术卡片背面**,9:16 竖版比例。

```
src/components/oracle/glyph-backs/
├── DivineTailwindBack.tsx
├── FairSkyBack.tsx
├── StillWaterBack.tsx
├── CrosswindBack.tsx
├── EyeOfStormBack.tsx
├── shared/
│   ├── ParticleRing.tsx          (边缘环组件,5 张共用)
│   ├── BackgroundGradient.tsx    (深空紫底色,5 张共用)
│   └── shaders/                  (GLSL shader 文件)
│       ├── particle.vert
│       └── particle.frag
└── index.ts
```

---

## 第一部分 · 通用规范(所有 5 张共用)

### 1.1 Canvas 设置

每个卡片背面都用一个 React Three Fiber `<Canvas>` 渲染,统一设置:

```tsx
<Canvas
  orthographic
  camera={{
    position: [0, 0, 100],
    zoom: 50,
    near: 0.1,
    far: 1000,
  }}
  dpr={[1, 2]}                  // 移动端最高 2x DPR(性能优化)
  gl={{
    antialias: true,
    alpha: true,                  // 透明背景(让外层 React 控制卡片边框)
    preserveDrawingBuffer: true,  // 必须为 true,这样可以保存为图片
  }}
  style={{
    width: '100%',
    height: '100%',
    background: 'transparent',
  }}
>
  <BackgroundGradient />
  {/* 各卡片独有的中心图案 */}
  <ParticleRing config={ringConfig} />
</Canvas>
```

**为什么用正交相机**:卡片是平面 2D 视觉,正交相机避免透视变形,让粒子大小一致。

### 1.2 卡片容器(在 Canvas 外层)

```tsx
<div
  className="
    relative aspect-[9/16] w-full
    rounded-[24px] overflow-hidden
    bg-gradient-to-b from-[#0B0815] to-[#141029]
  "
  style={{
    boxShadow: '0 0 40px rgba(139, 92, 246, 0.15)',
  }}
>
  <Canvas>{/* 上面的内容 */}</Canvas>
  
  {/* 玻璃边框叠加层(纯 CSS) */}
  <div className="absolute inset-0 pointer-events-none rounded-[24px]
    border-[1.5px] border-purple-400/30
    shadow-[inset_0_0_20px_rgba(139,92,246,0.1)]
  " />
</div>
```

### 1.3 安装的 npm 包(确保已安装)

```bash
pnpm add three @types/three
pnpm add @react-three/fiber @react-three/drei
pnpm add framer-motion
```

### 1.4 性能分级配置

```tsx
// src/lib/oracle/performance.ts
export function getDeviceTier(): 'high' | 'mid' | 'low' {
  if (typeof window === 'undefined') return 'mid';
  
  const memory = (navigator as any).deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  
  if (memory >= 8 && cores >= 8) return 'high';
  if (memory >= 4 && cores >= 4) return 'mid';
  return 'low';
}

export const PARTICLE_COUNTS = {
  high: { multiplier: 1.0 },
  mid:  { multiplier: 0.5 },
  low:  { multiplier: 0.25 },
};
```

### 1.5 共用的 GLSL Shader(所有粒子都用这个)

#### 文件:`src/components/oracle/glyph-backs/shared/shaders/particle.vert`

```glsl
attribute float aSize;
attribute vec3 aColor;
attribute float aOpacity;

uniform float uTime;
uniform float uPixelRatio;

varying vec3 vColor;
varying float vOpacity;

void main() {
  vColor = aColor;
  vOpacity = aOpacity;
  
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  gl_PointSize = aSize * uPixelRatio;
  gl_PointSize *= (1.0 / -mvPosition.z);
}
```

#### 文件:`src/components/oracle/glyph-backs/shared/shaders/particle.frag`

```glsl
varying vec3 vColor;
varying float vOpacity;

void main() {
  // 圆形粒子(不是方形)
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  
  // 软边缘(高斯衰减)
  float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
  alpha *= vOpacity;
  
  // 内部高光(让粒子像发光的小球,不是平的圆)
  float glow = exp(-dist * 4.0);
  vec3 color = vColor + vec3(glow * 0.3);
  
  gl_FragColor = vec4(color, alpha);
}
```

### 1.6 共用组件:`BackgroundGradient.tsx`

```tsx
// src/components/oracle/glyph-backs/shared/BackgroundGradient.tsx
import { useMemo } from 'react';
import * as THREE from 'three';

interface BackgroundGradientProps {
  topColor?: string;
  bottomColor?: string;
}

/**
 * 卡片背景的径向渐变层(从中心向边缘变深)
 * 不是粒子,只是一个全屏 plane 加渐变
 */
export function BackgroundGradient({
  topColor = '#1A0F2E',
  bottomColor = '#0B0815',
}: BackgroundGradientProps) {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTopColor: { value: new THREE.Color(topColor) },
        uBottomColor: { value: new THREE.Color(bottomColor) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        varying vec2 vUv;
        void main() {
          // 径向渐变:中心亮,边缘暗
          float dist = distance(vUv, vec2(0.5, 0.5));
          float gradient = 1.0 - smoothstep(0.0, 0.7, dist);
          vec3 color = mix(uBottomColor, uTopColor, gradient);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      depthWrite: false,
    });
  }, [topColor, bottomColor]);

  return (
    <mesh position={[0, 0, -50]}>
      <planeGeometry args={[200, 200]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
```

### 1.7 共用组件:`ParticleRing.tsx`(边缘环)

```tsx
// src/components/oracle/glyph-backs/shared/ParticleRing.tsx
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import particleVert from './shaders/particle.vert';
import particleFrag from './shaders/particle.frag';

export interface RingConfig {
  radius: number;          // 环半径(单位是相机视野单位)
  particleCount: number;   // 粒子数
  color: string;           // 主色 hex
  rotationSpeed: number;   // 度/秒,正值顺时针,负值逆时针
  particleSize: number;    // 粒子尺寸
  opacity: number;         // 整体不透明度
  hasGaps?: boolean;       // 是否有间隙(Crosswind 用)
  gapCount?: number;       // 间隙数量
  goldDots?: boolean;      // 是否有金色装饰点(Eye of Storm 用)
  goldDotInterval?: number;// 每隔多少颗有一个金点
}

export function ParticleRing({ config }: { config: RingConfig }) {
  const meshRef = useRef<THREE.Points>(null);
  
  const { positions, colors, sizes, opacities } = useMemo(() => {
    const positions = new Float32Array(config.particleCount * 3);
    const colors = new Float32Array(config.particleCount * 3);
    const sizes = new Float32Array(config.particleCount);
    const opacities = new Float32Array(config.particleCount);
    
    const baseColor = new THREE.Color(config.color);
    const goldColor = new THREE.Color('#FFD700');
    
    for (let i = 0; i < config.particleCount; i++) {
      const angle = (i / config.particleCount) * Math.PI * 2;
      
      // 处理间隙(Crosswind)
      let visible = true;
      if (config.hasGaps && config.gapCount) {
        const gapSize = (Math.PI * 2) / (config.gapCount * 4); // 每个间隙占段长 1/4
        const segmentSize = (Math.PI * 2) / config.gapCount;
        const positionInSegment = angle % segmentSize;
        if (positionInSegment < gapSize) {
          visible = false;
        }
      }
      
      const radius = config.radius + (Math.random() - 0.5) * 0.5; // 微小波动
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = 0;
      
      // 处理金色点(Eye of Storm)
      const isGoldDot = config.goldDots && config.goldDotInterval &&
                       i % config.goldDotInterval === 0;
      const color = isGoldDot ? goldColor : baseColor;
      
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      
      sizes[i] = config.particleSize * (0.8 + Math.random() * 0.4);
      opacities[i] = visible ? config.opacity : 0;
    }
    
    return { positions, colors, sizes, opacities };
  }, [config]);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      // 旋转环
      const rotationRadPerSec = (config.rotationSpeed * Math.PI) / 180;
      meshRef.current.rotation.z += rotationRadPerSec * delta;
    }
  });
  
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio : 1 },
    },
    vertexShader: particleVert,
    fragmentShader: particleFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);
  
  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aOpacity" args={[opacities, 1]} />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  );
}
```

---

## 第二部分 · 5 张卡片背面的具体实现

### 卡片 1 · Divine Tailwind(神风相送)

#### 视觉目标

中心:由金色粒子组成的【绽放莲花】,8 片花瓣呈放射状,中心一个亮金光球。
背景:金白粒子从中心向外缓慢辐射(像太阳风)。
边缘:**双层粒子环**(内圈金色顺时针 + 外圈紫色逆时针)。
整体氛围:神圣、温暖、稀有。

#### 关键参数

```typescript
const DIVINE_TAILWIND_CONFIG = {
  background: {
    topColor: '#1A0F2E',
    bottomColor: '#0B0815',
  },
  
  lotus: {
    petalCount: 8,                    // 8 片花瓣
    innerPetalCount: 4,               // 内层 4 片小花瓣
    particlesPerPetal: 100,           // 每片花瓣粒子数
    petalLength: 8,                   // 花瓣长度(单位)
    petalWidth: 2.5,                  // 花瓣宽度
    coreSize: 12,                     // 中心金核大小
    bloomCycle: 4,                    // 绽放周期(秒)
    bloomScaleMin: 0.95,
    bloomScaleMax: 1.05,
    petalColor: '#FFD700',            // 花瓣金色
    coreColor: '#FFF4B8',             // 中心金白
    glowColor: '#F0ABFC',             // 周围光晕(粉紫)
  },
  
  radiationParticles: {
    count: 250,                       // 辐射粒子数
    speed: 8,                         // 像素/秒(屏幕单位)
    color: '#FFE5A0',                 // 金白
    sizeMin: 1.5,
    sizeMax: 3,
    spawnRadius: 5,                   // 从中心多远开始
    fadeRadius: 35,                   // 多远开始变暗
  },
  
  innerRing: {
    radius: 32,
    particleCount: 70,
    color: '#FFD700',                 // 金色
    rotationSpeed: 12,                // 度/秒,顺时针
    particleSize: 2.5,
    opacity: 0.85,
  },
  
  outerRing: {
    radius: 38,
    particleCount: 70,
    color: '#F0ABFC',                 // 粉紫
    rotationSpeed: -14.4,             // 度/秒,逆时针(不同方向)
    particleSize: 2,
    opacity: 0.6,
  },
};
```

#### 完整组件代码

```tsx
// src/components/oracle/glyph-backs/DivineTailwindBack.tsx
import { Canvas } from '@react-three/fiber';
import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BackgroundGradient } from './shared/BackgroundGradient';
import { ParticleRing } from './shared/ParticleRing';
import particleVert from './shared/shaders/particle.vert';
import particleFrag from './shared/shaders/particle.frag';

const CONFIG = {
  // 见上面的 DIVINE_TAILWIND_CONFIG
  background: {
    topColor: '#1A0F2E',
    bottomColor: '#0B0815',
  },
  lotus: {
    petalCount: 8,
    innerPetalCount: 4,
    particlesPerPetal: 100,
    petalLength: 8,
    petalWidth: 2.5,
    coreSize: 12,
    bloomCycle: 4,
    bloomScaleMin: 0.95,
    bloomScaleMax: 1.05,
    petalColor: '#FFD700',
    coreColor: '#FFF4B8',
    glowColor: '#F0ABFC',
  },
  radiationParticles: {
    count: 250,
    speed: 8,
    color: '#FFE5A0',
    sizeMin: 1.5,
    sizeMax: 3,
    spawnRadius: 5,
    fadeRadius: 35,
  },
  innerRing: {
    radius: 32,
    particleCount: 70,
    color: '#FFD700',
    rotationSpeed: 12,
    particleSize: 2.5,
    opacity: 0.85,
  },
  outerRing: {
    radius: 38,
    particleCount: 70,
    color: '#F0ABFC',
    rotationSpeed: -14.4,
    particleSize: 2,
    opacity: 0.6,
  },
};

/**
 * 莲花组件 - 8 大花瓣 + 4 小花瓣 + 中心金核
 */
function Lotus() {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  
  // 生成花瓣粒子
  const { positions, colors, sizes, opacities } = useMemo(() => {
    const total = CONFIG.lotus.petalCount + CONFIG.lotus.innerPetalCount;
    const totalParticles = total * CONFIG.lotus.particlesPerPetal;
    
    const positions = new Float32Array(totalParticles * 3);
    const colors = new Float32Array(totalParticles * 3);
    const sizes = new Float32Array(totalParticles);
    const opacities = new Float32Array(totalParticles);
    
    const petalColor = new THREE.Color(CONFIG.lotus.petalColor);
    let particleIndex = 0;
    
    // 外层 8 片大花瓣
    for (let petal = 0; petal < CONFIG.lotus.petalCount; petal++) {
      const angle = (petal / CONFIG.lotus.petalCount) * Math.PI * 2;
      
      for (let i = 0; i < CONFIG.lotus.particlesPerPetal; i++) {
        // 花瓣形状:水滴形(尖端在外侧)
        const t = i / CONFIG.lotus.particlesPerPetal;
        const distance = t * CONFIG.lotus.petalLength;
        
        // 水滴形宽度变化(中段最宽,两端尖)
        const widthFactor = Math.sin(t * Math.PI);
        const lateral = (Math.random() - 0.5) * CONFIG.lotus.petalWidth * widthFactor;
        
        // 旋转到对应花瓣方向
        const x = Math.cos(angle) * distance - Math.sin(angle) * lateral;
        const y = Math.sin(angle) * distance + Math.cos(angle) * lateral;
        
        positions[particleIndex * 3] = x;
        positions[particleIndex * 3 + 1] = y;
        positions[particleIndex * 3 + 2] = 0;
        
        colors[particleIndex * 3] = petalColor.r;
        colors[particleIndex * 3 + 1] = petalColor.g;
        colors[particleIndex * 3 + 2] = petalColor.b;
        
        // 越靠近花瓣尖端越亮
        sizes[particleIndex] = 1 + (1 - t) * 2;
        opacities[particleIndex] = 0.7 + (1 - t) * 0.3;
        
        particleIndex++;
      }
    }
    
    // 内层 4 片小花瓣(旋转 22.5°,填补外层空隙)
    const innerOffset = (Math.PI * 2) / CONFIG.lotus.petalCount / 2;
    for (let petal = 0; petal < CONFIG.lotus.innerPetalCount; petal++) {
      const angle = (petal / CONFIG.lotus.innerPetalCount) * Math.PI * 2 + innerOffset;
      
      for (let i = 0; i < CONFIG.lotus.particlesPerPetal; i++) {
        const t = i / CONFIG.lotus.particlesPerPetal;
        const distance = t * CONFIG.lotus.petalLength * 0.7; // 更短
        
        const widthFactor = Math.sin(t * Math.PI);
        const lateral = (Math.random() - 0.5) * CONFIG.lotus.petalWidth * 0.7 * widthFactor;
        
        const x = Math.cos(angle) * distance - Math.sin(angle) * lateral;
        const y = Math.sin(angle) * distance + Math.cos(angle) * lateral;
        
        positions[particleIndex * 3] = x;
        positions[particleIndex * 3 + 1] = y;
        positions[particleIndex * 3 + 2] = 0;
        
        colors[particleIndex * 3] = petalColor.r;
        colors[particleIndex * 3 + 1] = petalColor.g;
        colors[particleIndex * 3 + 2] = petalColor.b;
        
        sizes[particleIndex] = 0.8 + (1 - t) * 1.5;
        opacities[particleIndex] = 0.6 + (1 - t) * 0.3;
        
        particleIndex++;
      }
    }
    
    return { positions, colors, sizes, opacities };
  }, []);
  
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio : 1 },
    },
    vertexShader: particleVert,
    fragmentShader: particleFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);
  
  useFrame((state) => {
    if (groupRef.current) {
      // 绽放呼吸动画
      const t = (state.clock.elapsedTime % CONFIG.lotus.bloomCycle) / CONFIG.lotus.bloomCycle;
      // 使用正弦波让动画平滑往返
      const scale = CONFIG.lotus.bloomScaleMin + 
        (Math.sin(t * Math.PI * 2) * 0.5 + 0.5) * 
        (CONFIG.lotus.bloomScaleMax - CONFIG.lotus.bloomScaleMin);
      groupRef.current.scale.set(scale, scale, scale);
    }
    
    if (coreRef.current) {
      // 中心金核同步呼吸亮度
      const t = (state.clock.elapsedTime % CONFIG.lotus.bloomCycle) / CONFIG.lotus.bloomCycle;
      const intensity = 0.8 + (Math.sin(t * Math.PI * 2) * 0.5 + 0.5) * 0.2;
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity = intensity;
    }
  });
  
  return (
    <group ref={groupRef}>
      {/* 花瓣粒子 */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
          <bufferAttribute attach="attributes-aOpacity" args={[opacities, 1]} />
        </bufferGeometry>
        <primitive object={material} attach="material" />
      </points>
      
      {/* 中心金核(用 sphere 实现,不是粒子) */}
      <mesh ref={coreRef}>
        <circleGeometry args={[1.5, 32]} />
        <meshBasicMaterial 
          color={CONFIG.lotus.coreColor}
          transparent
          opacity={1}
        />
      </mesh>
      
      {/* 中心光晕 */}
      <mesh position={[0, 0, -0.1]}>
        <circleGeometry args={[4, 32]} />
        <meshBasicMaterial 
          color={CONFIG.lotus.glowColor}
          transparent
          opacity={0.2}
        />
      </mesh>
    </group>
  );
}

/**
 * 辐射粒子 - 从中心向外飘动的金白粒子
 */
function RadiationParticles() {
  const meshRef = useRef<THREE.Points>(null);
  const particlesData = useRef<{ angle: number; distance: number; speed: number; size: number }[]>([]);
  
  // 初始化粒子数据
  useMemo(() => {
    particlesData.current = [];
    for (let i = 0; i < CONFIG.radiationParticles.count; i++) {
      particlesData.current.push({
        angle: Math.random() * Math.PI * 2,
        distance: CONFIG.radiationParticles.spawnRadius + 
          Math.random() * (CONFIG.radiationParticles.fadeRadius - CONFIG.radiationParticles.spawnRadius),
        speed: CONFIG.radiationParticles.speed * (0.8 + Math.random() * 0.4),
        size: CONFIG.radiationParticles.sizeMin + 
          Math.random() * (CONFIG.radiationParticles.sizeMax - CONFIG.radiationParticles.sizeMin),
      });
    }
  }, []);
  
  const positions = useMemo(() => new Float32Array(CONFIG.radiationParticles.count * 3), []);
  const colors = useMemo(() => {
    const arr = new Float32Array(CONFIG.radiationParticles.count * 3);
    const color = new THREE.Color(CONFIG.radiationParticles.color);
    for (let i = 0; i < CONFIG.radiationParticles.count; i++) {
      arr[i * 3] = color.r;
      arr[i * 3 + 1] = color.g;
      arr[i * 3 + 2] = color.b;
    }
    return arr;
  }, []);
  const sizes = useMemo(() => {
    const arr = new Float32Array(CONFIG.radiationParticles.count);
    particlesData.current.forEach((p, i) => arr[i] = p.size);
    return arr;
  }, []);
  const opacities = useMemo(() => new Float32Array(CONFIG.radiationParticles.count), []);
  
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio : 1 },
    },
    vertexShader: particleVert,
    fragmentShader: particleFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);
  
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    const positionAttr = meshRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const opacityAttr = meshRef.current.geometry.attributes.aOpacity as THREE.BufferAttribute;
    
    particlesData.current.forEach((p, i) => {
      // 粒子向外飘
      p.distance += p.speed * delta;
      
      // 超过淡出半径就重置回起点
      if (p.distance > CONFIG.radiationParticles.fadeRadius) {
        p.distance = CONFIG.radiationParticles.spawnRadius;
        p.angle = Math.random() * Math.PI * 2;
      }
      
      const x = Math.cos(p.angle) * p.distance;
      const y = Math.sin(p.angle) * p.distance;
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = 0;
      
      // 距离越远越透明
      const fadeFactor = 1 - (p.distance - CONFIG.radiationParticles.spawnRadius) / 
        (CONFIG.radiationParticles.fadeRadius - CONFIG.radiationParticles.spawnRadius);
      opacities[i] = Math.max(0, fadeFactor) * 0.6;
    });
    
    positionAttr.needsUpdate = true;
    opacityAttr.needsUpdate = true;
  });
  
  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aOpacity" args={[opacities, 1]} />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  );
}

/**
 * Divine Tailwind 卡片背面 - 主导出
 */
export function DivineTailwindBack() {
  return (
    <div className="
      relative aspect-[9/16] w-full
      rounded-[24px] overflow-hidden
      bg-gradient-to-b from-[#1A0F2E] to-[#0B0815]
    "
    style={{ boxShadow: '0 0 40px rgba(255, 215, 0, 0.15)' }}
    >
      <Canvas
        orthographic
        camera={{ position: [0, 0, 100], zoom: 14, near: 0.1, far: 1000 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <BackgroundGradient 
          topColor={CONFIG.background.topColor}
          bottomColor={CONFIG.background.bottomColor}
        />
        <RadiationParticles />
        <Lotus />
        <ParticleRing config={CONFIG.innerRing} />
        <ParticleRing config={CONFIG.outerRing} />
      </Canvas>
      
      {/* 玻璃边框 */}
      <div className="absolute inset-0 pointer-events-none rounded-[24px]
        border-[1.5px] border-yellow-400/30
        shadow-[inset_0_0_30px_rgba(255,215,0,0.1)]
      " />
    </div>
  );
}
```

---

### 卡片 2 · Fair Sky(晴空可行)

#### 视觉目标

中心:由柔紫粒子组成的【飞鸟剪影】,V 形翅膀展开,鸟头朝右上。
背景:柔紫粒子从左上向右下缓慢飘动(顺风感)。
边缘:**单层柔紫粒子环**,顺时针旋转。
整体氛围:轻盈、开阔、向前。

#### 关键参数

```typescript
const FAIR_SKY_CONFIG = {
  background: {
    topColor: '#1F1640',
    bottomColor: '#0B0815',
  },
  
  bird: {
    // 鸟剪影由 4 段曲线组成
    // 每段曲线由粒子排列组成
    bodyParticles: 60,        // 身体 60 颗
    leftWingParticles: 100,   // 左翅 100 颗
    rightWingParticles: 100,  // 右翅 100 颗
    tailParticles: 40,        // 尾巴 40 颗
    headParticles: 30,        // 头 30 颗
    
    color: '#A78BFA',
    highlightColor: '#C4B5FD',
    
    flapCycle: 6,             // 扇翅周期(秒)
    flapAmplitude: 0.8,       // 扇翅幅度
    
    // 鸟整体定位
    centerX: -3,              // 略偏左下
    centerY: -2,
    rotation: 25,             // 度数,鸟体倾斜角度(向右上)
    scale: 1.0,
  },
  
  trail: {
    count: 60,                // 拖尾粒子数
    fadeTime: 5,              // 5 秒淡出
    color: '#A78BFA',
  },
  
  cloudFlow: {
    count: 500,               // 背景粒子数
    speed: 18,                // 像素/秒
    flowAngleDegrees: 135,    // 从左上(135°)向右下飘
    color: '#C4B5FD',
    sizeMin: 1,
    sizeMax: 2.5,
    opacityMin: 0.2,
    opacityMax: 0.5,
  },
  
  ring: {
    radius: 35,
    particleCount: 60,
    color: '#A78BFA',
    rotationSpeed: 10,
    particleSize: 2,
    opacity: 0.7,
  },
};
```

#### 实现要点

```tsx
// src/components/oracle/glyph-backs/FairSkyBack.tsx

/**
 * 飞鸟粒子组件
 * 鸟形由几段贝塞尔曲线定义,粒子沿曲线分布
 */
function Bird() {
  // 步骤 1:定义鸟形的曲线点(贝塞尔曲线)
  // 鸟体姿态:从中心向左下到右上,翅膀 V 形向上展开
  
  // 鸟身曲线(从尾到头)
  const bodyCurve = useMemo(() => {
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-3, -2, 0),     // 尾部
      new THREE.Vector3(0, 0, 0),       // 身体中段
      new THREE.Vector3(3, 2, 0)        // 头部
    );
  }, []);
  
  // 左翅曲线(从身体中段向左上展开)
  const leftWingCurve = useMemo(() => {
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),       // 起点(身体中段)
      new THREE.Vector3(-3, 2, 0),      // 控制点
      new THREE.Vector3(-5, 3, 0)       // 翅尖
    );
  }, []);
  
  // 右翅曲线(从身体中段向右上展开)
  const rightWingCurve = useMemo(() => {
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(3, 2, 0),
      new THREE.Vector3(5, 3, 0)
    );
  }, []);
  
  // 步骤 2:沿曲线生成粒子
  // 用 curve.getPoints(N) 获取曲线上 N 个均匀分布的点
  
  // 步骤 3:扇翅动画
  // 翅膀粒子的 Y 位置上下波动(用 sin 函数)
  // 周期 6 秒
  
  // 步骤 4:rendering
  // 用 BufferGeometry 渲染所有粒子
  // 应用 ShaderMaterial(共用 particle.vert/frag)
}

/**
 * 拖尾粒子 - 鸟尾持续生成的粒子
 */
function BirdTrail() {
  // 在鸟尾位置(-3, -2)生成新粒子
  // 粒子向左下方向慢慢飘走
  // 5 秒后淡出消失
}

/**
 * 云流背景粒子
 * 从左上角向右下角对角飘动
 */
function CloudFlow() {
  // 500 颗粒子
  // 用 flowAngleDegrees = 135° 计算速度向量:
  //   vx = cos(135°) * speed = -speed * 0.707
  //   vy = sin(135°) * speed = +speed * 0.707
  // 实际我们要让粒子从左上飘到右下,所以:
  //   vx = +speed * 0.707  (向右)
  //   vy = -speed * 0.707  (向下,因为 Y 轴向上为正)
  // 粒子飘出画面后,在左上角重新生成
}

/**
 * Fair Sky 主组件
 */
export function FairSkyBack() {
  return (
    <div className="...">
      <Canvas ...>
        <BackgroundGradient 
          topColor={CONFIG.background.topColor}
          bottomColor={CONFIG.background.bottomColor}
        />
        <CloudFlow />
        <Bird />
        <BirdTrail />
        <ParticleRing config={CONFIG.ring} />
      </Canvas>
      <div className="... border-purple-400/30 ..." />
    </div>
  );
}
```

**详细实现指导(给 Cursor)**:

1. **曲线粒子分布**:用 `curve.getPoints(N)` 获取 N 个点,然后在每个点周围加一点随机抖动(±0.3),让粒子看起来不是机械排在线上。

2. **扇翅动画**:
   ```typescript
   useFrame((state) => {
     const t = state.clock.elapsedTime;
     // 翅膀粒子的 Y 偏移 = sin(t * 2π / 周期) * 幅度
     const wingOffset = Math.sin(t * Math.PI * 2 / CONFIG.bird.flapCycle) * CONFIG.bird.flapAmplitude;
     
     // 给翅膀粒子的 Y 位置加上这个偏移
     // 鸟身和尾巴不动
   });
   ```

3. **拖尾粒子**:
   - 维护一个 particles 数组
   - 每秒在鸟尾位置生成 12 个新粒子(数量 60 / 时间 5 秒)
   - 每个粒子有 `bornTime`,根据 `currentTime - bornTime` 计算透明度(线性衰减)
   - 粒子向左下方向(angle = 225°)缓慢移动

4. **云流背景**:
   - 500 颗粒子,初始位置随机分布在卡片范围内
   - 每帧根据速度向量更新位置
   - 当粒子超出卡片边界右下方时,在左上方边缘重新生成

---

### 卡片 3 · Still Water(止水沉深)· 最常见

#### 视觉目标

中心:从中心点扩散的【同心圆涟漪】,3-4 圈同时存在,慢节奏。
背景:**极少**的粒子,缓慢从下方上升(水底气泡)。
边缘:**最淡的**粒子环,几乎透明。
整体氛围:深沉、静默。

#### 关键参数

```typescript
const STILL_WATER_CONFIG = {
  background: {
    topColor: '#1F1A45',
    bottomColor: '#0B0815',
  },
  
  ripples: {
    maxRipples: 4,                    // 同时存在 4 圈
    spawnInterval: 8,                 // 每 8 秒生成一圈新涟漪(从中心)
    expansionDuration: 8,             // 每圈涟漪从中心扩散到边缘要 8 秒
    maxRadius: 30,                    // 涟漪最大半径(到达即消失)
    particlesPerRipple: 120,
    color: '#6366F1',
    highlightColor: '#818CF8',
  },
  
  centerPoint: {
    size: 4,                          // 中心点大小(永远存在)
    color: '#A5B4FC',                 // 高亮蓝紫
    pulseCycle: 4,                    // 呼吸周期 4 秒
  },
  
  bubbles: {
    count: 30,                        // 极少粒子
    spawnRate: 0.5,                   // 每秒生成 0.5 个新气泡
    riseSpeed: 4,                     // 像素/秒(很慢)
    color: '#C7D2FE',
    sizeMin: 1,
    sizeMax: 2,
    fadeOutAtTop: 5,                  // 距顶部 5 单位时开始淡出
  },
  
  ring: {
    radius: 35,
    particleCount: 40,                // 最少粒子环
    color: '#6366F1',
    rotationSpeed: 6,                 // 极慢
    particleSize: 1.5,
    opacity: 0.3,                     // 极淡
  },
};
```

#### 实现要点

```tsx
/**
 * Still Water 主组件 - 涟漪系统
 */

/**
 * 同心圆涟漪管理器
 * 每 8 秒生成一圈新涟漪,从中心扩散
 */
function RippleSystem() {
  // ripples 数组,每个 ripple 有:
  //   - bornTime: 出生时间
  //   - currentRadius: 当前半径
  //   - opacity: 当前透明度
  
  const ripplesRef = useRef<{ bornTime: number; isAlive: boolean }[]>([]);
  
  useFrame((state) => {
    const now = state.clock.elapsedTime;
    
    // 1. 检查是否需要生成新涟漪
    const lastRipple = ripplesRef.current[ripplesRef.current.length - 1];
    if (!lastRipple || now - lastRipple.bornTime >= CONFIG.ripples.spawnInterval) {
      ripplesRef.current.push({ bornTime: now, isAlive: true });
    }
    
    // 2. 更新所有涟漪
    ripplesRef.current = ripplesRef.current.filter(ripple => {
      const age = now - ripple.bornTime;
      return age < CONFIG.ripples.expansionDuration;
    });
    
    // 3. 渲染每个涟漪
    // 半径 = (age / 8) * 30
    // 透明度:0-2 秒淡入,2-6 秒满,6-8 秒淡出
  });
  
  // 每个涟漪渲染为一个 ring of particles
  // 用 particlesPerRipple = 120 颗粒子均匀分布在圆周
  // 每颗粒子位置:[cos(angle) * radius, sin(angle) * radius]
}

/**
 * 中心点 - 永远存在,缓慢呼吸
 */
function CenterPoint() {
  const ref = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (ref.current) {
      const t = (state.clock.elapsedTime % CONFIG.centerPoint.pulseCycle) / CONFIG.centerPoint.pulseCycle;
      const intensity = 0.7 + (Math.sin(t * Math.PI * 2) * 0.5 + 0.5) * 0.3;
      (ref.current.material as THREE.MeshBasicMaterial).opacity = intensity;
    }
  });
  
  return (
    <mesh ref={ref}>
      <circleGeometry args={[0.5, 32]} />
      <meshBasicMaterial color={CONFIG.centerPoint.color} transparent opacity={1} />
    </mesh>
  );
}

/**
 * 上升气泡 - 极少粒子,缓慢从下到上
 */
function RisingBubbles() {
  // 30 颗粒子,初始位置随机
  // 每帧 Y += riseSpeed * delta
  // 到顶部就重置到底部,X 也重置为随机
  // 每秒生成 0.5 个新气泡(可以一直保持 30 颗,只是循环)
}
```

---

### 卡片 4 · Crosswind(逆风有意)

#### 视觉目标

中心:**两条交叉的粒子曲线**,呈 X 形交错,中心交错点高亮。
背景:粒子从两个相反方向流动(对流感)。
边缘:**有间隙的**粒子环(独有特点!)。
整体氛围:张力、对冲、十字路口。

#### 关键参数

```typescript
const CROSSWIND_CONFIG = {
  background: {
    topColor: '#1A0F25',
    bottomColor: '#0B0815',
  },
  
  curves: {
    // 曲线 1:从左下到右上(S 形)
    curve1: {
      start: { x: -8, y: -8 },
      cp1: { x: -3, y: 3 },           // S 形的中段控制点
      end: { x: 8, y: 8 },
      particleCount: 220,
      color: '#7C3AED',
      flowDirection: 1,               // +1 = start→end
    },
    // 曲线 2:从右下到左上(反 S 形)
    curve2: {
      start: { x: 8, y: -8 },
      cp1: { x: 3, y: 3 },
      end: { x: -8, y: 8 },
      particleCount: 220,
      color: '#A855F7',
      flowDirection: 1,
    },
    flowSpeed: 3,                     // 粒子沿曲线流动的速度
  },
  
  intersection: {
    x: 0,
    y: 0,
    baseSize: 3,
    pulseSize: 4,                     // 对冲增强时的大小
    pulseCycle: 5,                    // 每 5 秒一次对冲
    pulseDuration: 0.5,               // 对冲增强持续 0.5 秒
    color: '#D946EF',
  },
  
  oppositeFlow: {
    // 背景粒子的两个方向流
    leftToRight: {
      count: 200,
      speed: 8,
      color: '#7C3AED',
      opacity: 0.3,
    },
    rightToLeft: {
      count: 200,
      speed: 8,
      color: '#A855F7',
      opacity: 0.3,
    },
  },
  
  ring: {
    radius: 35,
    particleCount: 60,
    color: '#7C3AED',
    rotationSpeed: 10,
    particleSize: 2,
    opacity: 0.6,
    hasGaps: true,                    // 关键!有间隙
    gapCount: 6,                      // 6 段间隙
  },
};
```

#### 实现要点

```tsx
/**
 * 单条曲线粒子流
 */
function CurveStream({ curveConfig, flowSpeed }: { ... }) {
  // 步骤 1:定义贝塞尔曲线
  const curve = useMemo(() => {
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(curveConfig.start.x, curveConfig.start.y, 0),
      new THREE.Vector3(curveConfig.cp1.x, curveConfig.cp1.y, 0),
      new THREE.Vector3(curveConfig.end.x, curveConfig.end.y, 0)
    );
  }, [curveConfig]);
  
  // 步骤 2:粒子沿曲线分布
  // 每个粒子有一个 t 值(0-1),代表它在曲线上的位置
  // 用 curve.getPointAt(t) 获取曲线上 t 位置的坐标
  
  const particlesData = useRef<{ t: number; speed: number }[]>([]);
  
  useMemo(() => {
    particlesData.current = [];
    for (let i = 0; i < curveConfig.particleCount; i++) {
      particlesData.current.push({
        t: Math.random(),
        speed: flowSpeed * (0.8 + Math.random() * 0.4),
      });
    }
  }, [curveConfig, flowSpeed]);
  
  useFrame((state, delta) => {
    // 每个粒子的 t 值随时间增加
    particlesData.current.forEach(p => {
      p.t += (p.speed / 100) * delta;  // 用 100 是因为曲线长度大约 16 单位,速度 / 100 让粒子在 ~5 秒走完曲线
      if (p.t > 1) p.t -= 1;             // 循环回起点
    });
    
    // 更新粒子位置
    // 用 curve.getPointAt(p.t) 获取每个粒子的世界坐标
  });
}

/**
 * 中心交错点 - 高亮 + 周期性对冲
 */
function IntersectionPoint() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (!meshRef.current) return;
    
    const t = state.clock.elapsedTime;
    const cycle = CONFIG.intersection.pulseCycle;
    const cyclePosition = t % cycle;
    
    // 在每个周期的最后 0.5 秒进行对冲增强
    const isInPulse = cyclePosition > cycle - CONFIG.intersection.pulseDuration;
    
    if (isInPulse) {
      const pulseT = (cyclePosition - (cycle - CONFIG.intersection.pulseDuration)) / CONFIG.intersection.pulseDuration;
      // 用半个正弦波让大小先增后减
      const sizeMultiplier = 1 + Math.sin(pulseT * Math.PI) * 
        ((CONFIG.intersection.pulseSize - CONFIG.intersection.baseSize) / CONFIG.intersection.baseSize);
      meshRef.current.scale.set(sizeMultiplier, sizeMultiplier, 1);
    } else {
      meshRef.current.scale.set(1, 1, 1);
    }
  });
  
  return (
    <mesh ref={meshRef}>
      <circleGeometry args={[CONFIG.intersection.baseSize * 0.3, 32]} />
      <meshBasicMaterial color={CONFIG.intersection.color} transparent opacity={0.8} />
    </mesh>
  );
}

/**
 * 对流背景 - 两个相反方向的粒子流
 */
function OppositeFlow() {
  // 200 颗向右,200 颗向左
  // 它们在画面中"擦肩而过"但不交融
  // 用两组粒子,各自的 vx 不同(一组 +speed,一组 -speed)
  // Y 位置随机,X 超出画面就重置到对面
}
```

---

### 卡片 5 · Eye of Storm(风暴中心)· 第二稀有

#### 视觉目标

中心:**永远不动的金色亮点**(代表稳定)。
中圈:**几乎空白**的静止区(代表清明)。
外圈:**狂乱旋转的紫色粒子云**(代表外部混乱)。
**内静外动的极致对比**。

#### 关键参数

```typescript
const EYE_OF_STORM_CONFIG = {
  background: {
    topColor: '#0A0420',
    bottomColor: '#0B0815',
  },
  
  centerGold: {
    size: 1.5,
    color: '#FBBF24',
    pulseCycle: 4,
    glowSize: 5,
    glowColor: '#FCD34D',
  },
  
  innerStillZone: {
    radius: 6,                        // 半径 6 单位的内圈完全静止
    // 不渲染任何东西,只是粒子被"挡在外面"的逻辑
  },
  
  outerStorm: {
    particleCount: 1500,              // 最多粒子的一张
    minRadius: 8,                     // 粒子最小距离中心
    maxRadius: 35,                    // 粒子最大距离
    rotationSpeed: 60,                // 度/秒,基础旋转速度
    pulseCycle: 3,                    // 每 3 秒一次"加速冲击"
    pulseDuration: 0.8,               // 加速持续 0.8 秒
    pulseSpeedMultiplier: 1.5,        // 加速时速度变 1.5 倍
    spiralFactor: 0.3,                // 螺旋系数(略带螺旋)
    
    // 颜色由内向外渐变
    innerColor: '#581C87',
    outerColor: '#3B0764',
    sizeMin: 1,
    sizeMax: 2.5,
  },
  
  ring: {
    radius: 38,
    particleCount: 60,
    color: '#3B0764',
    rotationSpeed: -8,                // 缓慢逆时针
    particleSize: 1.5,
    opacity: 0.5,
    goldDots: true,                   // 关键!金色装饰点
    goldDotInterval: 15,              // 每隔 15 颗有一个金点
  },
};
```

#### 实现要点

```tsx
/**
 * 中心金点 - 永远不动 + 缓慢呼吸
 */
function CenterGoldPoint() {
  // 一个发光的金色小圆 + 周围光晕
  // 用 mesh + circleGeometry + meshBasicMaterial
  // 不需要 useFrame 改位置
  // 只需要在 useFrame 里改 opacity (呼吸亮度)
  
  return (
    <group>
      {/* 中心点 */}
      <mesh>
        <circleGeometry args={[CONFIG.centerGold.size, 32]} />
        <meshBasicMaterial color={CONFIG.centerGold.color} />
      </mesh>
      
      {/* 周围光晕 */}
      <mesh position={[0, 0, -0.1]}>
        <circleGeometry args={[CONFIG.centerGold.glowSize, 32]} />
        <meshBasicMaterial color={CONFIG.centerGold.glowColor} transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

/**
 * 风暴外圈 - 狂乱旋转的粒子云
 */
function StormVortex() {
  // 1500 颗粒子,每颗有:
  //   - angle: 当前角度
  //   - radius: 距离中心的半径(最小 8,最大 35)
  //   - speed: 旋转速度(略有差异)
  //   - color: 由内向外从 #581C87 渐变到 #3B0764
  //   - size: 粒子大小
  
  const particlesData = useRef<{ angle: number; radius: number; speed: number }[]>([]);
  
  useMemo(() => {
    particlesData.current = [];
    for (let i = 0; i < CONFIG.outerStorm.particleCount; i++) {
      particlesData.current.push({
        angle: Math.random() * Math.PI * 2,
        radius: CONFIG.outerStorm.minRadius + 
          Math.random() * (CONFIG.outerStorm.maxRadius - CONFIG.outerStorm.minRadius),
        speed: CONFIG.outerStorm.rotationSpeed * (0.8 + Math.random() * 0.4),
      });
    }
  }, []);
  
  // 颜色:每颗粒子根据其 radius 计算颜色
  // radius 接近 8 → innerColor (#581C87)
  // radius 接近 35 → outerColor (#3B0764)
  
  useFrame((state, delta) => {
    const now = state.clock.elapsedTime;
    
    // 检查是否在加速冲击中
    const cyclePosition = now % CONFIG.outerStorm.pulseCycle;
    const isInPulse = cyclePosition < CONFIG.outerStorm.pulseDuration;
    const speedMultiplier = isInPulse ? CONFIG.outerStorm.pulseSpeedMultiplier : 1;
    
    particlesData.current.forEach(p => {
      // 旋转
      const rotationRad = (p.speed * Math.PI / 180) * delta * speedMultiplier;
      p.angle += rotationRad;
      
      // 略带螺旋(粒子向中心微微靠近,但不到 minRadius)
      // 实际不要让粒子真的向中心移动,会破坏视觉
      // 这里的"螺旋"只是粒子轨迹的稍微弯曲,通过 angle 和 radius 的微小关联实现
    });
    
    // 更新所有粒子的世界坐标
    // x = cos(angle) * radius
    // y = sin(angle) * radius
  });
}
```

---

## 第三部分 · 将 5 个组件集成到主入口

### 文件:`src/components/oracle/glyph-backs/index.ts`

```typescript
export { DivineTailwindBack } from './DivineTailwindBack';
export { FairSkyBack } from './FairSkyBack';
export { StillWaterBack } from './StillWaterBack';
export { CrosswindBack } from './CrosswindBack';
export { EyeOfStormBack } from './EyeOfStormBack';

export type GlyphLevel = 
  | 'divine_tailwind' 
  | 'fair_sky' 
  | 'still_water' 
  | 'crosswind' 
  | 'eye_of_storm';

export const GlyphBackComponents = {
  divine_tailwind: DivineTailwindBack,
  fair_sky: FairSkyBack,
  still_water: StillWaterBack,
  crosswind: CrosswindBack,
  eye_of_storm: EyeOfStormBack,
} as const;
```

### 使用方式

```tsx
import { GlyphBackComponents, type GlyphLevel } from '@/components/oracle/glyph-backs';

function CardBackContainer({ level }: { level: GlyphLevel }) {
  const BackComponent = GlyphBackComponents[level];
  return <BackComponent />;
}
```

---

## 第四部分 · 测试和自检清单

### 视觉自检(每张卡都要过)

```
□ 卡片背面是 9:16 比例?
□ 中心图案在画面中心(不偏移)?
□ 颜色与文档参数一致?
□ 动画流畅(60fps,可在 Chrome DevTools Performance 面板看)?
□ 粒子边缘是软边(不是硬边)?
□ 整体感觉精美(不是"代码玩具")?
□ 在手机屏幕看是否仍然精美?
□ 5 张排在一起是否有视觉一致性?
```

### 性能自检

```
□ 桌面端 Chrome 60fps 稳定?
□ 移动端 Safari 30fps 以上?
□ 粒子总数符合性能分级?
  - high: 1.0x
  - mid: 0.5x
  - low: 0.25x
□ 没有内存泄漏(useFrame 里清理引用)?
□ Canvas 在卡片卸载时正确销毁?
```

### 代码质量自检

```
□ 没有 // TODO 占位?
□ 所有类型严格(no any)?
□ 用了 useMemo 缓存重计算?
□ useFrame 内部没有创建新对象(性能!)?
□ ShaderMaterial 用 useMemo 缓存?
□ 文件大小合理(每张组件 < 400 行)?
```

### 与用户确认的方式

每张卡片做完后,让 Cursor:

1. 截图当前效果(静态)
2. 录制 5 秒动画 GIF(展示动画效果)
3. 给我看以下对比:
   - 文档中的参数描述
   - 实际实现的视觉
4. 等待我确认"通过"或"调整 X 部分"

---

## 第五部分 · 给 Cursor 的最终指令

**当 Cursor 收到这份文档,必须按以下顺序工作**:

```
步骤 1:阅读全部文档,理解 5 张卡片的统一性和差异性
步骤 2:先实现共用部分:
        - shared/shaders/(GLSL 文件)
        - shared/BackgroundGradient.tsx
        - shared/ParticleRing.tsx
步骤 3:实现第 1 张:DivineTailwindBack.tsx
        - 完成后截图给用户
        - 等用户确认通过,再做下一张
步骤 4:依次完成 FairSkyBack / StillWaterBack / CrosswindBack / EyeOfStormBack
        - 每张完成都要截图确认
步骤 5:实现 index.ts 导出和测试页面
步骤 6:全部测试(性能 + 视觉 + 一致性)
```

**Cursor 不可以做的事**:

```
❌ 不可以"优化"颜色参数
❌ 不可以减少粒子数量(除非是性能分级)
❌ 不可以改变粒子分布算法
❌ 不可以"简化"动画(因为感觉太复杂)
❌ 不可以擅自加新视觉元素(除非用户要求)
```

**Cursor 可以做的事**:

```
✅ 修复明显的 bug
✅ 在不改视觉的前提下重构代码结构
✅ 加 TypeScript 类型
✅ 加性能优化(useMemo, useCallback)
✅ 在不确定时主动询问用户
```

---

## 第六部分 · 视觉调整流程

如果某张卡片做完后用户觉得不够精美:

```
用户反馈:
  "Divine Tailwind 看起来不够精美,莲花太散了"

Cursor 应该:
  1. 不要重写组件
  2. 根据用户描述,调整对应参数:
     - 比如增加 particlesPerPetal 从 100 → 150
     - 比如减少花瓣展开角度
  3. 截图给用户看新效果
  4. 等待"通过"或继续调整

如果调整 3 轮后用户仍不满意:
  Cursor 应该说:
  "我已经调整了 3 次,可能需要重新设计这张卡片的视觉概念。
   是否需要重新讨论 Divine Tailwind 的设计方案?"
```

---

## 附录 · 完整 Mock 测试页面

为了让你能看到 5 张卡片背面的效果,创建一个测试页面:

### 文件:`src/app/(dev)/oracle-cards-preview/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { 
  DivineTailwindBack,
  FairSkyBack,
  StillWaterBack,
  CrosswindBack,
  EyeOfStormBack,
} from '@/components/oracle/glyph-backs';

const CARDS = [
  { name: 'Divine Tailwind (5%)',  Component: DivineTailwindBack },
  { name: 'Fair Sky (25%)',         Component: FairSkyBack },
  { name: 'Still Water (40%)',      Component: StillWaterBack },
  { name: 'Crosswind (25%)',        Component: CrosswindBack },
  { name: 'Eye of Storm (5%)',      Component: EyeOfStormBack },
];

export default function OracleCardsPreviewPage() {
  return (
    <div className="min-h-screen bg-black p-8">
      <h1 className="text-white text-2xl mb-8">
        Oracle Glyph Backs Preview - All 5 Levels
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {CARDS.map(({ name, Component }) => (
          <div key={name} className="space-y-2">
            <div className="text-white text-sm">{name}</div>
            <div className="w-full max-w-[280px]">
              <Component />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

访问 `http://localhost:3000/oracle-cards-preview` 即可看到 5 张卡片同时渲染的预览。

---

✦

**这份文档完整描述了 5 张卡片背面的代码实现方式。Cursor 读完后应该可以直接编写,无需创造性决策。**
