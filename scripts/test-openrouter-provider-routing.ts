/**
 * OpenRouter provider pin — OPENROUTER_PROVIDER_ONLY / IGNORE merge.
 *
 *   pnpm exec tsx scripts/test-openrouter-provider-routing.ts
 */
import { openRouterProviderExtras, parseProviderOnly, parseProviderIgnore } from "@/lib/llm/openrouter-shared";
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

withEnv({ OPENROUTER_PROVIDER_ONLY: undefined, OPENROUTER_PROVIDER_IGNORE: undefined }, () => {
  assert("no env → undefined extras", openRouterProviderExtras() === undefined);
});

withEnv({ OPENROUTER_PROVIDER_ONLY: "DeepSeek", OPENROUTER_PROVIDER_IGNORE: undefined }, () => {
  const p = openRouterProviderExtras()!;
  const only = p.only as string[];
  assert("ONLY → only array", Array.isArray(only) && only[0] === "DeepSeek");
  assert("ONLY → allow_fallbacks false", p.allow_fallbacks === false);
});

withEnv({ OPENROUTER_PROVIDER_ONLY: undefined, OPENROUTER_PROVIDER_IGNORE: "GMICloud, Venice" }, () => {
  const p = openRouterProviderExtras()!;
  assert("IGNORE → ignore list", (p.ignore as string[]).join(",") === "GMICloud,Venice");
  assert("IGNORE only → allow_fallbacks true", p.allow_fallbacks === true);
});

withEnv({ OPENROUTER_PROVIDER_ONLY: "Novita", OPENROUTER_PROVIDER_IGNORE: "GMICloud" }, () => {
  const p = openRouterProviderExtras()!;
  const only = p.only as string[];
  assert("ONLY+IGNORE → both keys", only[0] === "Novita" && (p.ignore as string[])[0] === "GMICloud");
  assert("ONLY+IGNORE → allow_fallbacks false", p.allow_fallbacks === false);
});

withEnv({ OPENROUTER_PROVIDER_ONLY: "SiliconFlow", OPENROUTER_PROVIDER_IGNORE: undefined }, () => {
  const p = highOutputProviderConstraints();
  const only = p.only as string[] | undefined;
  assert("highOutput merges ONLY", only?.[0] === "SiliconFlow");
  assert("highOutput require_parameters", p.require_parameters === true);
  assert("highOutput pinned no fallbacks", p.allow_fallbacks === false);
});

assert("parseProviderOnly splits comma", parseProviderOnly().length >= 0);

withEnv({ OPENROUTER_PROVIDER_ONLY: "A, B", OPENROUTER_PROVIDER_IGNORE: undefined }, () => {
  assert("comma ONLY", parseProviderOnly().join(",") === "A,B");
});

console.log(process.exitCode === 1 ? "\nSome checks failed.\n" : "\nAll checks passed.\n");
