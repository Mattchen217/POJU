import Link from "next/link";
import { cn } from "@/lib/utils/classnames";

type CtaButtonProps = {
  href?: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
};

export function CtaButton({
  href = "#",
  children,
  variant = "primary",
  className,
}: CtaButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        variant === "primary" ? "poju-button-primary" : "poju-button-secondary",
        className,
      )}
    >
      {children}
    </Link>
  );
}
