"use client";

import { useEffect, useRef, useState } from "react";

import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";

/**
 * Port of public/v2-landing.html WebGL starfield + mouse gold glow.
 * Falls back silently when WebGL is unavailable.
 *
 * Idle policy (OOM guard):
 * - Stop rAF when tab hidden, delivery book open, or no pointer for IDLE_MS
 * - Lose WebGL context after long freeze so GPU memory can reclaim
 */
const IDLE_FREEZE_MS = 45_000;
const LOSE_CONTEXT_AFTER_MS = 120_000;

/** Unmount WebGL entirely while Pivot chat / delivery is open (SPA leak / CPU guard). */
export function WorkspaceStarfieldGate() {
  const poju = useWorkspacePojuPrepareOptional();
  const [quietGpu, setQuietGpu] = useState(false);

  useEffect(() => {
    const sync = () => {
      const root = document.documentElement.dataset;
      setQuietGpu(root.wsDeliveryOpen === "1" || root.wsQuietGpu === "1");
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-ws-delivery-open", "data-ws-quiet-gpu"],
    });
    return () => obs.disconnect();
  }, []);

  const textStage = poju?.phase === "chat";
  if (quietGpu || textStage) return null;
  return <WorkspaceStarfieldLayer />;
}

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

    let gl: WebGLRenderingContext | null =
      (canvas.getContext("webgl", { alpha: false, antialias: false }) ||
        canvas.getContext("experimental-webgl", {
          alpha: false,
          antialias: false,
        })) as WebGLRenderingContext | null;
    if (!gl) {
      return () => ro?.disconnect();
    }

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

    function compile(
      ctx: WebGLRenderingContext,
      type: number,
      src: string,
    ): WebGLShader | null {
      const s = ctx.createShader(type);
      if (!s) return null;
      ctx.shaderSource(s, src);
      ctx.compileShader(s);
      if (!ctx.getShaderParameter(s, ctx.COMPILE_STATUS)) {
        ctx.deleteShader(s);
        return null;
      }
      return s;
    }

    let prog: WebGLProgram | null = null;
    let uTime: WebGLUniformLocation | null = null;
    let uRes: WebGLUniformLocation | null = null;
    let uMouse: WebGLUniformLocation | null = null;
    let glAlive = false;

    function buildGl(): boolean {
      if (!gl) return false;
      const program = gl.createProgram();
      if (!program) return false;
      const vsh = compile(gl, gl.VERTEX_SHADER, vs);
      const fsh = compile(gl, gl.FRAGMENT_SHADER, fs);
      if (!vsh || !fsh) return false;
      gl.attachShader(program, vsh);
      gl.attachShader(program, fsh);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
      gl.useProgram(program);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const pos = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
      prog = program;
      uTime = gl.getUniformLocation(program, "u_time");
      uRes = gl.getUniformLocation(program, "u_resolution");
      uMouse = gl.getUniformLocation(program, "u_mouse");
      glAlive = true;
      return true;
    }

    if (!buildGl()) {
      return () => ro?.disconnect();
    }

    let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
    let lastPointerAt = performance.now();
    let contextLost = false;

    const onMove = (event: MouseEvent) => {
      lastPointerAt = performance.now();
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = (event.clientX - rect.left) / rect.width;
      const ny = 1.0 - (event.clientY - rect.top) / rect.height;
      mouse = { x: nx * canvas.width, y: ny * canvas.height };
      if (contextLost) restoreContext();
      else kick();
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });

    let raf = 0;
    let alive = true;
    let lastPaintMs = 0;
    let loseTimer: ReturnType<typeof setTimeout> | null = null;

    function shouldAnimate(): boolean {
      if (reduceMotion) return false;
      if (document.hidden) return false;
      if (document.documentElement.dataset.wsDeliveryOpen === "1") return false;
      if (document.documentElement.dataset.wsQuietGpu === "1") return false;
      if (performance.now() - lastPointerAt > IDLE_FREEZE_MS) return false;
      return true;
    }

    function clearLoseTimer() {
      if (loseTimer) {
        clearTimeout(loseTimer);
        loseTimer = null;
      }
    }

    function loseContext() {
      if (!gl || contextLost) return;
      const ext = gl.getExtension("WEBGL_lose_context");
      ext?.loseContext();
      contextLost = true;
      glAlive = false;
      prog = null;
    }

    function restoreContext() {
      if (!contextLost) return;
      const ext = gl?.getExtension("WEBGL_lose_context");
      ext?.restoreContext();
      // getContext may return the restored context on same canvas
      gl =
        (canvas.getContext("webgl", { alpha: false, antialias: false }) ||
          canvas.getContext("experimental-webgl", {
            alpha: false,
            antialias: false,
          })) as WebGLRenderingContext | null;
      contextLost = false;
      if (gl && buildGl()) {
        kick();
      }
    }

    function scheduleLose() {
      clearLoseTimer();
      loseTimer = setTimeout(() => {
        loseTimer = null;
        if (!alive || shouldAnimate()) return;
        stopLoop();
        loseContext();
      }, LOSE_CONTEXT_AFTER_MS);
    }

    function paintFrame(t: number) {
      if (!gl || !glAlive) return;
      if (!ro) syncSize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, reduceMotion ? 0 : t * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      lastPaintMs = t;
    }

    function stopLoop() {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    function render(t: number) {
      if (!alive) return;
      raf = 0;
      if (!shouldAnimate()) {
        paintFrame(lastPaintMs || t);
        scheduleLose();
        return;
      }
      clearLoseTimer();
      paintFrame(t);
      raf = requestAnimationFrame(render);
    }

    function kick() {
      if (!alive || raf) return;
      if (contextLost) return;
      if (!shouldAnimate()) {
        paintFrame(lastPaintMs || performance.now());
        scheduleLose();
        return;
      }
      clearLoseTimer();
      raf = requestAnimationFrame(render);
    }

    const onVisibility = () => {
      if (document.hidden) {
        stopLoop();
        scheduleLose();
      } else {
        lastPointerAt = performance.now();
        if (contextLost) restoreContext();
        else kick();
      }
    };

    const attrObserver = new MutationObserver(() => {
      if (
        document.documentElement.dataset.wsDeliveryOpen === "1" ||
        document.documentElement.dataset.wsQuietGpu === "1"
      ) {
        stopLoop();
        paintFrame(lastPaintMs || performance.now());
        scheduleLose();
      } else {
        lastPointerAt = performance.now();
        if (contextLost) restoreContext();
        else kick();
      }
    });
    attrObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-ws-delivery-open", "data-ws-quiet-gpu"],
    });

    document.addEventListener("visibilitychange", onVisibility);
    kick();

    return () => {
      alive = false;
      stopLoop();
      clearLoseTimer();
      document.removeEventListener("visibilitychange", onVisibility);
      attrObserver.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("pointerdown", onMove);
      loseContext();
      ro?.disconnect();
    };
  }, []);

  return (
    <div className="workspace-shell__starfield" aria-hidden>
      <canvas ref={canvasRef} className="workspace-shell__starfield-canvas" />
    </div>
  );
}
