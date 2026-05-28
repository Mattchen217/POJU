/**
 * Forward document pointer / touch coordinates to a Spline canvas so
 * editor "Follow" interactions work on mobile (not only desktop hover).
 */
export function forwardPointerToSplineCanvas(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  type: "pointermove" | "pointerdown" | "pointerup" = "pointermove",
): void {
  const init: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    buttons: type === "pointerdown" ? 1 : 0,
  };
  canvas.dispatchEvent(new PointerEvent(type, init));
  canvas.dispatchEvent(
    new MouseEvent(type.replace("pointer", "mouse") as "mousemove" | "mousedown" | "mouseup", {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
    }),
  );
}

export function bindSplinePointerBridge(
  root: HTMLElement | null,
  options?: { passive?: boolean },
): () => void {
  if (!root || typeof window === "undefined") return () => undefined;

  const send = (clientX: number, clientY: number, type: "pointermove" | "pointerdown" | "pointerup") => {
    const canvas = root.querySelector("canvas");
    if (!canvas) return;
    forwardPointerToSplineCanvas(canvas, clientX, clientY, type);
  };

  const onPointerMove = (e: PointerEvent) => send(e.clientX, e.clientY, "pointermove");
  const onTouchMove = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    send(t.clientX, t.clientY, "pointermove");
  };

  const passive = options?.passive ?? true;
  window.addEventListener("pointermove", onPointerMove, { passive });
  window.addEventListener("touchmove", onTouchMove, { passive });
  return () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("touchmove", onTouchMove);
  };
}
