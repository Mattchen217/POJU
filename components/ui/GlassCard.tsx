import { type ReactNode } from "react";

import { cn } from "@/lib/utils/classnames";

interface GlassCardProps {
  children: ReactNode;
  variant?: "standard" | "elevated" | "subtle";
  padding?: "sm" | "md" | "lg" | "none";
  className?: string;
  onClick?: () => void;
}

export function GlassCard({
  children,
  variant = "standard",
  padding = "md",
  className,
  onClick,
}: GlassCardProps) {
  const variantClass = {
    standard: "glass-card",
    elevated: "glass-card-elevated",
    subtle: "glass-card-subtle",
  }[variant];

  const paddingClass = {
    none: "",
    sm: "glass-padding-sm",
    md: "glass-padding-md",
    lg: "glass-padding-lg",
  }[padding];

  return (
    <div
      className={cn("glass-base", variantClass, paddingClass, className)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
