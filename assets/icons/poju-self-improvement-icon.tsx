type PojuSelfImprovementIconProps = {
  className?: string;
};

export function PojuSelfImprovementIcon({ className = "text-[20px] text-white" }: PojuSelfImprovementIconProps) {
  return (
    <span className={`material-symbols-outlined ${className}`} aria-hidden>
      self_improvement
    </span>
  );
}