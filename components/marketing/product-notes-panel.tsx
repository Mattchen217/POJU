import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/classnames";
import type { ProductShotKey } from "@/lib/marketing/product-shots";
import { PRODUCT_SHOT_IMAGES } from "@/lib/marketing/product-shots";

type NotesBlackBoxProps = {
  children: ReactNode;
  className?: string;
  title?: string;
  label?: string;
  center?: boolean;
};

/** 无框黑底文字区 */
export function NotesBlackBox({ children, className, title, label, center }: NotesBlackBoxProps) {
  return (
    <div className={cn("notes-black-box", center && "notes-black-box--center", className)}>
      {label ? <p className="notes-black-box__label">{label}</p> : null}
      {title ? <h3 className="notes-black-box__title">{title}</h3> : null}
      {children}
    </div>
  );
}

type ProductShotProps = {
  src: string;
  alt: string;
  variant?: "hero" | "card";
  className?: string;
  priority?: boolean;
};

export function ProductShot({ src, alt, variant = "card", className, priority }: ProductShotProps) {
  return (
    <div className={cn("product-shot", variant === "hero" && "product-shot--hero", variant === "card" && "product-shot--card", className)}>
      <Image src={src} alt={alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 72rem" priority={priority} />
    </div>
  );
}

/** 各产品页顶部主视觉 */
export function ProductPageShowcase({ product, alt }: { product: ProductShotKey; alt: string }) {
  return (
    <div className="product-page-showcase">
      <ProductShot src={PRODUCT_SHOT_IMAGES[product]} alt={alt} variant="hero" priority />
    </div>
  );
}

type ProductNotesCardProps = {
  children: ReactNode;
  title?: string;
  label?: string;
  shotSrc?: string;
  shotAlt?: string;
  className?: string;
};

/** 可选场景图 + 黑框文案 */
export function ProductNotesCard({ children, title, label, shotSrc, shotAlt, className }: ProductNotesCardProps) {
  return (
    <article className={cn("product-notes-card", className)}>
      {shotSrc && shotAlt ? <ProductShot src={shotSrc} alt={shotAlt} variant="card" /> : null}
      <NotesBlackBox title={title} label={label}>
        {children}
      </NotesBlackBox>
    </article>
  );
}
