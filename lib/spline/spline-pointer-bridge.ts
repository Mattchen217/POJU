/**
 * Forward touch / pointer coordinates to a Spline canvas so editor "Follow"
 * works on mobile (desktop already gets native hover on the canvas).
 *
 * CRITICAL: never re-dispatch a bubbling PointerEvent from a window
 * pointermove listener — that re-enters the same listener and stack-overflows
 * (Maximum call stack size exceeded × thousands in DevTools).
 */

type BridgePointerType = "pointermove" | "pointerdown" | "pointerup";

function mouseTypeFor(type: BridgePointerType): "mousemove" | "mousedown" | "mouseup" {
  if (type === "pointerdown") return "mousedown";
  if (type === "pointerup") return "mouseup";
  return "mousemove";
}

/**
 * Deliver coordinates to the canvas without re-entering window pointer listeners.
 * Uses non-bubbling MouseEvents only (Spline follow tracks mouse-style moves).
 */
export function forwardPointerToSplineCanvas(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  type: BridgePointerType = "pointermove",
): void {
  canvas.dispatchEvent(
    new MouseEvent(mouseTypeFor(type), {
      bubbles: false,
      cancelable: true,
      clientX,
      clientY,
      buttons: type === "pointerdown" ? 1 : 0,
      view: window,
    }),
  );
}

export function bindSplinePointerBridge(
  root: HTMLElement | null,
  options?: { passive?: boolean },
): () => void {
  if (!root || typeof window === "undefined") return () => undefined;

  let raf = 0;
  let pending: { x: number; y: number; type: BridgePointerType } | null = null;

  const flush = () => {
    raf = 0;
    const next = pending;
    pending = null;
    if (!next) return;
    const canvas = root.querySelector("canvas");
    if (!canvas) return;
    forwardPointerToSplineCanvas(canvas, next.x, next.y, next.type);
  };

  const send = (clientX: number, clientY: number, type: BridgePointerType) => {
    pending = { x: clientX, y: clientY, type };
    if (type === "pointermove") {
      if (raf) return;
      raf = window.requestAnimationFrame(flush);
      return;
    }
    if (raf) {
      window.cancelAnimationFrame(raf);
      raf = 0;
    }
    flush();
  };

  const onPointerMove = (e: PointerEvent) => {
    // Ignore synthetic / re-entrant events; only real user input.
    if (!e.isTrusted) return;
    // Desktop hover already hits the canvas; bridge is for touch / pen follow.
    if (e.pointerType === "mouse") return;
    send(e.clientX, e.clientY, "pointermove");
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!e.isTrusted) return;
    const t = e.touches[0];
    if (!t) return;
    send(t.clientX, t.clientY, "pointermove");
  };

  const passive = options?.passive ?? true;
  window.addEventListener("pointermove", onPointerMove, { passive });
  window.addEventListener("touchmove", onTouchMove, { passive });

  return () => {
    if (raf) window.cancelAnimationFrame(raf);
    pending = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("touchmove", onTouchMove);
  };
}
