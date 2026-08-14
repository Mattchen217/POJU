/**
 * Smoke: Rx argument compose/parse + coerce title/strategy/methods.
 */
import assert from "node:assert/strict";
import { coerceDeliveryArguments } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  composeRxArgumentBody,
  parseRxStrategyMethods,
  rxArgumentHasStrategyAndMethods,
} from "@/lib/llm/pro/delivery/rx-argument-shape";
import { buildDeliveryBookModules } from "@/lib/poju/build-delivery-book-modules";

{
  const body = composeRxArgumentBody({
    title: "用神借势",
    strategy: "以你的结构，这件事该先补稳住再谈冲杀。",
    methods: "决策时多用北向安静区，夜间深度思考，找沉稳搭档接一线。",
  });
  assert.match(body, /\*\*策略:\*\*/);
  assert.match(body, /\*\*手段:\*\*/);
  const parsed = parseRxStrategyMethods(body.replace(/^###[^\n]+\n+/, ""));
  assert.ok(parsed.strategy?.includes("先补稳住"));
  assert.ok(parsed.methods?.includes("北向"));
  assert.equal(rxArgumentHasStrategyAndMethods({ body }), true);
}

{
  const args = coerceDeliveryArguments([
    {
      title: "角色边界",
      strategy: "只抓供应链关键决策，其余不亲自冲一线。",
      methods: "设月出差上限与每周两次远程辅导，试点三个月。",
    },
  ]);
  assert.equal(args.length, 1);
  assert.match(args[0]!.body, /### 角色边界/);
  assert.equal(rxArgumentHasStrategyAndMethods(args[0]!), true);
}

{
  const composed = composeRxArgumentBody({
    title: "仪表打法",
    strategy: "续航偏低时先降消耗再谈扩张。",
    methods: "用深蓝视觉锚与高频时段稳住判断。",
  });
  const mods = buildDeliveryBookModules({
    pageTitle: "东方药方：策略与手段",
    body: composed,
    dualLayer: false,
    pageIndex: 3,
  });
  assert.equal(mods.length, 1);
  assert.equal(mods[0]!.title, "仪表打法");
  assert.ok(mods[0]!.strategy?.includes("续航偏低"));
  assert.ok(mods[0]!.methods?.includes("深蓝"));
}

console.log("test-delivery-rx-argument-shape: ok");
