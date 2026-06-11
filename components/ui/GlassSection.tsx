import type { ReactNode } from "react";

import { cn } from "@/lib/utils/classnames";

type GlassSectionProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  /** 无内边距（自定义布局时用） */
  padding?: "default" | "lg" | "sm" | "none";
  /** 允许内部绝对定位装饰（如 promises 背景图） */
  allowOverflow?: boolean;
};

export function GlassSection({
  children,
  className,
  id,
  padding = "default",
  allowOverflow = false,
}: GlassSectionProps) {
  const paddingClass = {
    none: "glass-section--pad-none",
    sm: "glass-section--pad-sm",
    default: "",
    lg: "glass-section--pad-lg",
  }[padding];

  return (
    <section
      id={id}
      className={cn(
        "glass-section pj-glass-section",
        paddingClass,
        allowOverflow && "glass-section--overflow-visible",
        className,
      )}
    >
      {children}
    </section>
  );
}
