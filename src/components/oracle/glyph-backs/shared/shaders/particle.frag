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

