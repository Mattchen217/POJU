/**
 * Same sky as public/v2-landing.html ANIMATION_41 (shader copied verbatim).
 * A second 2D canvas stands by: Spline can steal the WebGL context and Chrome
 * then paints that canvas white — hide it and keep drawing the same field in 2D.
 */

const VS = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FS = `precision highp float;
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

function fract(x: number): number {
  return x - Math.floor(x);
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

type GlState = {
  gl: WebGLRenderingContext;
  prog: WebGLProgram;
  uTime: WebGLUniformLocation | null;
  uRes: WebGLUniformLocation | null;
  uMouse: WebGLUniformLocation | null;
};

function bootWebGL(canvas: HTMLCanvasElement): GlState | null {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: "low-power",
    failIfMajorPerformanceCaveat: false,
  }) as WebGLRenderingContext | null;
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VS);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(prog, "a_position");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

  return {
    gl,
    prog,
    uTime: gl.getUniformLocation(prog, "u_time"),
    uRes: gl.getUniformLocation(prog, "u_resolution"),
    uMouse: gl.getUniformLocation(prog, "u_mouse"),
  };
}

/** Same hash as the landing fragment shader — dense 1px stars. */
function bakeStarLayer(w: number, h: number): HTMLCanvasElement {
  const layer = document.createElement("canvas");
  layer.width = w;
  layer.height = h;
  const ctx = layer.getContext("2d");
  if (!ctx) return layer;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y += 1) {
    const uvy = 1 - (y + 0.5) / h;
    for (let x = 0; x < w; x += 1) {
      const uvx = (x + 0.5) / w;
      const n = fract(Math.sin(uvx * 12.9898 + uvy * 78.233) * 43758.5453);
      const stars = n ** 100 * 0.5;
      const i = (y * w + x) * 4;
      const v = stars * 255;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return layer;
}

function paint2d(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  stars: HTMLCanvasElement,
  timeMs: number,
  uvMouseX: number,
  uvMouseY: number,
  freezeTime: boolean,
): void {
  const w = canvas.width;
  const h = canvas.height;
  const t = freezeTime ? 0 : timeMs * 0.001 * 0.2;

  const wave =
    (Math.sin(0.5 * 5 + t) * 0.5 + 0.5) * (Math.cos(0.5 * 3 - t * 0.5) * 0.5 + 0.5);
  const mixAmt = wave * 0.3;
  const r = (0.06 + 0.06 * mixAmt) * 255;
  const g = (0.08 + 0.07 * mixAmt) * 255;
  const b = (0.1 + 0.1 * mixAmt) * 255;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(stars, 0, 0, w, h);

  ctx.save();
  ctx.scale(w, h);
  const glow = ctx.createRadialGradient(uvMouseX, 1 - uvMouseY, 0, uvMouseX, 1 - uvMouseY, 0.3);
  glow.addColorStop(0, "rgba(212, 176, 56, 0.10)");
  glow.addColorStop(1, "rgba(212, 176, 56, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1, 1);
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
}

export type LandingStarfieldCanvases = {
  webgl: HTMLCanvasElement;
  fallback: HTMLCanvasElement;
};

export function startLandingStarfield({ webgl, fallback }: LandingStarfieldCanvases): () => void {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mouseUv = { x: 0.5, y: 0.5 };
  const mousePx = { x: 0, y: 0 };

  let glState: GlState | null = null;
  let starLayer: HTMLCanvasElement | null = null;
  let mode: "webgl" | "2d" = "webgl";
  let raf = 0;
  let alive = true;

  const ctx2d = fallback.getContext("2d", { alpha: false });

  function sizeCanvas(canvas: HTMLCanvasElement): boolean {
    const w = Math.max(2, Math.floor(canvas.clientWidth || 1280));
    const h = Math.max(2, Math.floor(canvas.clientHeight || 720));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      return true;
    }
    return false;
  }

  function syncSize(): void {
    const resized = sizeCanvas(webgl) || sizeCanvas(fallback);
    mousePx.x = mouseUv.x * webgl.width;
    mousePx.y = mouseUv.y * webgl.height;
    if (resized) starLayer = null;
  }

  function showWebgl(on: boolean): void {
    webgl.style.visibility = on ? "visible" : "hidden";
    fallback.style.visibility = on ? "hidden" : "visible";
  }

  function initGl(): boolean {
    glState = bootWebGL(webgl);
    if (!glState) {
      mode = "2d";
      showWebgl(false);
      return false;
    }
    mode = "webgl";
    showWebgl(true);
    return true;
  }

  function onLost(event: Event): void {
    event.preventDefault();
    glState = null;
    mode = "2d";
    showWebgl(false);
  }

  function paint(now: number): void {
    if (!alive) return;
    syncSize();
    if (mode === "webgl" && glState) {
      const { gl } = glState;
      gl.viewport(0, 0, webgl.width, webgl.height);
      gl.useProgram(glState.prog);
      if (glState.uTime) gl.uniform1f(glState.uTime, reduceMotion ? 0 : now * 0.001);
      if (glState.uRes) gl.uniform2f(glState.uRes, webgl.width, webgl.height);
      if (glState.uMouse) gl.uniform2f(glState.uMouse, mousePx.x, mousePx.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return;
    }
    if (!ctx2d) return;
    if (!starLayer || starLayer.width !== fallback.width || starLayer.height !== fallback.height) {
      starLayer = bakeStarLayer(fallback.width, fallback.height);
    }
    paint2d(ctx2d, fallback, starLayer, now, mouseUv.x, mouseUv.y, reduceMotion);
  }

  function shouldRun(): boolean {
    return !document.hidden;
  }

  function loop(now: number): void {
    if (!alive) return;
    raf = 0;
    if (!shouldRun()) return;
    paint(now);
    raf = requestAnimationFrame(loop);
  }

  function kick(): void {
    if (!alive || raf) return;
    if (!shouldRun()) {
      paint(performance.now());
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  const onMove = (event: MouseEvent) => {
    const rect = (mode === "webgl" ? webgl : fallback).getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    mouseUv.x = (event.clientX - rect.left) / rect.width;
    mouseUv.y = 1 - (event.clientY - rect.top) / rect.height;
    mousePx.x = mouseUv.x * webgl.width;
    mousePx.y = mouseUv.y * webgl.height;
  };

  const onVisibility = () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else {
      kick();
    }
  };

  syncSize();
  initGl();
  webgl.addEventListener("webglcontextlost", onLost, false);
  webgl.addEventListener("webglcontextrestored", () => {
    if (initGl()) kick();
  });
  window.addEventListener("mousemove", onMove, { passive: true });
  window.addEventListener("pointerdown", onMove, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  const ro =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => paint(performance.now())) : null;
  ro?.observe(webgl.parentElement ?? webgl);

  paint(performance.now());
  kick();

  return () => {
    alive = false;
    if (raf) cancelAnimationFrame(raf);
    webgl.removeEventListener("webglcontextlost", onLost, false);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("pointerdown", onMove);
    document.removeEventListener("visibilitychange", onVisibility);
    ro?.disconnect();
  };
}
