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

