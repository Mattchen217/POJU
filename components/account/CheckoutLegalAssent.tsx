"use client";

import { CheckoutLegalFootnotes } from "@/components/account/CheckoutLegalFootnotes";

type Props = {
  /** flex = Buy Pass; subscription = personal plan */
  mode: "flex" | "subscription";
  /** @deprecated Ignored — no checkbox (Payments lock 2026-10-19) */
  checked?: boolean;
  /** @deprecated Ignored — no checkbox */
  onCheckedChange?: (next: boolean) => void;
  id?: string;
};

/**
 * Back-compat wrapper. Checkbox gating removed — footnotes only.
 * Prefer importing CheckoutLegalFootnotes. CTAs must not gate on `checked`.
 */
export function CheckoutLegalAssent({ mode, id }: Props) {
  return <CheckoutLegalFootnotes mode={mode} id={id} />;
}
