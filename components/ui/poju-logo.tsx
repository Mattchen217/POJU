import Image from "next/image";
import Link from "next/link";

import pojuLogo from "@/assets/images/POJUlogo.png";
import { cn } from "@/lib/utils/classnames";

type PojuLogoProps = {
  compact?: boolean;
  className?: string;
};

export function PojuLogo({ compact = false, className }: PojuLogoProps) {
  return (
    <Link
      href="/"
      className={cn("inline-flex items-center gap-0 text-text-primary", className)}
      aria-label="POJU home"
    >
      <span className="inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center sm:h-[30px] sm:w-[30px] md:h-[34px] md:w-[34px]">
        <Image
          src={pojuLogo}
          alt=""
          width={256}
          height={256}
          aria-hidden
          className="max-h-full max-w-full object-contain shadow-glow"
        />
      </span>
      {!compact ? (
        <span className="text-sm font-semibold leading-none tracking-[0.1em]">POJU</span>
      ) : null}
    </Link>
  );
}
