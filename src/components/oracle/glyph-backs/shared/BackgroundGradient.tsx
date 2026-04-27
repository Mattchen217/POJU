import { useMemo } from "react";
import * as THREE from "three";

interface BackgroundGradientProps {
  topColor?: string;
  bottomColor?: string;
}

/**
 * 卡片背景的径向渐变层(从中心向边缘变深)
 * 不是粒子,只是一个全屏 plane 加渐变
 */
export function BackgroundGradient({
  topColor = "#1A0F2E",
  bottomColor = "#0B0815",
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

