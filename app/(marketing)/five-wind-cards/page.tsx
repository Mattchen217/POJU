import type { Metadata } from "next";
import { Suspense } from "react";

import { WindCardsGallery } from "@/components/oracle/wind-cards";

export const metadata: Metadata = {
  title: "五风卡面 · POJU",
  description: "五张独立卡面展示（assets/images）。",
};

export default function FiveWindCardsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0c]" />}>
      <div className="min-h-screen bg-[#0a0a0c] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-12 text-center">
            <h1 className="text-lg font-semibold tracking-tight text-zinc-100">五风卡面</h1>
            <p className="mt-2 text-sm text-zinc-500">
              图源：pojulife/assets/images — 按 PNG 原始像素展示，仅窄屏时等比缩小
            </p>
          </header>
          <WindCardsGallery />
        </div>
      </div>
    </Suspense>
  );
}
