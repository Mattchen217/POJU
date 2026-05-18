import type { ThinkingStreamMode } from "@/lib/poju/thinking-stream-mode";

export function getThinkingStreamLines(mode: ThinkingStreamMode, locale: string): string[] {
  const isZh = locale.startsWith("zh");

  if (mode === "flash") {
    return isZh ? ["正在回应…"] : ["Thinking…"];
  }

  if (mode === "collecting") {
    return isZh
      ? [
          "回顾你刚才说的…",
          "梳理你的处境脉络…",
          "思考还需要了解什么…",
          "准备问下一个关键问题…",
        ]
      : [
          "Reviewing what you shared…",
          "Mapping your situation…",
          "Considering what to explore next…",
          "Forming the right question…",
        ];
  }

  if (mode === "analyzing") {
    return isZh
      ? [
          "结合你的命主结构分析…",
          "查看当前大运的影响…",
          "寻找你处境的命理根源…",
          "考察用神在此事中的作用…",
          "推算关键转折时机…",
          "梳理传统调候之道…",
          "整理破局方向…",
        ]
      : [
          "Analyzing with your foundation…",
          "Considering current life phase…",
          "Finding the root in your pattern…",
          "Examining favorable elements at play…",
          "Identifying key timing windows…",
          "Surveying traditional remedies…",
          "Organizing breakthrough paths…",
        ];
  }

  return isZh
    ? [
        "整合所有信息…",
        "深度推演你的破局之道…",
        "结合道家、易理、风水…",
        "编织传统智慧与现代行动…",
        "准备完整方案，请稍候…",
      ]
    : [
        "Integrating everything…",
        "Deep reasoning on your path…",
        "Weaving wisdom and action…",
        "Casting Daoist and feng shui insights…",
        "Preparing your complete reading…",
      ];
}
