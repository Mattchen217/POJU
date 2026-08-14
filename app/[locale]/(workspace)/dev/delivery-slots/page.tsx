/**
 * Local-only delivery slot UI preview (server gate).
 * Open: /zh/dev/delivery-slots  — requires `pnpm dev`.
 */

import { notFound } from "next/navigation";

import { DeliverySlotsPreviewClient } from "./preview-client";

export default function DeliverySlotsPreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  return <DeliverySlotsPreviewClient />;
}
