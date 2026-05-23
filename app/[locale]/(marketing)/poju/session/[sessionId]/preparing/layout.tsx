import { PreparingSplineShell } from "@/components/poju/PreparingSplineShell";

/**
 * Keeps the analyzing Spline scene mounted for the whole /preparing route.
 * Overlay copy lives in page.tsx — avoids enter/exit/enter flicker from remounting WebGL.
 */
export default function PreparingLayout({ children }: { children: React.ReactNode }) {
  return <PreparingSplineShell>{children}</PreparingSplineShell>;
}
