# Oracle 卡片背面 · 剩余 4 张完整代码

> **本文档是 `oracle-glyph-backs-implementation.md` 的补充**
>
> 主文档已包含 Divine Tailwind 的完整代码和共用组件(BackgroundGradient, ParticleRing, shaders)。
>
> 本文档提供其余 4 张卡片背面的**完整可粘贴代码**:
> - FairSkyBack.tsx
> - StillWaterBack.tsx
> - CrosswindBack.tsx
> - EyeOfStormBack.tsx
>
> Cursor 读完主文档后,直接照本文档写代码即可,无需做创造性决策。

---

## 卡片 2 · FairSkyBack.tsx 完整代码

```tsx
// src/components/oracle/glyph-backs/FairSkyBack.tsx
'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { BackgroundGradient } from './shared/BackgroundGradient';
import { ParticleRing } from './shared/ParticleRing';
import particleVert from './shared/shaders/particle.vert';
import particleFrag from './shared/shaders/particle.frag';

const CONFIG = {
  background: {
    topColor: '#1F1640',
    bottomColor: '#0B0815',
  },
  bird: {
    bodyParticles: 60,
    leftWingParticles: 100,
    rightWingParticles: 100,
    tailParticles: 40,
    headParticles: 30,
    color: '#A78BFA',
    highlightColor: '#C4B5FD',
    flapCycle: 6,
    flapAmplitude: 0.8,
    centerX: -1,
    centerY: -1,
    rotation: 25,
    scale: 1.0,
  },
  trail: {
    count: 60,
    fadeTime: 5,
    color: '#A78BFA',
    spawnRate: 12,        // 粒子/秒
  },
  cloudFlow: {
    count: 500,
    speed: 18,
    flowAngleDegrees: 135,
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

/**
 * 飞鸟组件 - 用 4 段贝塞尔曲线定义鸟形,粒子沿曲线分布
 */
function Bird() {
  const groupRef = useRef<THREE.Group>(null);
  const wingsRef = useRef<THREE.Points>(null);
  
  // 鸟身曲线(尾→身→头)
  const bodyCurve = useMemo(() => 
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-3, -1, 0),  // 尾
      new THREE.Vector3(0, 0, 0),    // 身体中段
      new THREE.Vector3(3, 1, 0)     // 头
    ), []);
  
  // 左翅曲线(身体中段→翅尖)
  const leftWingCurve = useMemo(() => 
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-2, 1.5, 0),
      new THREE.Vector3(-4.5, 2.5, 0)
    ), []);
  
  // 右翅曲线
  const rightWingCurve = useMemo(() => 
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(2, 1.5, 0),
      new THREE.Vector3(4.5, 2.5, 0)
    ), []);
  
  // 计算所有粒子位置(身体 + 双翅)
  const { positions, colors, sizes, opacities, wingIndices } = useMemo(() => {
    const total = CONFIG.bird.bodyParticles + 
                  CONFIG.bird.leftWingParticles + 
                  CONFIG.bird.rightWingParticles +
                  CONFIG.bird.tailParticles;
    
    const positions = new Float32Array(total * 3);
    const colors = new Float32Array(total * 3);
    const sizes = new Float32Array(total);
    const opacities = new Float32Array(total);
    const wingIndices: number[] = []; // 记录哪些粒子属于翅膀(用于扇翅动画)
    
    const baseColor = new THREE.Color(CONFIG.bird.color);
    const highlight = new THREE.Color(CONFIG.bird.highlightColor);
    
    let idx = 0;
    
    // 鸟身粒子
    for (let i = 0; i < CONFIG.bird.bodyParticles; i++) {
      const t = i / (CONFIG.bird.bodyParticles - 1);
      const point = bodyCurve.getPointAt(t);
      
      // 加微小随机抖动,让粒子不显得机械
      positions[idx * 3] = point.x + (Math.random() - 0.5) * 0.3;
      positions[idx * 3 + 1] = point.y + (Math.random() - 0.5) * 0.3;
      positions[idx * 3 + 2] = 0;
      
      // 头部用高亮色
      const isHead = t > 0.85;
      const c = isHead ? highlight : baseColor;
      colors[idx * 3] = c.r;
      colors[idx * 3 + 1] = c.g;
      colors[idx * 3 + 2] = c.b;
      
      sizes[idx] = isHead ? 2.5 : 1.8;
      opacities[idx] = 0.9;
      idx++;
    }
    
    // 尾巴粒子(从尾向后扩散)
    for (let i = 0; i < CONFIG.bird.tailParticles; i++) {
      const t = Math.random();
      const distance = t * 1.5;
      const angle = Math.PI + (Math.random() - 0.5) * 0.5; // 朝后扩散
      
      positions[idx * 3] = -3 + Math.cos(angle) * distance;
      positions[idx * 3 + 1] = -1 + Math.sin(angle) * distance;
      positions[idx * 3 + 2] = 0;
      
      colors[idx * 3] = baseColor.r;
      colors[idx * 3 + 1] = baseColor.g;
      colors[idx * 3 + 2] = baseColor.b;
      
      sizes[idx] = 1.2;
      opacities[idx] = 0.7 - t * 0.4;
      idx++;
    }
    
    // 左翅粒子
    for (let i = 0; i < CONFIG.bird.leftWingParticles; i++) {
      const t = i / (CONFIG.bird.leftWingParticles - 1);
      const point = leftWingCurve.getPointAt(t);
      
      // 翅膀宽度变化(中段最厚,翅尖最薄)
      const widthFactor = Math.sin(t * Math.PI) * 0.6;
      const lateral = (Math.random() - 0.5) * widthFactor;
      
      positions[idx * 3] = point.x + lateral;
      positions[idx * 3 + 1] = point.y + (Math.random() - 0.5) * 0.3;
      positions[idx * 3 + 2] = 0;
      
      colors[idx * 3] = baseColor.r;
      colors[idx * 3 + 1] = baseColor.g;
      colors[idx * 3 + 2] = baseColor.b;
      
      sizes[idx] = 1.5 - t * 0.5;
      opacities[idx] = 0.8 - t * 0.2;
      
      wingIndices.push(idx);
      idx++;
    }
    
    // 右翅粒子
    for (let i = 0; i < CONFIG.bird.rightWingParticles; i++) {
      const t = i / (CONFIG.bird.rightWingParticles - 1);
      const point = rightWingCurve.getPointAt(t);
      
      const widthFactor = Math.sin(t * Math.PI) * 0.6;
      const lateral = (Math.random() - 0.5) * widthFactor;
      
      positions[idx * 3] = point.x + lateral;
      positions[idx * 3 + 1] = point.y + (Math.random() - 0.5) * 0.3;
      positions[idx * 3 + 2] = 0;
      
      colors[idx * 3] = baseColor.r;
      colors[idx * 3 + 1] = baseColor.g;
      colors[idx * 3 + 2] = baseColor.b;
      
      sizes[idx] = 1.5 - t * 0.5;
      opacities[idx] = 0.8 - t * 0.2;
      
      wingIndices.push(idx);
      idx++;
    }
    
    return { positions, colors, sizes, opacities, wingIndices };
  }, [bodyCurve, leftWingCurve, rightWingCurve]);
  
  // 缓存原始 Y 位置(用于扇翅动画)
  const originalY = useMemo(() => {
    const arr = new Float32Array(positions.length / 3);
    for (let i = 0; i < arr.length; i++) {
      arr[i] = positions[i * 3 + 1];
    }
    return arr;
  }, [positions]);
  
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
    if (!wingsRef.current) return;
    
    const t = state.clock.elapsedTime;
    const flapPhase = (t % CONFIG.bird.flapCycle) / CONFIG.bird.flapCycle;
    const wingOffset = Math.sin(flapPhase * Math.PI * 2) * CONFIG.bird.flapAmplitude;
    
    const positionAttr = wingsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const positions = positionAttr.array as Float32Array;
    
    // 只更新翅膀粒子的 Y 位置
    wingIndices.forEach(i => {
      // 翅膀根部(靠近身体)波动小,翅尖波动大
      const wingT = Math.abs(positions[i * 3]) / 5; // X 距离身体的归一化距离
      positions[i * 3 + 1] = originalY[i] + wingOffset * wingT;
    });
    
    positionAttr.needsUpdate = true;
  });
  
  return (
    <group 
      ref={groupRef} 
      position={[CONFIG.bird.centerX, CONFIG.bird.centerY, 0]}
      rotation={[0, 0, (CONFIG.bird.rotation * Math.PI) / 180]}
      scale={[CONFIG.bird.scale, CONFIG.bird.scale, CONFIG.bird.scale]}
    >
      <points ref={wingsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
          <bufferAttribute attach="attributes-aOpacity" args={[opacities, 1]} />
        </bufferGeometry>
        <primitive object={material} attach="material" />
      </points>
    </group>
  );
}

/**
 * 鸟尾拖尾粒子 - 持续从鸟尾生成,5 秒后淡出
 */
function BirdTrail() {
  const meshRef = useRef<THREE.Points>(null);
  const particles = useRef<{ x: number; y: number; vx: number; vy: number; bornTime: number }[]>([]);
  const lastSpawnRef = useRef(0);
  
  const positions = useMemo(() => new Float32Array(CONFIG.trail.count * 3), []);
  const colors = useMemo(() => {
    const arr = new Float32Array(CONFIG.trail.count * 3);
    const c = new THREE.Color(CONFIG.trail.color);
    for (let i = 0; i < CONFIG.trail.count; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, []);
  const sizes = useMemo(() => {
    const arr = new Float32Array(CONFIG.trail.count);
    for (let i = 0; i < CONFIG.trail.count; i++) arr[i] = 1.5;
    return arr;
  }, []);
  const opacities = useMemo(() => new Float32Array(CONFIG.trail.count), []);
  
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
    
    const now = state.clock.elapsedTime;
    
    // 按 spawnRate 生成新粒子
    if (now - lastSpawnRef.current > 1 / CONFIG.trail.spawnRate) {
      lastSpawnRef.current = now;
      if (particles.current.length < CONFIG.trail.count) {
        // 在鸟尾位置生成
        particles.current.push({
          x: -4,
          y: -2,
          vx: -0.3 - Math.random() * 0.3,  // 向左飘
          vy: -0.2 - Math.random() * 0.2,  // 微微向下
          bornTime: now,
        });
      }
    }
    
    // 更新所有粒子
    particles.current = particles.current.filter(p => {
      const age = now - p.bornTime;
      if (age > CONFIG.trail.fadeTime) return false;
      
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      
      return true;
    });
    
    // 更新 buffer
    for (let i = 0; i < CONFIG.trail.count; i++) {
      const p = particles.current[i];
      if (p) {
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = 0;
        const age = now - p.bornTime;
        opacities[i] = (1 - age / CONFIG.trail.fadeTime) * 0.7;
      } else {
        opacities[i] = 0;
      }
    }
    
    (meshRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (meshRef.current.geometry.attributes.aOpacity as THREE.BufferAttribute).needsUpdate = true;
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
 * 云流背景 - 从左上向右下飘动的粒子
 */
function CloudFlow() {
  const meshRef = useRef<THREE.Points>(null);
  
  // 流动方向向量
  const flowVector = useMemo(() => {
    const angleRad = (CONFIG.cloudFlow.flowAngleDegrees * Math.PI) / 180;
    // 注意:135° 在数学坐标中是左上,但我们想要从左上→右下飘
    // 所以反转方向
    return {
      x: Math.cos(angleRad) * CONFIG.cloudFlow.speed,    // -0.707 * speed (向左? 不对)
      y: -Math.sin(angleRad) * CONFIG.cloudFlow.speed,   // 修正:向下为负 Y
    };
    // 实际为简单起见,直接用:
    // x: speed * 0.7  (向右)
    // y: -speed * 0.7 (向下)
  }, []);
  
  // 修正后的流动方向
  const flow = useMemo(() => ({
    x: CONFIG.cloudFlow.speed * 0.5,    // 向右下
    y: -CONFIG.cloudFlow.speed * 0.5,
  }), []);
  
  const particles = useRef<{ x: number; y: number; size: number; opacity: number }[]>([]);
  
  useMemo(() => {
    particles.current = [];
    for (let i = 0; i < CONFIG.cloudFlow.count; i++) {
      particles.current.push({
        x: (Math.random() - 0.5) * 80,
        y: (Math.random() - 0.5) * 100,
        size: CONFIG.cloudFlow.sizeMin + Math.random() * (CONFIG.cloudFlow.sizeMax - CONFIG.cloudFlow.sizeMin),
        opacity: CONFIG.cloudFlow.opacityMin + Math.random() * (CONFIG.cloudFlow.opacityMax - CONFIG.cloudFlow.opacityMin),
      });
    }
  }, []);
  
  const positions = useMemo(() => new Float32Array(CONFIG.cloudFlow.count * 3), []);
  const colors = useMemo(() => {
    const arr = new Float32Array(CONFIG.cloudFlow.count * 3);
    const c = new THREE.Color(CONFIG.cloudFlow.color);
    for (let i = 0; i < CONFIG.cloudFlow.count; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, []);
  const sizes = useMemo(() => {
    const arr = new Float32Array(CONFIG.cloudFlow.count);
    particles.current.forEach((p, i) => arr[i] = p.size);
    return arr;
  }, []);
  const opacities = useMemo(() => {
    const arr = new Float32Array(CONFIG.cloudFlow.count);
    particles.current.forEach((p, i) => arr[i] = p.opacity);
    return arr;
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
  
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    particles.current.forEach((p, i) => {
      p.x += flow.x * delta;
      p.y += flow.y * delta;
      
      // 飘出右下边界 → 重置到左上
      if (p.x > 40 || p.y < -50) {
        p.x = -40 + Math.random() * 10;
        p.y = 50 - Math.random() * 10;
      }
      
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = 0;
    });
    
    (meshRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
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
 * Fair Sky 主组件
 */
export function FairSkyBack() {
  return (
    <div 
      className="
        relative aspect-[9/16] w-full
        rounded-[24px] overflow-hidden
        bg-gradient-to-b from-[#1F1640] to-[#0B0815]
      "
      style={{ boxShadow: '0 0 40px rgba(167, 139, 250, 0.15)' }}
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
        <CloudFlow />
        <Bird />
        <BirdTrail />
        <ParticleRing config={CONFIG.ring} />
      </Canvas>
      
      <div className="absolute inset-0 pointer-events-none rounded-[24px]
        border-[1.5px] border-purple-400/30
        shadow-[inset_0_0_20px_rgba(167,139,250,0.1)]
      " />
    </div>
  );
}
```

