/**
 * Syncro True Solar Time — Step 2 PC desktop block tests.
 * Run: pnpm test:syncro-tst-step2
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildDeviceCapability, canUseSyncro } from "../lib/syncro/device-capability";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as Record<string, unknown>;
}

function main() {
  const pc = buildDeviceCapability({
    isTabletUA: false,
    isMobileUA: false,
    hasTouch: false,
    hasOrientationSensor: false,
    hasCamera: false,
    hasGeolocation: false,
    os: "windows",
  });
  assert(pc.isDesktop, "desktop UA → isDesktop");
  assert(!canUseSyncro(pc), "desktop cannot use Syncro flows");

  const ipad = buildDeviceCapability({
    isTabletUA: true,
    isMobileUA: false,
    hasTouch: true,
    hasOrientationSensor: true,
    hasCamera: true,
    hasGeolocation: true,
    os: "ios",
  });
  assert(canUseSyncro(ipad), "tablet can use Syncro");

  for (const locale of ["en.json", "zh.json"] as const) {
    const syncro = (readJson(`messages/${locale}`).syncro ?? {}) as Record<string, unknown>;
    const home = (syncro.home ?? {}) as Record<string, unknown>;
    const modal = (home.desktop_modal ?? {}) as Record<string, unknown>;
    assert(typeof home.cta_start === "string", `${locale}: syncro.home.cta_start`);
    assert(typeof modal.title === "string", `${locale}: desktop_modal.title`);
    assert(typeof modal.step_3 === "string", `${locale}: desktop_modal.step_3`);
  }

  const guardedRoutes = [
    "app/[locale]/(marketing)/syncro/task/page.tsx",
    "app/[locale]/(marketing)/syncro/prepare/page.tsx",
    "app/[locale]/(marketing)/syncro/preparing/page.tsx",
    "app/[locale]/(marketing)/syncro/location/page.tsx",
    "app/[locale]/(marketing)/syncro/computing/page.tsx",
    "app/[locale]/(marketing)/syncro/result/[id]/page.tsx",
    "app/[locale]/(marketing)/syncro/payment/page.tsx",
    "app/[locale]/(marketing)/syncro/live/page.tsx",
    "app/[locale]/(marketing)/syncro/ar/page.tsx",
  ];

  for (const route of guardedRoutes) {
    const src = readFileSync(join(ROOT, route), "utf8");
    assert(src.includes("SyncroGuardedRoute"), `${route} uses SyncroGuardedRoute`);
  }

  const startSection = readFileSync(
    join(ROOT, "components/syncro/SyncroMobileStartSection.tsx"),
    "utf8",
  );
  assert(startSection.includes("SyncroDesktopQRModal"), "start section opens QR modal");
  assert(startSection.includes("canUseSyncro"), "start section branches on canUseSyncro");

  console.log("✅ Syncro TST Step 2 — desktop block + guard + i18n OK");
}

main();
