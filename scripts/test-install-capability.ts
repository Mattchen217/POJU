/**
 * PWA install capability — UA matrix (no browser required).
 * Run: pnpm exec tsx scripts/test-install-capability.ts
 */

import { detectInstallCapabilityFromUA } from "../lib/pwa/install-capability";

type Case = {
  name: string;
  ua: string;
  standalone?: boolean;
  expect: string;
};

const IOS_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IOS_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1";
const IOS_FIREFOX =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/605.1.15";
const IOS_EDGE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/120.0.2210.86 Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36";
const ANDROID_HUAWEI =
  "Mozilla/5.0 (Linux; Android 12; HUAWEI P50) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/99.0.4844.88 Mobile Safari/537.36 HuaweiBrowser/14.0.0.310";
const ANDROID_UC =
  "Mozilla/5.0 (Linux; U; Android 13; en-US; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.127 UCBrowser/15.0.0.1236 Mobile Safari/537.36";
const ANDROID_QQ =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.127 MQQBrowser/14.9 Mobile Safari/537.36";
const DESKTOP_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const cases: Case[] = [
  { name: "iOS Safari", ua: IOS_SAFARI, expect: "ios_safari" },
  { name: "iOS Chrome", ua: IOS_CHROME, expect: "ios_other_browser" },
  { name: "iOS Firefox", ua: IOS_FIREFOX, expect: "ios_other_browser" },
  { name: "iOS Edge", ua: IOS_EDGE, expect: "ios_other_browser" },
  { name: "Android Chrome", ua: ANDROID_CHROME, expect: "android_chrome" },
  { name: "Huawei Browser", ua: ANDROID_HUAWEI, expect: "android_other_browser" },
  { name: "UC Browser", ua: ANDROID_UC, expect: "android_other_browser" },
  { name: "QQ Browser", ua: ANDROID_QQ, expect: "android_other_browser" },
  { name: "Desktop", ua: DESKTOP_MAC, expect: "desktop" },
  {
    name: "PWA installed",
    ua: IOS_SAFARI,
    standalone: true,
    expect: "pwa_installed",
  },
];

let failed = 0;

for (const c of cases) {
  const result = detectInstallCapabilityFromUA(c.ua, c.standalone ?? false);
  const ok = result.capability === c.expect;
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${c.name}: expected ${c.expect}, got ${result.capability}`);
  } else {
    console.log(`OK   ${c.name} → ${result.capability} (${result.browser_name})`);
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${cases.length} cases failed`);
  process.exit(1);
}

console.log(`\nAll ${cases.length} install-capability cases passed.\n`);