---

## 卡片 3 · StillWaterBack.tsx 完整代码

```tsx
// src/components/oracle/glyph-backs/StillWaterBack.tsx
'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { BackgroundGradient } from './shared/BackgroundGradient';
import { ParticleRing } from './shared/ParticleRing';
import particleVert from './shared/shaders/particle.vert';
import particleFrag from './shared/shaders/particle.frag';

const CONFIG = {
  background: {
    topColor: '#1F1A45',
    bottomColor: '#0B0815',
  },
  ripples: {
    maxRipples: 4,
    spawnInterval: 8,
    expansionDuration: 8,
    maxRadius: 30,
    particlesPerRipple: 120,
    color: '#6366F1',
    highlightColor: '#818CF8',
  },
  centerPoint: {
    size: 0.5,
    color: '#A5B4FC',
    pulseCycle: 4,
    glowSize: 2,
  },
  bubbles: {
    count: 30,
    riseSpeed: 4,
    color: '#C7D2FE',
    sizeMin: 1,
    sizeMax: 2,
    fadeOutAtTop: 5,
  },
  ring: {
    radius: 35,
    particleCount: 40,
    color: '#6366F1',
    rotationSpeed: 6,
    particleSize: 1.5,
    opacity: 0.3,
  },
};

interface Ripple {
  bornTime: number;
}

/**
 * 涟漪系统 - 每 8 秒生成一圈,最多同时 4 圈
 */
function RippleSystem() {
  const meshRef = useRef<THREE.Points>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  
  // 总粒子数 = 最多同时存在的涟漪数 × 每圈粒子数
  const totalParticles = CONFIG.ripples.maxRipples * CONFIG.ripples.particlesPerRipple;
  
  const positions = useMemo(() => new Float32Array(totalParticles * 3), [totalParticles]);
  const colors = useMemo(() => {
    const arr = new Float32Array(totalParticles * 3);
    const c = new THREE.Color(CONFIG.ripples.color);
    for (let i = 0; i < totalParticles; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, [totalParticles]);
  const sizes = useMemo(() => {
    const arr = new Float32Array(totalParticles);
    for (let i = 0; i < totalParticles; i++) arr[i] = 1.5;
    return arr;
  }, [totalParticles]);
  const opacities = useMemo(() => new Float32Array(totalParticles), [totalParticles]);
  
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
    if (!meshRef.current) return;
    const now = state.clock.elapsedTime;
    
    // 1. 生成新涟漪
    const lastRipple = ripplesRef.current[ripplesRef.current.length - 1];
    if (!lastRipple || now - lastRipple.bornTime >= CONFIG.ripples.spawnInterval) {
      ripplesRef.current.push({ bornTime: now });
    }
    
    // 2. 移除过期涟漪
    ripplesRef.current = ripplesRef.current.filter(r => 
      now - r.bornTime < CONFIG.ripples.expansionDuration
    );
    
    // 3. 渲染所有涟漪
    let particleIdx = 0;
    
    // 先把所有 opacity 清零
    for (let i = 0; i < totalParticles; i++) {
      opacities[i] = 0;
    }
    
    ripplesRef.current.forEach((ripple) => {
      const age = now - ripple.bornTime;
      const t = age / CONFIG.ripples.expansionDuration;
      const radius = t * CONFIG.ripples.maxRadius;
      
      // 透明度:0-25% 淡入,25-75% 满,75-100% 淡出
      let opacity;
      if (t < 0.25) opacity = t / 0.25;
      else if (t < 0.75) opacity = 1;
      else opacity = (1 - t) / 0.25;
      opacity *= 0.8;
      
      // 沿圆周分布粒子
      for (let i = 0; i < CONFIG.ripples.particlesPerRipple; i++) {
        if (particleIdx >= totalParticles) break;
        
        const angle = (i / CONFIG.ripples.particlesPerRipple) * Math.PI * 2;
        // 加微小波动,让圆圈不完全机械
        const r = radius + (Math.random() - 0.5) * 0.3;
        
        positions[particleIdx * 3] = Math.cos(angle) * r;
        positions[particleIdx * 3 + 1] = Math.sin(angle) * r;
        positions[particleIdx * 3 + 2] = 0;
        
        opacities[particleIdx] = opacity;
        particleIdx++;
      }
    });
    
    (meshRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (meshRef.current.geometry.attributes.aOpacity as THREE.BufferAttribute).needsUpdate = true;
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
 * 中心点 - 永远存在,缓慢呼吸
 */
function CenterPoint() {
  const pointRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    const t = (state.clock.elapsedTime % CONFIG.centerPoint.pulseCycle) / CONFIG.centerPoint.pulseCycle;
    const intensity = 0.7 + (Math.sin(t * Math.PI * 2) * 0.5 + 0.5) * 0.3;
    
    if (pointRef.current) {
      (pointRef.current.material as THREE.MeshBasicMaterial).opacity = intensity;
    }
    if (glowRef.current) {
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = intensity * 0.4;
    }
  });
  
  return (
    <group>
      <mesh ref={glowRef} position={[0, 0, -0.1]}>
        <circleGeometry args={[CONFIG.centerPoint.glowSize, 32]} />
        <meshBasicMaterial color={CONFIG.centerPoint.color} transparent opacity={0.4} />
      </mesh>
      <mesh ref={pointRef}>
        <circleGeometry args={[CONFIG.centerPoint.size, 32]} />
        <meshBasicMaterial color={CONFIG.centerPoint.color} transparent opacity={1} />
      </mesh>
    </group>
  );
}

/**
 * 上升气泡 - 从底部缓慢升到顶部
 */
function RisingBubbles() {
  const meshRef = useRef<THREE.Points>(null);
  const particles = useRef<{ x: number; y: number; size: number }[]>([]);
  
  useMemo(() => {
    particles.current = [];
    for (let i = 0; i < CONFIG.bubbles.count; i++) {
      particles.current.push({
        x: (Math.random() - 0.5) * 60,
        y: (Math.random() - 0.5) * 80,
        size: CONFIG.bubbles.sizeMin + Math.random() * (CONFIG.bubbles.sizeMax - CONFIG.bubbles.sizeMin),
      });
    }
  }, []);
  
  const positions = useMemo(() => new Float32Array(CONFIG.bubbles.count * 3), []);
  const colors = useMemo(() => {
    const arr = new Float32Array(CONFIG.bubbles.count * 3);
    const c = new THREE.Color(CONFIG.bubbles.color);
    for (let i = 0; i < CONFIG.bubbles.count; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, []);
  const sizes = useMemo(() => {
    const arr = new Float32Array(CONFIG.bubbles.count);
    particles.current.forEach((p, i) => arr[i] = p.size);
    return arr;
  }, []);
  const opacities = useMemo(() => new Float32Array(CONFIG.bubbles.count), []);
  
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
    
    particles.current.forEach((p, i) => {
      p.y += CONFIG.bubbles.riseSpeed * delta;
      
      // 到顶部就重置到底部
      if (p.y > 50) {
        p.y = -50;
        p.x = (Math.random() - 0.5) * 60;
      }
      
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = 0;
      
      // 接近顶部淡出
      const distFromTop = 50 - p.y;
      opacities[i] = distFromTop > CONFIG.bubbles.fadeOutAtTop 
        ? 0.5 
        : (distFromTop / CONFIG.bubbles.fadeOutAtTop) * 0.5;
    });
    
    (meshRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (meshRef.current.geometry.attributes.aOpacity as THREE.BufferAttribute).needsUpdate = true;
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
 * Still Water 主组件
 */
export function StillWaterBack() {
  return (
    <div 
      className="
        relative aspect-[9/16] w-full
        rounded-[24px] overflow-hidden
        bg-gradient-to-b from-[#1F1A45] to-[#0B0815]
      "
      style={{ boxShadow: '0 0 40px rgba(99, 102, 241, 0.12)' }}
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
        <RisingBubbles />
        <RippleSystem />
        <CenterPoint />
        <ParticleRing config={CONFIG.ring} />
      </Canvas>
      
      <div className="absolute inset-0 pointer-events-none rounded-[24px]
        border-[1.5px] border-indigo-400/20
        shadow-[inset_0_0_20px_rgba(99,102,241,0.08)]
      " />
    </div>
  );
}
```

