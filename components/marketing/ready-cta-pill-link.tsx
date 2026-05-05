import { Link } from "@/i18n/navigation";

type ReadyCtaVariant = "poju" | "glyph" | "syncro";

const variantClass: Record<ReadyCtaVariant, string> = {
  poju:
    "border-violet-400/55 bg-violet-500/15 text-violet-50 shadow-[0_10px_28px_rgba(139,92,246,0.35)] hover:border-violet-200/90 hover:bg-gradient-to-r hover:from-violet-400/95 hover:to-fuchsia-500/90 hover:shadow-[0_14px_36px_rgba(139,92,246,0.5)]",
  glyph:
    "border-amber-300/55 bg-amber-400/18 text-amber-50 shadow-[0_10px_28px_rgba(251,191,36,0.35)] hover:border-amber-200/90 hover:bg-gradient-to-r hover:from-amber-300/95 hover:to-amber-400/90 hover:shadow-[0_14px_36px_rgba(251,191,36,0.55)]",
  syncro:
    "border-cyan-300/55 bg-cyan-500/15 text-cyan-50 shadow-[0_10px_28px_rgba(34,211,238,0.32)] hover:border-cyan-200/90 hover:bg-gradient-to-r hover:from-cyan-400/95 hover:to-teal-400/90 hover:shadow-[0_14px_36px_rgba(34,211,238,0.5)]",
};

const baseClass =
  "group inline-flex min-h-[48px] min-w-0 w-full max-w-full items-center justify-center whitespace-normal rounded-full border px-5 py-3 text-center text-[14px] font-semibold leading-tight transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.04] hover:text-neutral-950 motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 active:scale-[0.99] active:translate-y-0 sm:min-h-[52px] sm:px-7 sm:text-[15px] md:px-8 md:text-base";

/**
 * 与 Glyph 产品页 OracleProductHero CTA 同构的单行胶囊按钮；说明文案由父级放在按钮下方。
 */
export function ReadyCtaPillLink({
  href,
  variant,
  title,
  ariaLabel,
}: {
  href: "/poju" | "/glyph" | "/syncro";
  variant: ReadyCtaVariant;
  title: string;
  ariaLabel?: string;
}) {
  return (
    <Link href={href} aria-label={ariaLabel ?? title} className={`${baseClass} ${variantClass[variant]}`}>
      {title}
    </Link>
  );
}
