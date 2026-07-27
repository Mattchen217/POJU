import Image from "next/image";
import Link from "next/link";

import logoFull from "@/assets/images/LOGO.png";
import logoMark from "@/assets/images/LOGOE.png";
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
      aria-label="Eastern OS home"
    >
      {compact ? (
        <span className="inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center sm:h-[30px] sm:w-[30px] md:h-[34px] md:w-[34px]">
          <Image
            src={logoMark}
            alt=""
            width={256}
            height={256}
            aria-hidden
            className="max-h-full max-w-full object-contain"
          />
        </span>
      ) : (
        <Image
          src={logoFull}
          alt="Eastern OS"
          width={720}
          height={180}
          className="h-7 w-auto object-contain sm:h-8"
          sizes="180px"
          priority
        />
      )}
    </Link>
  );
}
