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
  assert("no env → undefined extras", openRouterProviderExtras() === undefined);
});

withEnv(
  {
    OPENROUTER_PROVIDER_ORDER: "streamlake,siliconflow,deepinfra",
    OPENROUTER_PROVIDER_IGNORE: undefined,
  },
  () => {
    const p = openRouterProviderExtras()!;
    const order = p.order as string[];
    assert("ORDER → three providers", order.join(",") === "streamlake,siliconflow,deepinfra");
    assert("ORDER → allow_fallbacks false", p.allow_fallbacks === false);
    assert("ORDER → no require_parameters", p.require_parameters === undefined);
  },
);

withEnv(
  { OPENROUTER_PROVIDER_ORDER: "streamlake,siliconflow,deepinfra", OPENROUTER_PROVIDER_IGNORE: undefined },
  () => {
    const p = openRouterProviderExtras({ lockedProvider: "streamlake" })!;
    assert("locked → single order entry", JSON.stringify(p.order) === '["streamlake"]');
    assert("locked → allow_fallbacks false", p.allow_fallbacks === false);
    assert("locked → no require_parameters", p.require_parameters === undefined);
  },
);

withEnv(
  { OPENROUTER_PROVIDER_ORDER: "streamlake,siliconflow,deepinfra", OPENROUTER_PROVIDER_IGNORE: undefined },
  () => {
    assert(
      "normalize served name",
      normalizeProviderSlugForLock("StreamLake") === "streamlake",
    );
    assert(
      "session lock keeps existing",
      resolveSessionLockedProvider("siliconflow", "StreamLake") === "siliconflow",
    );
    assert(
      "session lock from served",
      resolveSessionLockedProvider(undefined, "DeepInfra") === "deepinfra",
    );
  },
);

withEnv({ OPENROUTER_PROVIDER_ORDER: "A, B", OPENROUTER_PROVIDER_IGNORE: undefined }, () => {
  assert("comma ORDER trims", parseProviderOrder().join(",") === "A,B");
});

console.log(process.exitCode === 1 ? "\nSome checks failed.\n" : "\nAll checks passed.\n");
