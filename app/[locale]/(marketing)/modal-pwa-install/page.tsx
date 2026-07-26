import type { Metadata } from "next";
import { ModalPwaInstallPageClient } from "@/components/marketing/modal-pwa-install-page-client";

export const metadata: Metadata = {
  title: "Eastern OS - Add to Home Screen",
  description: "PWA install modal preview",
};

export default function ModalPwaInstallPage() {
  return <ModalPwaInstallPageClient />;
}
