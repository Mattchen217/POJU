import Image from "next/image";
import Link from "next/link";
import type { MouseEvent } from "react";

import logoMark from "@/assets/images/EASTERN OS LOGO1.png";
import logoWordmark from "@/assets/images/EASTERN OS LOGO2.png";
import { cn } from "@/lib/utils/classnames";

type PojuLogoSize = "landing" | "footer" | "sidebar";

type PojuLogoProps = {
  compact?: boolean;
  className?: string;
  /**
   * Hard full-page navigation to `/` (workspace leave `/app`).
   * Uses a plain `<a>` so in-flight session sync cannot router.replace back.
   */
  hardNavigate?: boolean;
  /** Visual scale. `landing` is larger chrome; `footer` matches landing footer / nav; `sidebar` fits the workspace dock. */
  size?: PojuLogoSize;
};

function LogoImages({ compact, size }: { compact: boolean; size: PojuLogoSize }) {
  if (compact) {
    const box =
      size === "sidebar"
        ? "inline-flex h-5 w-5 shrink-0 items-center justify-center"
        : size === "footer"
          ? "inline-flex h-7 w-7 shrink-0 items-center justify-center sm:h-8 sm:w-8"
          : "inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center sm:h-[30px] sm:w-[30px] md:h-[34px] md:w-[34px]";
    return (
      <span className={box}>
        <Image
          src={logoMark}
          alt=""
          width={256}
          height={256}
          aria-hidden
          className="max-h-full max-w-full object-contain"
        />
      </span>
    );
  }

  const markClass =
    size === "sidebar"
      ? "h-[22px] w-auto object-contain"
      : size === "footer"
        ? "h-8 w-auto object-contain sm:h-9"
        : "h-9 w-auto object-contain sm:h-10";
  const wordClass =
    size === "sidebar"
      ? "h-[17px] w-auto object-contain"
      : size === "footer"
        ? "h-6 w-auto object-contain sm:h-7"
        : "h-7 w-auto object-contain sm:h-8";

  return (
    <>
      <Image
        src={logoMark}
        alt=""
        width={711}
        height={711}
        aria-hidden
        className={markClass}
        sizes={size === "sidebar" ? "22px" : size === "footer" ? "36px" : "40px"}
        priority={size === "landing"}
      />
      <Image
        src={logoWordmark}
        alt="Eastern OS"
        width={1134}
        height={198}
        className={wordClass}
        sizes={size === "sidebar" ? "100px" : size === "footer" ? "140px" : "160px"}
        priority={size === "landing"}
      />
    </>
  );
}

export function PojuLogo({
  compact = false,
  className,
  hardNavigate = false,
  size = "landing",
}: PojuLogoProps) {
  const lockupClass = cn(
    "inline-flex items-end gap-2 text-text-primary",
    size === "sidebar" && "gap-1.5",
    className,
  );

  const images = <LogoImages compact={compact} size={size} />;

  if (hardNavigate) {
    const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.assign("/");
    };
    return (
      <a href="/" className={lockupClass} aria-label="Eastern OS home" onClick={onClick}>
        {images}
      </a>
    );
  }

  return (
    <Link href="/" className={lockupClass} aria-label="Eastern OS home">
      {images}
    </Link>
  );
}