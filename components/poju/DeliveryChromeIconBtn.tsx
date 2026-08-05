"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

type TipCoords = { top: number; left: number };

function placeTipAbove(anchor: DOMRect, tipWidth: number): TipCoords {
  const pad = 10;
  const half = tipWidth / 2;
  const ideal = anchor.left + anchor.width / 2;
  const left = Math.min(
    window.innerWidth - pad - half,
    Math.max(pad + half, ideal),
  );
  return { top: anchor.top - 10, left };
}

function useChromeTipPortal(
  tip: string | undefined,
  disabled: boolean | undefined,
  anchorRef: RefObject<HTMLElement | null>,
) {
  const tipRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<TipCoords>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const reposition = useCallback(() => {
    const el = anchorRef.current;
    if (!el || !tip) return;
    const tipW = tipRef.current?.offsetWidth ?? Math.min(220, tip.length * 8 + 24);
    setCoords(placeTipAbove(el.getBoundingClientRect(), tipW));
  }, [anchorRef, tip]);

  useLayoutEffect(() => {
    if (!open || !tip) return;
    reposition();
  }, [open, tip, reposition]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => reposition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, reposition]);

  const show = () => {
    if (!tip || disabled) return;
    setOpen(true);
  };
  const hide = () => setOpen(false);

  const portal =
    mounted && open && tip
      ? createPortal(
          <span
            ref={tipRef}
            id={tipId}
            role="tooltip"
            className="delivery-book-stage__chrome-tip"
            style={{ top: coords.top, left: coords.left }}
          >
            {tip}
          </span>,
          document.body,
        )
      : null;

  return {
    tipId: open && tip ? tipId : undefined,
    show,
    hide,
    portal,
  };
}

type IconProps = {
  src: string;
  label: string;
  /** Opaque portal tooltip above the chrome (escapes shell overflow). */
  tip?: string;
  className?: string;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className" | "aria-label">;

/**
 * Delivery chrome icon — white glyph → gold on hover.
 * Tips portal to `document.body` so shell `overflow: hidden` cannot clip them.
 */
export function DeliveryChromeIconBtn({
  src,
  label,
  tip,
  className = "",
  disabled,
  type = "button",
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ...rest
}: IconProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const { tipId, show, hide, portal } = useChromeTipPortal(tip, disabled, btnRef);

  return (
    <>
      <button
        ref={btnRef}
        type={type}
        className={`delivery-book-stage__icon-btn${className ? ` ${className}` : ""}`}
        aria-label={label}
        aria-describedby={tipId}
        disabled={disabled}
        onMouseEnter={(e) => {
          show();
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          hide();
          onMouseLeave?.(e);
        }}
        onFocus={(e) => {
          show();
          onFocus?.(e);
        }}
        onBlur={(e) => {
          hide();
          onBlur?.(e);
        }}
        {...rest}
      >
        <span
          className="delivery-book-stage__icon-glyph"
          style={{
            WebkitMaskImage: `url(${src})`,
            maskImage: `url(${src})`,
          }}
          aria-hidden
        />
      </button>
      {portal}
    </>
  );
}

type TipButtonProps = {
  tip?: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className">;

/** Text/speed control with the same opaque portal tip as icon buttons. */
export function DeliveryChromeTipButton({
  tip,
  disabled,
  className = "",
  children,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  type = "button",
  ...rest
}: TipButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const { tipId, show, hide, portal } = useChromeTipPortal(tip, disabled, btnRef);

  return (
    <>
      <button
        ref={btnRef}
        type={type}
        className={className}
        disabled={disabled}
        aria-describedby={tipId}
        onMouseEnter={(e) => {
          show();
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          hide();
          onMouseLeave?.(e);
        }}
        onFocus={(e) => {
          show();
          onFocus?.(e);
        }}
        onBlur={(e) => {
          hide();
          onBlur?.(e);
        }}
        {...rest}
      >
        {children}
      </button>
      {portal}
    </>
  );
}
