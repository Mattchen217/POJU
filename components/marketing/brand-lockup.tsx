import { BrandWordmark, type BrandWordmarkSize } from "@/components/marketing/brand-wordmark";
import { PojuMarkLogo } from "@/components/marketing/poju-mark-logo";

/** 图形标 + 字标（文案来自 common.brand，如 pojulife） */
export function BrandLockup({
  label,
  size,
  className,
}: {
  label: string;
  size: BrandWordmarkSize;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <PojuMarkLogo />
      <BrandWordmark label={label} size={size} className="leading-none translate-y-[1px]" />
    </span>
  );
}
