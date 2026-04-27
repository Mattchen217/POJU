"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            aria-label="Close menu overlay"
            className="fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3 }}
            className="fixed right-0 top-0 z-50 h-full w-72 border-l border-glass-border bg-bg-layer-1/95 p-6 backdrop-blur-xl"
          >
            <nav className="mt-8 flex flex-col gap-4 text-sm">
              <Link href="/poju" onClick={onClose}>POJU · Break your deadlock</Link>
              <Link href="/syncro" onClick={onClose}>SYNCRO · Your energy map</Link>
              <Link href="/oracle" onClick={onClose}>ORACLE · Receive a sign</Link>
              <Link href="/archive" onClick={onClose}>✦ Archive</Link>
              <hr className="my-2 border-glass-border" />
              <Link href="/disclaimer" onClick={onClose}>Disclaimer</Link>
              <Link href="/privacy" onClick={onClose}>Privacy</Link>
              <Link href="/terms" onClick={onClose}>Terms</Link>
              <Link href="/contact" onClick={onClose}>Contact</Link>
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
