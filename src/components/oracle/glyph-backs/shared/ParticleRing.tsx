import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import particleVert from "./shaders/particle.vert";
import particleFrag from "./shaders/particle.frag";

export interface RingConfig {
  radius: number; // 环半径(单位是相机视野单位)
  particleCount: number; // 粒子数
  color: string; // 主色 hex
  rotationSpeed: number; // 度/秒,正值顺时针,负值逆时针
  particleSize: number; // 粒子尺寸
  opacity: number; // 整体不透明度
  hasGaps?: boolean; // 是否有间隙(Crosswind 用)
  gapCount?: number; // 间隙数量
  goldDots?: boolean; // 是否有金色装饰点(Eye of Storm 用)
  goldDotInterval?: number; // 每隔多少颗有一个金点
}

export function ParticleRing({ config }: { config: RingConfig }) {
  const meshRef = useRef<THREE.Points>(null);

  const { positions, colors, sizes, opacities } = useMemo(() => {
    const positions = new Float32Array(config.particleCount * 3);
    const colors = new Float32Array(config.particleCount * 3);
    const sizes = new Float32Array(config.particleCount);
    const opacities = new Float32Array(config.particleCount);

    const baseColor = new THREE.Color(config.color);
    const goldColor = new THREE.Color("#FFD700");

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
      const isGoldDot =
        config.goldDots &&
        config.goldDotInterval &&
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

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: {
            value: typeof window !== "undefined" ? window.devicePixelRatio : 1,
          },
        },
        vertexShader: particleVert,
        fragmentShader: particleFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

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

