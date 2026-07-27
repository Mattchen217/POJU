import Image from "next/image";

import logoFull from "@/assets/images/LOGO.png";
import logoMark from "@/assets/images/LOGOE.png";
import type { BrandWordmarkSize } from "@/components/marketing/brand-wordmark";

const heightClass: Record<BrandWordmarkSize, string> = {
  header: "h-7 sm:h-8",
  subpage: "h-6 sm:h-7",
  footer: "h-6 sm:h-7",
};

/** Full LOGO.png for expanded chrome; LOGOE.png mark when sidebar is collapsed. */
export function BrandLockup({
  label,
  size,
  className,
}: {
  label: string;
  size: BrandWordmarkSize;
  className?: string;
}) {
  const h = heightClass[size];
  return (
    <span className={`inline-flex items-center gap-0 ${className ?? ""}`}>
      <Image
        src={logoMark}
        alt=""
        width={128}
        height={128}
        aria-hidden
        className={`brand-lockup-mark hidden ${h} w-auto max-w-none object-contain`}
        sizes="40px"
      />
      <Image
        src={logoFull}
        alt={label}
        width={720}
        height={180}
        className={`brand-lockup-full ${h} w-auto max-w-none object-contain`}
        sizes="(max-width: 640px) 140px, 180px"
        priority={size === "header"}
      />
    </span>
  );
}