---

## 卡片 4 · CrosswindBack.tsx 完整代码

```tsx
// src/components/oracle/glyph-backs/CrosswindBack.tsx
'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { BackgroundGradient } from './shared/BackgroundGradient';
import { ParticleRing } from './shared/ParticleRing';
import particleVert from './shared/shaders/particle.vert';
import particleFrag from './shared/shaders/particle.frag';

const CONFIG = {
  background: {
    topColor: '#1A0F25',
    bottomColor: '#0B0815',
  },
  curves: {
    curve1: {
      start: { x: -8, y: -8 },
      cp1: { x: -3, y: 3 },
      end: { x: 8, y: 8 },
      particleCount: 220,
      color: '#7C3AED',
    },
    curve2: {
      start: { x: 8, y: -8 },
      cp1: { x: 3, y: 3 },
      end: { x: -8, y: 8 },
      particleCount: 220,
      color: '#A855F7',
    },
    flowSpeed: 0.15, // 沿曲线流动的速度(每秒走过曲线的比例)
  },
  intersection: {
    baseSize: 1,
    pulseSize: 1.4,
    pulseCycle: 5,
    pulseDuration: 0.5,
    color: '#D946EF',
  },
  oppositeFlow: {
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
    hasGaps: true,
    gapCount: 6,
  },
};

/**
 * 单条粒子曲线流
 */
function CurveStream({ curveConfig, flowSpeed }: { curveConfig: typeof CONFIG.curves.curve1; flowSpeed: number }) {
  const meshRef = useRef<THREE.Points>(null);
  
  const curve = useMemo(() => 
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(curveConfig.start.x, curveConfig.start.y, 0),
      new THREE.Vector3(curveConfig.cp1.x, curveConfig.cp1.y, 0),
      new THREE.Vector3(curveConfig.end.x, curveConfig.end.y, 0)
    ), [curveConfig]);
  
  const particleData = useRef<{ t: number; speedFactor: number }[]>([]);
  useMemo(() => {
    particleData.current = [];
    for (let i = 0; i < curveConfig.particleCount; i++) {
      particleData.current.push({
        t: Math.random(),
        speedFactor: 0.7 + Math.random() * 0.6,
      });
    }
  }, [curveConfig]);
  
  const positions = useMemo(() => new Float32Array(curveConfig.particleCount * 3), [curveConfig]);
  const colors = useMemo(() => {
    const arr = new Float32Array(curveConfig.particleCount * 3);
    const c = new THREE.Color(curveConfig.color);
    for (let i = 0; i < curveConfig.particleCount; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, [curveConfig]);
  const sizes = useMemo(() => {
    const arr = new Float32Array(curveConfig.particleCount);
    for (let i = 0; i < curveConfig.particleCount; i++) arr[i] = 1.8;
    return arr;
  }, [curveConfig]);
  const opacities = useMemo(() => {
    const arr = new Float32Array(curveConfig.particleCount);
    for (let i = 0; i < curveConfig.particleCount; i++) arr[i] = 0.7 + Math.random() * 0.3;
    return arr;
  }, [curveConfig]);
  
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
    
    particleData.current.forEach((p, i) => {
      p.t += flowSpeed * p.speedFactor * delta;
      if (p.t > 1) p.t -= 1;
      
      const point = curve.getPointAt(p.t);
      // 加微小垂直偏移,让粒子不完全在曲线上
      const perp = curve.getTangentAt(p.t);
      const lateralX = -perp.y * (Math.random() - 0.5) * 0.3;
      const lateralY = perp.x * (Math.random() - 0.5) * 0.3;
      
      positions[i * 3] = point.x + lateralX;
      positions[i * 3 + 1] = point.y + lateralY;
      positions[i * 3 + 2] = 0;
    });
    
    (meshRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
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
 * 中心交错点
 */
function IntersectionPoint() {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (!meshRef.current || !glowRef.current) return;
    
    const t = state.clock.elapsedTime;
    const cycle = CONFIG.intersection.pulseCycle;
    const cyclePos = t % cycle;
    
    const isInPulse = cyclePos > cycle - CONFIG.intersection.pulseDuration;
    
    if (isInPulse) {
      const pulseT = (cyclePos - (cycle - CONFIG.intersection.pulseDuration)) / CONFIG.intersection.pulseDuration;
      const sizeMultiplier = 1 + Math.sin(pulseT * Math.PI) * 
        ((CONFIG.intersection.pulseSize - CONFIG.intersection.baseSize) / CONFIG.intersection.baseSize);
      meshRef.current.scale.set(sizeMultiplier, sizeMultiplier, 1);
      glowRef.current.scale.set(sizeMultiplier, sizeMultiplier, 1);
    } else {
      meshRef.current.scale.set(1, 1, 1);
      glowRef.current.scale.set(1, 1, 1);
    }
  });
  
  return (
    <group>
      <mesh ref={glowRef} position={[0, 0, -0.05]}>
        <circleGeometry args={[CONFIG.intersection.baseSize * 2, 32]} />
        <meshBasicMaterial color={CONFIG.intersection.color} transparent opacity={0.3} />
      </mesh>
      <mesh ref={meshRef}>
        <circleGeometry args={[CONFIG.intersection.baseSize * 0.6, 32]} />
        <meshBasicMaterial color={CONFIG.intersection.color} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

/**
 * 对流背景粒子(两个相反方向的流)
 */
function OppositeFlow() {
  const leftRef = useRef<THREE.Points>(null);
  const rightRef = useRef<THREE.Points>(null);
  
  // 向右流的粒子
  const leftParticles = useRef<{ x: number; y: number }[]>([]);
  // 向左流的粒子
  const rightParticles = useRef<{ x: number; y: number }[]>([]);
  
  useMemo(() => {
    leftParticles.current = [];
    rightParticles.current = [];
    for (let i = 0; i < CONFIG.oppositeFlow.leftToRight.count; i++) {
      leftParticles.current.push({
        x: (Math.random() - 0.5) * 80,
        y: (Math.random() - 0.5) * 80,
      });
    }
    for (let i = 0; i < CONFIG.oppositeFlow.rightToLeft.count; i++) {
      rightParticles.current.push({
        x: (Math.random() - 0.5) * 80,
        y: (Math.random() - 0.5) * 80,
      });
    }
  }, []);
  
  // 创建两组 buffer
  const leftPositions = useMemo(() => new Float32Array(CONFIG.oppositeFlow.leftToRight.count * 3), []);
  const leftColors = useMemo(() => {
    const arr = new Float32Array(CONFIG.oppositeFlow.leftToRight.count * 3);
    const c = new THREE.Color(CONFIG.oppositeFlow.leftToRight.color);
    for (let i = 0; i < CONFIG.oppositeFlow.leftToRight.count; i++) {
      arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, []);
  const leftSizes = useMemo(() => {
    const arr = new Float32Array(CONFIG.oppositeFlow.leftToRight.count);
    for (let i = 0; i < CONFIG.oppositeFlow.leftToRight.count; i++) arr[i] = 1.2;
    return arr;
  }, []);
  const leftOpacities = useMemo(() => {
    const arr = new Float32Array(CONFIG.oppositeFlow.leftToRight.count);
    for (let i = 0; i < CONFIG.oppositeFlow.leftToRight.count; i++) arr[i] = CONFIG.oppositeFlow.leftToRight.opacity;
    return arr;
  }, []);
  
  const rightPositions = useMemo(() => new Float32Array(CONFIG.oppositeFlow.rightToLeft.count * 3), []);
  const rightColors = useMemo(() => {
    const arr = new Float32Array(CONFIG.oppositeFlow.rightToLeft.count * 3);
    const c = new THREE.Color(CONFIG.oppositeFlow.rightToLeft.color);
    for (let i = 0; i < CONFIG.oppositeFlow.rightToLeft.count; i++) {
      arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, []);
  const rightSizes = useMemo(() => {
    const arr = new Float32Array(CONFIG.oppositeFlow.rightToLeft.count);
    for (let i = 0; i < CONFIG.oppositeFlow.rightToLeft.count; i++) arr[i] = 1.2;
    return arr;
  }, []);
  const rightOpacities = useMemo(() => {
    const arr = new Float32Array(CONFIG.oppositeFlow.rightToLeft.count);
    for (let i = 0; i < CONFIG.oppositeFlow.rightToLeft.count; i++) arr[i] = CONFIG.oppositeFlow.rightToLeft.opacity;
    return arr;
  }, []);
  
  const leftMaterial = useMemo(() => new THREE.ShaderMaterial({
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
  
  const rightMaterial = useMemo(() => new THREE.ShaderMaterial({
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
    // 向右流
    leftParticles.current.forEach((p, i) => {
      p.x += CONFIG.oppositeFlow.leftToRight.speed * delta;
      if (p.x > 40) p.x = -40;
      leftPositions[i * 3] = p.x;
      leftPositions[i * 3 + 1] = p.y;
      leftPositions[i * 3 + 2] = 0;
    });
    if (leftRef.current) {
      (leftRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
    
    // 向左流
    rightParticles.current.forEach((p, i) => {
      p.x -= CONFIG.oppositeFlow.rightToLeft.speed * delta;
      if (p.x < -40) p.x = 40;
      rightPositions[i * 3] = p.x;
      rightPositions[i * 3 + 1] = p.y;
      rightPositions[i * 3 + 2] = 0;
    });
    if (rightRef.current) {
      (rightRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  });
  
  return (
    <>
      <points ref={leftRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[leftPositions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[leftColors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[leftSizes, 1]} />
          <bufferAttribute attach="attributes-aOpacity" args={[leftOpacities, 1]} />
        </bufferGeometry>
        <primitive object={leftMaterial} attach="material" />
      </points>
      <points ref={rightRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[rightPositions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[rightColors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[rightSizes, 1]} />
          <bufferAttribute attach="attributes-aOpacity" args={[rightOpacities, 1]} />
        </bufferGeometry>
        <primitive object={rightMaterial} attach="material" />
      </points>
    </>
  );
}

/**
 * Crosswind 主组件
 */
export function CrosswindBack() {
  return (
    <div 
      className="
        relative aspect-[9/16] w-full
        rounded-[24px] overflow-hidden
        bg-gradient-to-b from-[#1A0F25] to-[#0B0815]
      "
      style={{ boxShadow: '0 0 40px rgba(124, 58, 237, 0.15)' }}
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
        <OppositeFlow />
        <CurveStream curveConfig={CONFIG.curves.curve1} flowSpeed={CONFIG.curves.flowSpeed} />
        <CurveStream curveConfig={CONFIG.curves.curve2} flowSpeed={CONFIG.curves.flowSpeed} />
        <IntersectionPoint />
        <ParticleRing config={CONFIG.ring} />
      </Canvas>
      
      <div className="absolute inset-0 pointer-events-none rounded-[24px]
        border-[1.5px] border-purple-500/30
        shadow-[inset_0_0_20px_rgba(124,58,237,0.1)]
      " />
    </div>
  );
}
```

