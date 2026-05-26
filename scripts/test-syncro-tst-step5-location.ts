/**
 * Syncro True Solar Time — Step 5 location flow tests.
 * Run: pnpm test:syncro-tst-step5
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { mapNominatimResults } from "../lib/syncro/nominatim-search";
import {
  buildSyncroStoredLocation,
  parseSyncroStoredLocation,
} from "../lib/syncro/syncro-location-storage";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as Record<string, unknown>;
}

function main() {
  const mapped = mapNominatimResults([
    {
      place_id: 123,
      display_name: "Beijing, China",
      lat: "39.9042",
      lon: "116.4074",
      type: "city",
    },
  ]);
  assert(mapped.length === 1, "map nominatim");
  assert(mapped[0].name === "Beijing, China", "display name");
  assert(Math.abs(mapped[0].lat - 39.9042) < 0.001, "lat parse");

  const stored = buildSyncroStoredLocation({
    lat: 87.6,
    lng: 43.8,
    source: "manual",
    city_name: "Urumqi",
    timezone: "Asia/Shanghai",
  });
  const raw = JSON.stringify(stored);
  const parsed = parseSyncroStoredLocation(raw);
  assert(parsed?.timezone === "Asia/Shanghai", "timezone round-trip");
  assert(parsed?.city_name === "Urumqi", "city name");

  const legacy = parseSyncroStoredLocation(JSON.stringify({ lat: 40.7, lng: -74 }));
  assert(legacy?.lat === 40.7, "legacy lat/lng keys");

  for (const locale of ["en.json", "zh.json"] as const) {
    const loc = ((readJson(`messages/${locale}`).syncro as Record<string, unknown>).location ??
      {}) as Record<string, unknown>;
    assert(typeof loc.manual_title === "string", `${locale} manual_title`);
    assert(typeof loc.confirm_use === "string", `${locale} confirm_use`);
    assert(typeof loc.city_search_placeholder === "string", `${locale} city_search_placeholder`);
  }

  const files = [
    "components/syncro/CitySearchBox.tsx",
    "components/syncro/SyncroLocationPage.tsx",
    "app/api/syncro/search-city/route.ts",
    "lib/syncro/syncro-location-storage.ts",
  ];
  for (const f of files) {
    assert(readFileSync(join(ROOT, f), "utf8").length > 50, `${f} exists`);
  }

  const locationPage = readFileSync(join(ROOT, "components/syncro/SyncroLocationPage.tsx"), "utf8");
  assert(locationPage.includes("CitySearchBox"), "location uses CitySearchBox");
  assert(locationPage.includes("confirm"), "confirm stage");
  assert(locationPage.includes("buildSyncroStoredLocation"), "stores location with timezone helper");

  const computing = readFileSync(join(ROOT, "components/syncro/SyncroComputingPage.tsx"), "utf8");
  assert(computing.includes("parseSyncroStoredLocation"), "computing parses stored location");
  assert(computing.includes("location.timezone"), "computing uses stored timezone");

  console.log("\n✅ Syncro TST Step 5 — location + city search OK");
}

main();
