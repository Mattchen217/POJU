import { Layers } from "lucide-react";

type PojuSelfImprovementIconProps = {
  className?: string;
};

export function PojuSelfImprovementIcon({ className = "h-5 w-5 text-white" }: PojuSelfImprovementIconProps) {
  return <Layers className={className} strokeWidth={1.5} aria-hidden />;
}
