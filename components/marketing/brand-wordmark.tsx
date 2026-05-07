const sizeClass = {
  header: "text-[14px] sm:text-[15px] md:text-[16px]",
  subpage: "text-[13px] sm:text-[14px] md:text-[15px]",
  footer: "text-[15px] sm:text-base",
} as const;

const effectClass =
  "font-primary font-semibold tracking-[0.06em] text-[#f4f4f8] antialiased lowercase [text-shadow:0_0_22px_rgba(255,255,255,0.16),0_1px_3px_rgba(0,0,0,0.5)]";

export type BrandWordmarkSize = keyof typeof sizeClass;

/** 品牌字标：小写 pojulife，浅色字 + 轻微光晕 */
export function BrandWordmark({
  label,
  size,
  className,
}: {
  label: string;
  size: BrandWordmarkSize;
  className?: string;
}) {
  return <span className={`${effectClass} ${sizeClass[size]} ${className ?? ""}`}>{label}</span>;
}
