"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

type Props = {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  /**
   * Cap thumb height as a fraction of the track (e.g. 1/3 for compact lists).
   * Ignored when `fixedThumbPx` is set.
   */
  thumbMaxRatio?: number;
  /**
   * Fixed thumb length in px when the pane is scrollable.
   * Use for left / center / right so all three match visually.
   */
  fixedThumbPx?: number;
  /** Optional external ref to the scrollable viewport (e.g. chat stick-to-bottom). */
  viewportRef?: RefObject<HTMLDivElement | null>;
};

const OVERFLOW_EPS = 4;

/**
 * Unified workspace scrollbar — thin gold rectangular thumb (Eastern OS).
 * Hidden when content fits; thumb is draggable.
 */
export function WorkspaceScrollArea({
  children,
  className,
  viewportClassName,
  thumbMaxRatio,
  fixedThumbPx,
  viewportRef: viewportRefProp,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startScroll: number } | null>(null);
  const [thumb, setThumb] = useState({ top: 0, height: 0, visible: false });

  const setViewportNode = useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node;
      if (viewportRefProp) {
        viewportRefProp.current = node;
      }
    },
    [viewportRefProp],
  );

  const syncThumb = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const overflow = scrollHeight - clientHeight;
    if (overflow <= OVERFLOW_EPS || clientHeight <= 0) {
      setThumb({ top: 0, height: 0, visible: false });
      return;
    }
    const trackH = clientHeight;
    let height: number;
    if (fixedThumbPx != null) {
      height = Math.min(fixedThumbPx, Math.max(32, trackH * 0.22));
    } else {
      height = Math.max(16, (clientHeight / scrollHeight) * trackH);
      if (thumbMaxRatio != null) {
        height = Math.min(height, trackH * thumbMaxRatio);
      }
    }
    const maxTop = Math.max(0, trackH - height);
    const top = maxTop * (scrollTop / overflow);
    setThumb({ top, height, visible: true });
  }, [fixedThumbPx, thumbMaxRatio]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const run = () => {
      requestAnimationFrame(() => syncThumb());
    };

    run();
    el.addEventListener("scroll", syncThumb, { passive: true });
    const ro = new ResizeObserver(run);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", syncThumb);
      ro.disconnect();
    };
  }, [syncThumb, children]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      const el = viewportRef.current;
      if (!drag || !el) return;
      const overflow = el.scrollHeight - el.clientHeight;
      if (overflow <= OVERFLOW_EPS) return;
      const trackH = el.clientHeight;
      const thumbH = thumb.height || 52;
      const maxTop = Math.max(0, trackH - thumbH);
      if (maxTop <= 0) return;
      const deltaY = e.clientY - drag.startY;
      const scrollDelta = (deltaY / maxTop) * overflow;
      el.scrollTop = Math.min(overflow, Math.max(0, drag.startScroll + scrollDelta));
    };

    const onUp = () => {
      dragRef.current = null;
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, [thumb.height]);

  function startDrag(e: React.PointerEvent) {
    const el = viewportRef.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startY: e.clientY, startScroll: el.scrollTop };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  }

  function onRailPointerDown(e: React.PointerEvent) {
    const el = viewportRef.current;
    const rail = railRef.current;
    if (!el || !rail) return;
    if ((e.target as HTMLElement).closest(".workspace-scroll__thumb")) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = rail.getBoundingClientRect();
    const overflow = el.scrollHeight - el.clientHeight;
    if (overflow <= OVERFLOW_EPS) return;
    const thumbH = thumb.height || 52;
    const y = e.clientY - rect.top - thumbH / 2;
    const maxTop = Math.max(0, rect.height - thumbH);
    const ratio = maxTop <= 0 ? 0 : Math.min(1, Math.max(0, y / maxTop));
    el.scrollTop = ratio * overflow;
    dragRef.current = { startY: e.clientY, startScroll: el.scrollTop };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  }

  return (
    <div className={["workspace-scroll", className].filter(Boolean).join(" ")}>
      <div
        ref={setViewportNode}
        className={["workspace-scroll__viewport", viewportClassName]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
      {thumb.visible ? (
        <div
          ref={railRef}
          className="workspace-scroll__rail"
          onPointerDown={onRailPointerDown}
        >
          <div
            className="workspace-scroll__thumb"
            style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
            onPointerDown={startDrag}
            role="scrollbar"
            aria-controls={undefined}
            aria-valuenow={undefined}
          />
        </div>
      ) : null}
    </div>
  );
}
