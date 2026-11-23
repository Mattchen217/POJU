/**
 * Diagnose OpenRouter provider/model for Face01 live calls.
 * Run: pnpm exec tsx scripts/diagnose-openrouter-face01.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseProviderOrder } from "@/lib/llm/openrouter-shared";
import { deliveryDispatchProviderBody } from "@/lib/llm/pro/delivery/dispatch/provider-escape";
import {
  buildOpenRouterModelCandidatePool,
  getOpenRouterDefaultModel,
} from "@/lib/llm/openrouter-model-resolver";
import { openRouterProviderExtras } from "@/lib/llm/openrouter-provider-routing";

function loadEnvLocal() {
  const p = resolve(".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let val = m[2]!;
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]!]) process.env[m[1]!] = val;
  }
}
loadEnvLocal();

const model = getOpenRouterDefaultModel();
const key = process.env.OPENROUTER_API_KEY?.trim();
console.log(
  JSON.stringify(
    {
      provider_order: parseProviderOrder(),
      provider_escape: process.env.OPENROUTER_PROVIDER_ESCAPE ?? null,
      model,
      pool: buildOpenRouterModelCandidatePool(),
      attempt1: deliveryDispatchProviderBody(1),
      attempt2: deliveryDispatchProviderBody(2),
      has_key: Boolean(key),
    },
    null,
    2,
  ),
);

if (!key) {
  console.log("REAL_MODEL_CALL_NOT_RUN:missing_key");
  process.exit(0);
}

async function probe(label: string, provider: Record<string, unknown> | undefined) {
  const body = {
    model,
    messages: [
      { role: "system", content: "Reply with exactly OK" },
      { role: "user", content: "ping" },
    ],
    max_tokens: 16,
    temperature: 0,
    provider,
  };
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://poju.local",
      "X-Title": "POJU Face01 diagnose",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const snippet = text.slice(0, 400).replace(key!, "[redacted]");
  console.log(
    JSON.stringify(
      {
        probe: label,
        status: res.status,
        provider,
        model,
        body_snippet: snippet,
      },
      null,
      2,
    ),
  );
  return res.status;
}

async function main() {
  const a1 = await probe("attempt1_primary", deliveryDispatchProviderBody(1));
  if (a1 >= 200 && a1 < 300) {
    console.log("PROBE_OK:attempt1");
    return;
  }
  const a2 = await probe("attempt2_escape", deliveryDispatchProviderBody(2));
  if (a2 >= 200 && a2 < 300) {
    console.log("PROBE_OK:attempt2");
    return;
  }
  const streamlake = await probe(
    "locked_streamlake",
    openRouterProviderExtras({ lockedProvider: "streamlake" }),
  );
  if (streamlake >= 200 && streamlake < 300) {
    console.log("PROBE_OK:streamlake");
    return;
  }
  const digitalocean = await probe(
    "locked_digitalocean",
    openRouterProviderExtras({ lockedProvider: "digitalocean" }),
  );
  if (digitalocean >= 200 && digitalocean < 300) {
    console.log("PROBE_OK:digitalocean");
    return;
  }
  const noPin = await probe("no_provider_pin", undefined);
  if (noPin >= 200 && noPin < 300) {
    console.log("PROBE_OK:unpinned");
    return;
  }
  console.log("PROBE_FAIL:all_routes");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
