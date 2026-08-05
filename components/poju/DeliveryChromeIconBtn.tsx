"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = {
  src: string;
  label: string;
  /** Frosted tooltip (shown above the bar). */
  tip?: string;
  className?: string;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className" | "aria-label">;

/**
 * Delivery bottom-chrome icon control — white glyph → gold on hover,
 * optional frosted-glass tooltip via data-tip.
 */
export function DeliveryChromeIconBtn({
  src,
  label,
  tip,
  className = "",
  disabled,
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`delivery-book-stage__icon-btn${className ? ` ${className}` : ""}`}
      aria-label={label}
      data-tip={tip || undefined}
      disabled={disabled}
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
  );
}
