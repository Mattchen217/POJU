"use client";

import { useEffect, useRef } from "react";

/**
 * Port of public/v2-landing.html WebGL starfield + mouse gold glow.
 * Falls back silently when WebGL is unavailable.
 */
export function WorkspaceStarfieldLayer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const maybeCanvas = canvasRef.current;
    if (!maybeCanvas) return;
    const canvas: HTMLCanvasElement = maybeCanvas;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function syncSize() {
      const w = canvas.clientWidth || 1280;
      const h = canvas.clientHeight || 720;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncSize) : null;
    ro?.observe(canvas);
    syncSize();

    const maybeGl =
      canvas.getContext("webgl", { alpha: false, antialias: false }) ||
      canvas.getContext("experimental-webgl", { alpha: false, antialias: false });
    if (!maybeGl || !(maybeGl instanceof WebGLRenderingContext)) {
      return () => ro?.disconnect();
    }
    const gl: WebGLRenderingContext = maybeGl;

    const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
    const fs = `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec2 m = u_mouse / u_resolution;

    float strength = 0.5;
    float t = u_time * 0.2;

    vec3 color1 = vec3(0.06, 0.08, 0.1);
    vec3 color2 = vec3(0.12, 0.15, 0.2);
    vec3 gold = vec3(0.83, 0.69, 0.22);

    float n = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
    float stars = pow(n, 100.0) * strength;

    float wave = sin(uv.x * 5.0 + t) * 0.5 + 0.5;
    wave *= cos(uv.y * 3.0 - t * 0.5) * 0.5 + 0.5;

    vec3 finalColor = mix(color1, color2, wave * 0.3);

    float dist = length(uv - m);
    float glow = smoothstep(0.3, 0.0, dist) * 0.1;
    finalColor += gold * glow;

    finalColor += vec3(stars);

    gl_FragColor = vec4(finalColor, 1.0);
}`;

    function compile(type: number, src: string): WebGLShader | null {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        gl.deleteShader(s);
        return null;
      }
      return s;
    }

    const prog = gl.createProgram();
    if (!prog) return () => ro?.disconnect();
    const vsh = compile(gl.VERTEX_SHADER, vs);
    const fsh = compile(gl.FRAGMENT_SHADER, fs);
    if (!vsh || !fsh) return () => ro?.disconnect();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      return () => ro?.disconnect();
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "u_time");
    const uRes = gl.getUniformLocation(prog, "u_resolution");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");

    let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
    const onMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = (event.clientX - rect.left) / rect.width;
      const ny = 1.0 - (event.clientY - rect.top) / rect.height;
      mouse = { x: nx * canvas.width, y: ny * canvas.height };
    };
    window.addEventListener("mousemove", onMove);

    let raf = 0;
    let alive = true;

    function render(t: number) {
      if (!alive) return;
      if (!ro) syncSize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, reduceMotion ? 0 : t * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!reduceMotion) {
        raf = requestAnimationFrame(render);
      }
    }
    render(0);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      ro?.disconnect();
    };
  }, []);

  return (
    <div className="workspace-shell__starfield" aria-hidden>
      <canvas ref={canvasRef} className="workspace-shell__starfield-canvas" />
    </div>
  );
}
