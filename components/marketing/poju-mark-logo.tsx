import Image from "next/image";

import logoMark from "@/assets/images/LOGOE.png";

/**
 * 正方形容器 + object-contain：避免 flex 横向挤压导致「压扁」观感；
 * 尺寸比旁侧字标再大一圈。
 */
const markBoxClass =
  "inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center sm:h-[30px] sm:w-[30px] md:h-[34px] md:w-[34px]";

/** Header 品牌图形标（LOGOE）。 */
export function PojuMarkLogo({ className }: { className?: string }) {
  return (
    <span className={className ? `${markBoxClass} ${className}` : markBoxClass}>
      <Image
        src={logoMark}
        alt=""
        width={256}
        height={256}
        aria-hidden
        className="max-h-full max-w-full object-contain"
        sizes="136px"
      />
    </span>
  );
}
