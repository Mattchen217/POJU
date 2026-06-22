/**
 * OpenRouter provider order — OPENROUTER_PROVIDER_ORDER / IGNORE merge.
 *
 *   pnpm exec tsx scripts/test-openrouter-provider-routing.ts
 */
import {
  openRouterProviderExtras,
  parseProviderOrder,
  parseProviderIgnore,
} from "@/lib/llm/openrouter-shared";
import { highOutputProviderConstraints } from "@/lib/llm/router";

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
  { OPENROUTER_PROVIDER_ORDER: "DeepSeek,Baidu,Alibaba", OPENROUTER_PROVIDER_IGNORE: undefined },
  () => {
    const p = openRouterProviderExtras()!;
    const order = p.order as string[];
    assert("ORDER → order array", order.join(",") === "DeepSeek,Baidu,Alibaba");
    assert("ORDER → allow_fallbacks false", p.allow_fallbacks === false);
    assert("ORDER → no only key", p.only === undefined);
  },
);

withEnv({ OPENROUTER_PROVIDER_ORDER: undefined, OPENROUTER_PROVIDER_IGNORE: "GMICloud, Venice" }, () => {
  const p = openRouterProviderExtras()!;
  assert("IGNORE → ignore list", (p.ignore as string[]).join(",") === "GMICloud,Venice");
  assert("IGNORE only → allow_fallbacks true", p.allow_fallbacks === true);
});

withEnv(
  { OPENROUTER_PROVIDER_ORDER: "DeepSeek,Baidu", OPENROUTER_PROVIDER_IGNORE: "NextBit" },
  () => {
    const p = openRouterProviderExtras()!;
    const order = p.order as string[];
    assert("ORDER+IGNORE → both keys", order[0] === "DeepSeek" && (p.ignore as string[])[0] === "NextBit");
    assert("ORDER+IGNORE → allow_fallbacks false", p.allow_fallbacks === false);
  },
);

withEnv(
  { OPENROUTER_PROVIDER_ORDER: "DeepSeek,Baidu,Alibaba", OPENROUTER_PROVIDER_IGNORE: undefined },
  () => {
    const p = highOutputProviderConstraints();
    const order = p.order as string[] | undefined;
    assert("highOutput merges ORDER", order?.join(",") === "DeepSeek,Baidu,Alibaba");
    assert("highOutput require_parameters", p.require_parameters === true);
    assert("highOutput ordered no fallbacks", p.allow_fallbacks === false);
  },
);

withEnv({ OPENROUTER_PROVIDER_ORDER: "A, B", OPENROUTER_PROVIDER_IGNORE: undefined }, () => {
  assert("comma ORDER trims", parseProviderOrder().join(",") === "A,B");
});

console.log(process.exitCode === 1 ? "\nSome checks failed.\n" : "\nAll checks passed.\n");
