"use client";

import Spline from "@splinetool/react-spline";

type HeroSplineProps = {
  className?: string;
};

export function HeroSpline({ className }: HeroSplineProps) {
  return (
    <div className={className}>
      <Spline
        scene="/animations/XYscene.splinecode"
        className="h-full w-full"
      />
    </div>
  );
}
