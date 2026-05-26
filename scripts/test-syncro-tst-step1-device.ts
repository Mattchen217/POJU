/**
 * Syncro True Solar Time — Step 1 device capability tests.
 * Run: pnpm test:syncro-tst-step1
 */
import {
  buildDeviceCapability,
  canUseSyncro,
  detectDeviceCapability,
  detectOsFromUserAgent,
} from "../lib/syncro/device-capability";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
// SSR / Node (no window)
const ssr = await detectDeviceCapability();
assert(ssr.type === "desktop", "SSR type desktop");
assert(ssr.isDesktop, "SSR isDesktop");
assert(!canUseSyncro(ssr), "SSR canUseSyncro false");

// UA classification
assert(detectOsFromUserAgent("Mozilla/5.0 (iPhone)") === "ios", "iOS UA");
assert(detectOsFromUserAgent("Mozilla/5.0 (Linux; Android 14)") === "android", "Android UA");
assert(detectOsFromUserAgent("Mozilla/5.0 (Windows NT 10.0)") === "windows", "Windows UA");
assert(detectOsFromUserAgent("Mozilla/5.0 (Macintosh)") === "mac", "Mac UA");
assert(detectOsFromUserAgent("Mozilla/5.0 (iPad)") === "ios", "iPad → ios");

const iphone = buildDeviceCapability({
  isTabletUA: false,
  isMobileUA: true,
  hasTouch: true,
  hasOrientationSensor: true,
  hasCamera: true,
  hasGeolocation: true,
  os: "ios",
});
assert(iphone.type === "mobile", "iPhone → mobile");
assert(canUseSyncro(iphone), "mobile can use Syncro");

const ipad = buildDeviceCapability({
  isTabletUA: true,
  isMobileUA: false,
  hasTouch: true,
  hasOrientationSensor: true,
  hasCamera: true,
  hasGeolocation: true,
  os: "ios",
});
assert(ipad.type === "tablet", "iPad → tablet");
assert(canUseSyncro(ipad), "tablet can use Syncro");

const pc = buildDeviceCapability({
  isTabletUA: false,
  isMobileUA: false,
  hasTouch: false,
  hasOrientationSensor: false,
  hasCamera: false,
  hasGeolocation: false,
  os: "windows",
});
assert(pc.type === "desktop", "PC → desktop");
assert(!canUseSyncro(pc), "desktop blocked");

// Android tablet (no Mobile in UA)
const androidTablet = buildDeviceCapability({
  isTabletUA: true,
  isMobileUA: false,
  hasTouch: true,
  hasOrientationSensor: false,
  hasCamera: true,
  hasGeolocation: true,
  os: "android",
});
assert(androidTablet.type === "tablet", "Android tablet");
assert(canUseSyncro(androidTablet), "Android tablet allowed");

// Touch laptop misclassified as mobile without strict UA — stays desktop
const touchLaptop = buildDeviceCapability({
  isTabletUA: false,
  isMobileUA: false,
  hasTouch: true,
  hasOrientationSensor: false,
  hasCamera: true,
  hasGeolocation: false,
  os: "windows",
});
assert(touchLaptop.type === "desktop", "touch laptop stays desktop");

console.log("SSR capability:", ssr);
console.log("Sample mobile:", iphone);
console.log("Sample desktop:", pc);
console.log("\nSyncro TST Step 1 (device-capability): all checks passed.");
console.log(
  "Browser: run detectDeviceCapability().then(console.log) in DevTools on phone vs PC.",
);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