---

## 卡片 5 · EyeOfStormBack.tsx 完整代码

```tsx
// src/components/oracle/glyph-backs/EyeOfStormBack.tsx
'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { BackgroundGradient } from './shared/BackgroundGradient';
import { ParticleRing } from './shared/ParticleRing';
import particleVert from './shared/shaders/particle.vert';
import particleFrag from './shared/shaders/particle.frag';

const CONFIG = {
  background: {
    topColor: '#0A0420',
    bottomColor: '#0B0815',
  },
  centerGold: {
    size: 0.5,
    color: '#FBBF24',
    pulseCycle: 4,
    glowSize: 1.5,
    glowColor: '#FCD34D',
  },
  innerStillZone: {
    radius: 6,
  },
  outerStorm: {
    particleCount: 1500,
    minRadius: 8,
    maxRadius: 35,
    rotationSpeed: 60,         // 度/秒
    pulseCycle: 3,
    pulseDuration: 0.8,
    pulseSpeedMultiplier: 1.5,
    spiralFactor: 0.05,        // 螺旋系数(很小)
    innerColor: '#581C87',
    outerColor: '#3B0764',
    sizeMin: 1,
    sizeMax: 2.5,
  },
  ring: {
    radius: 38,
    particleCount: 60,
    color: '#3B0764',
    rotationSpeed: -8,
    particleSize: 1.5,
    opacity: 0.5,
    goldDots: true,
    goldDotInterval: 15,
  },
};

/**
 * 中心金点 - 永远不动 + 缓慢呼吸
 */
function CenterGoldPoint() {
  const pointRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    const t = (state.clock.elapsedTime % CONFIG.centerGold.pulseCycle) / CONFIG.centerGold.pulseCycle;
    const intensity = 0.8 + (Math.sin(t * Math.PI * 2) * 0.5 + 0.5) * 0.2;
    
    if (pointRef.current) {
      (pointRef.current.material as THREE.MeshBasicMaterial).opacity = intensity;
    }
    if (glowRef.current) {
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = intensity * 0.5;
    }
  });
  
  return (
    <group>
      <mesh ref={glowRef} position={[0, 0, -0.1]}>
        <circleGeometry args={[CONFIG.centerGold.glowSize, 32]} />
        <meshBasicMaterial color={CONFIG.centerGold.glowColor} transparent opacity={0.5} />
      </mesh>
      <mesh ref={pointRef}>
        <circleGeometry args={[CONFIG.centerGold.size, 32]} />
        <meshBasicMaterial color={CONFIG.centerGold.color} transparent opacity={1} />
      </mesh>
    </group>
  );
}

/**
 * 风暴外圈 - 狂乱旋转的粒子云
 */
function StormVortex() {
  const meshRef = useRef<THREE.Points>(null);
  
  const particlesData = useRef<{ angle: number; radius: number; speedFactor: number }[]>([]);
  
  useMemo(() => {
    particlesData.current = [];
    for (let i = 0; i < CONFIG.outerStorm.particleCount; i++) {
      particlesData.current.push({
        angle: Math.random() * Math.PI * 2,
        radius: CONFIG.outerStorm.minRadius + 
          Math.random() * (CONFIG.outerStorm.maxRadius - CONFIG.outerStorm.minRadius),
        speedFactor: 0.7 + Math.random() * 0.6,
      });
    }
  }, []);
  
  const positions = useMemo(() => new Float32Array(CONFIG.outerStorm.particleCount * 3), []);
  
  // 颜色:根据 radius 渐变
  const colors = useMemo(() => {
    const arr = new Float32Array(CONFIG.outerStorm.particleCount * 3);
    const innerColor = new THREE.Color(CONFIG.outerStorm.innerColor);
    const outerColor = new THREE.Color(CONFIG.outerStorm.outerColor);
    
    particlesData.current.forEach((p, i) => {
      const t = (p.radius - CONFIG.outerStorm.minRadius) / 
                (CONFIG.outerStorm.maxRadius - CONFIG.outerStorm.minRadius);
      const c = new THREE.Color().lerpColors(innerColor, outerColor, t);
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    });
    
    return arr;
  }, []);
  
  const sizes = useMemo(() => {
    const arr = new Float32Array(CONFIG.outerStorm.particleCount);
    for (let i = 0; i < CONFIG.outerStorm.particleCount; i++) {
      arr[i] = CONFIG.outerStorm.sizeMin + 
        Math.random() * (CONFIG.outerStorm.sizeMax - CONFIG.outerStorm.sizeMin);
    }
    return arr;
  }, []);
  
  const opacities = useMemo(() => {
    const arr = new Float32Array(CONFIG.outerStorm.particleCount);
    for (let i = 0; i < CONFIG.outerStorm.particleCount; i++) {
      arr[i] = 0.4 + Math.random() * 0.4;
    }
    return arr;
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
  
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    const now = state.clock.elapsedTime;
    
    // 加速冲击
    const cyclePos = now % CONFIG.outerStorm.pulseCycle;
    const isInPulse = cyclePos < CONFIG.outerStorm.pulseDuration;
    const speedMultiplier = isInPulse ? CONFIG.outerStorm.pulseSpeedMultiplier : 1;
    
    particlesData.current.forEach((p, i) => {
      const rotationRad = (CONFIG.outerStorm.rotationSpeed * Math.PI / 180) * 
                          delta * p.speedFactor * speedMultiplier;
      p.angle += rotationRad;
      
      // 加微小螺旋(粒子轨迹略弯)
      // 这里我们让 radius 也有轻微震荡(模拟粒子在涡流中略上下浮动)
      const radiusOffset = Math.sin(now * 2 + i * 0.1) * 0.3;
      const r = p.radius + radiusOffset;
      
      positions[i * 3] = Math.cos(p.angle) * r;
      positions[i * 3 + 1] = Math.sin(p.angle) * r;
      positions[i * 3 + 2] = 0;
    });
    
    (meshRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
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
 * Eye of Storm 主组件
 */
export function EyeOfStormBack() {
  return (
    <div 
      className="
        relative aspect-[9/16] w-full
        rounded-[24px] overflow-hidden
        bg-gradient-to-b from-[#0A0420] to-[#0B0815]
      "
      style={{ boxShadow: '0 0 40px rgba(251, 191, 36, 0.1)' }}
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
        <StormVortex />
        <CenterGoldPoint />
        <ParticleRing config={CONFIG.ring} />
      </Canvas>
      
      <div className="absolute inset-0 pointer-events-none rounded-[24px]
        border-[1.5px] border-purple-900/40
        shadow-[inset_0_0_20px_rgba(59,7,100,0.15)]
      " />
    </div>
  );
}
```

