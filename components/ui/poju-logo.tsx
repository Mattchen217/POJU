import Link from "next/link";
import { cn } from "@/lib/utils/classnames";

type PojuLogoProps = {
  compact?: boolean;
  className?: string;
};

export function PojuLogo({ compact = false, className }: PojuLogoProps) {
  return (
    <Link
      href="/"
      className={cn("inline-flex items-center gap-2 text-text-primary", className)}
      aria-label="POJU home"
    >
      <span className="h-5 w-5 rounded-full bg-gradient-to-br from-purple-primary via-purple-bright to-purple-pink shadow-glow" />
      {!compact && (
        <span className="inline-flex items-end gap-2">
          <span className="font-logo text-sm text-gold-rare">破局</span>
          <span className="text-sm font-semibold tracking-[0.1em]">POJU</span>
        </span>
      )}
    </Link>
  );
}
