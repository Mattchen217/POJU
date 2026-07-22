"use client";

import { useState } from "react";

import { BeginButton } from "@/components/pwa/BeginButton";
import { WorkspaceProfileSlotBar } from "@/components/workspace/WorkspaceProfileSlotBar";

type Props = {
  productId: "poju" | "match" | "syncro" | "glyph";
  headline: string;
  guidance: string;
  placeholder: string;
  price: string;
};

/**
 * Shared engine canvas: micro-copy → Profile Slot A/B → dilemma field → Begin.
 * BeginButton keeps existing payment/prepare navigation intact.
 */
export function EnginePanel({ productId, headline, guidance, placeholder, price }: Props) {
  const [dilemma, setDilemma] = useState("");

  return (
    <div className="workspace-panel">
      <h2 className="workspace-panel__headline">{headline}</h2>
      <p className="workspace-panel__guidance">{guidance}</p>

      <div className="workspace-glass-card">
        <WorkspaceProfileSlotBar />

        <label className="sr-only" htmlFor={`workspace-dilemma-${productId}`}>
          Context or dilemma
        </label>
        <textarea
          id={`workspace-dilemma-${productId}`}
          className="workspace-dilemma-field"
          placeholder={placeholder}
          value={dilemma}
          onChange={(e) => setDilemma(e.target.value)}
          rows={5}
        />
        <p className="workspace-dilemma-hint">
          Notes stay on this canvas for now. Begin opens the existing {productId.toUpperCase()} flow.
        </p>

        <div className="workspace-panel__begin">
          <BeginButton productId={productId} price={price} useMarketingLabels />
        </div>
      </div>
    </div>
  );
}

export function PojuPanel() {
  return (
    <EnginePanel
      productId="poju"
      headline="Deep Strategic Consult for Life Crossroads."
      guidance="Select a profile and state your core dilemma below."
      placeholder="What deadlock are you facing? Be specific about the fork in the road…"
      price="$9.99"
    />
  );
}

export function MatchPanel() {
  return (
    <EnginePanel
      productId="match"
      headline="Two charts. One relationship field."
      guidance="Select a profile slot, then begin to choose both people in the existing Match flow."
      placeholder="Optional note about the relationship question you want clarity on…"
      price="$9.99"
    />
  );
}

export function SyncroPanel() {
  return (
    <EnginePanel
      productId="syncro"
      headline="Align your space with this exact moment."
      guidance="Select a profile, then begin Syncro to scan direction and timing."
      placeholder="Optional note about the space or task you want to align…"
      price="Free"
    />
  );
}

export function GlyphPanel() {
  return (
    <EnginePanel
      productId="glyph"
      headline="A sincere question. An ancient sign."
      guidance="Select a profile, then begin Glyph to draw your reading."
      placeholder="Optional note about the question you bring to the draw…"
      price="$9.99"
    />
  );
}
