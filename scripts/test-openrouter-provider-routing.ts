/**
 * OpenRouter provider order — OPENROUTER_PROVIDER_ORDER / session lock.
 *
 *   pnpm exec tsx scripts/test-openrouter-provider-routing.ts
 */
import {
  normalizeProviderSlugForLock,
  openRouterProviderExtras,
  resolveSessionLockedProvider,
} from "@/lib/llm/openrouter-provider-routing";
import { parseProviderOrder } from "@/lib/llm/openrouter-shared";

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function withEnv(patch: Record<string, string | undefined>, fn: () => void): void {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(patch)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

console.log("\n=== OpenRouter provider routing ===\n");

withEnv({ OPENROUTER_PROVIDER_ORDER: undefined, OPENROUTER_PROVIDER_IGNORE: undefined }, () => {
  const p = openRouterProviderExtras();
  assert("no ORDER → only siliconflow ignore", JSON.stringify(p) === '{"ignore":["siliconflow"]}');
});

withEnv(
  {
    OPENROUTER_PROVIDER_ORDER: "streamlake",
    OPENROUTER_PROVIDER_IGNORE: undefined,
  },
  () => {
    const p = openRouterProviderExtras()!;
    const order = p.order as string[];
    assert("ORDER → streamlake only", order.join(",") === "streamlake");
    assert("ORDER → allow_fallbacks false", p.allow_fallbacks === false);
    const ignore = p.ignore as string[];
    assert("siliconflow always ignored", ignore.includes("siliconflow"));
  },
);

withEnv(
  { OPENROUTER_PROVIDER_ORDER: "streamlake", OPENROUTER_PROVIDER_IGNORE: undefined },
  () => {
    const p = openRouterProviderExtras({ lockedProvider: "streamlake" })!;
    assert("locked → single order entry", JSON.stringify(p.order) === '["streamlake"]');
    assert("locked → allow_fallbacks false", p.allow_fallbacks === false);
  },
);

withEnv(
  { OPENROUTER_PROVIDER_ORDER: "streamlake", OPENROUTER_PROVIDER_IGNORE: undefined },
  () => {
    assert(
      "normalize served name",
      normalizeProviderSlugForLock("StreamLake") === "streamlake",
    );
    assert(
      "session lock keeps existing",
      resolveSessionLockedProvider("streamlake", "StreamLake") === "streamlake",
    );
  },
);

withEnv({ OPENROUTER_PROVIDER_ORDER: "A, B", OPENROUTER_PROVIDER_IGNORE: undefined }, () => {
  assert("comma ORDER trims", parseProviderOrder().join(",") === "A,B");
});

console.log(process.exitCode === 1 ? "\nSome checks failed.\n" : "\nAll checks passed.\n");
