import pojuAvatar from "@/assets/icons/P.png";

type Props = {
  className?: string;
};

/**
 * Pivot AI mark — meditation glyph only (no disc), landing-page gold metal fill.
 */
export function PojuAiAvatar({ className }: Props) {
  const src = typeof pojuAvatar === "string" ? pojuAvatar : pojuAvatar.src;
  return (
    <span className={["pchat__ai-avatar", className].filter(Boolean).join(" ")} aria-hidden>
      <span
        className="pchat__ai-avatar__glyph"
        style={{
          WebkitMaskImage: `url(${src})`,
          maskImage: `url(${src})`,
        }}
      />
    </span>
  );
}