---

## 关键提醒(给 Cursor)

### 1. 为什么 4 张卡都用同一个 shader

5 张卡都用 `particle.vert` + `particle.frag`(主文档已定义),只是数据不同。
**不要为每张卡写独立的 shader**——这是浪费且会引入不一致性。

### 2. 共用文件路径

```
src/components/oracle/glyph-backs/
  shared/
    BackgroundGradient.tsx      ← 主文档已写
    ParticleRing.tsx            ← 主文档已写
    shaders/
      particle.vert             ← 主文档已写
      particle.frag             ← 主文档已写
  DivineTailwindBack.tsx        ← 主文档已写
  FairSkyBack.tsx               ← 本文档
  StillWaterBack.tsx            ← 本文档
  CrosswindBack.tsx             ← 本文档
  EyeOfStormBack.tsx            ← 本文档
  index.ts                      ← 主文档已写
```

### 3. shader 文件导入

Next.js 默认不支持直接 import .vert/.frag 文件。需要先配置:

#### `next.config.js`(添加配置)

```js
module.exports = {
  webpack(config) {
    config.module.rules.push({
      test: /\.(glsl|vert|frag)$/,
      type: 'asset/source',
    });
    return config;
  },
};
```

#### TypeScript 类型声明

创建 `src/types/glsl.d.ts`:

```typescript
declare module '*.vert' {
  const content: string;
  export default content;
}

declare module '*.frag' {
  const content: string;
  export default content;
}

declare module '*.glsl' {
  const content: string;
  export default content;
}
```

### 4. 各卡片完成后的自检

每张卡片做完后,Cursor 必须:

```
1. 在 /oracle-cards-preview 页面查看效果
2. 截图给用户
3. 自检清单:
   □ 9:16 比例正确
   □ 中心图案在画面中心
   □ 颜色与 CONFIG 中的参数一致
   □ 动画流畅(60fps)
   □ 移动端 30fps 以上
   □ 没有错误(Console 无报错)
   □ 没有内存泄漏(切换页面后 Memory 释放)
4. 等待用户确认"通过"后,做下一张
```

### 5. 性能注意

每张卡的 Canvas 都会消耗 GPU。**不要在同一页面同时渲染 5 张卡**(预览页面除外)。
实际产品中,**只渲染当前用户抽到的那一张**。

---

✦

**至此,5 张卡片背面的完整代码已全部交付。Cursor 可以照着写,不需要做任何创造性决策。**
