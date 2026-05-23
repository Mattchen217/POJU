import { Link } from "@/i18n/navigation";

type ReadyCtaVariant = "poju" | "glyph" | "syncro" | "match";

/** 与 Glyph 透明描边胶囊一致：透明底、主题色描边 + 外发光，悬停铺满同色 */
const variantModifier: Record<ReadyCtaVariant, string> = {
  poju: "marketing-pill-outline-cta--violet",
  glyph: "marketing-pill-outline-cta--amber",
  syncro: "marketing-pill-outline-cta--cyan",
  match: "marketing-pill-outline-cta--rose",
};

const layoutClass =
  "group inline-flex min-h-[42px] min-w-0 w-full max-w-full items-center justify-center whitespace-normal px-4 py-2.5 text-center text-[13px] leading-tight hover:-translate-y-0.5 hover:scale-[1.03] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 active:scale-[0.99] sm:min-h-[46px] sm:px-6 sm:text-[14px] md:px-7 md:text-[15px]";

/**
 * 首页「Ready to begin?」三枚胶囊：与产品页 marketing-pill-outline-cta 同构；说明文案由父级放在按钮下方。
 */
export function ReadyCtaPillLink({
  href,
  variant,
  title,
  ariaLabel,
}: {
  href: "/poju" | "/glyph" | "/syncro" | "/match";
  variant: ReadyCtaVariant;
  title: string;
  ariaLabel?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel ?? title}
      className={`marketing-pill-outline-cta ${variantModifier[variant]} ${layoutClass}`}
    >
      {title}
    </Link>
  );
}
