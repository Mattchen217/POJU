import Image from "next/image";

import pojuLogo from "@/assets/images/POJUlogo.png";

type PwaBrandMarkProps = {
  size?: "md" | "lg";
};

export function PwaBrandMark({ size = "md" }: PwaBrandMarkProps) {
  const dim = size === "lg" ? 72 : 56;

  return (
    <div
      className={`pwa-brand-mark ${size === "lg" ? "pwa-brand-mark--lg" : ""}`}
      aria-hidden={size === "md"}
    >
      <Image
        src={pojuLogo}
        alt={size === "lg" ? "pojulife" : ""}
        width={dim}
        height={dim}
        priority
        className="pwa-brand-mark__img"
      />
    </div>
  );
}
