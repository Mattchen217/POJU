/**
 * Turn stored base_analysis JSON (or raw LLM text) into readable Chinese for the profile viewer.
 */

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function section(title: string, body: string): string {
  if (!body) return "";
  return `【${title}】\n${body}\n`;
}

function formatList(items: unknown): string {
  if (!Array.isArray(items)) return "";
  return items
    .map((item) => {
      if (typeof item === "string") return `· ${item}`;
      const row = asRecord(item);
      if (!row) return "";
      const parts = Object.entries(row)
        .map(([k, v]) => `${k}：${asString(v) || String(v)}`)
        .filter(Boolean);
      return parts.length ? `· ${parts.join("；")}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function formatNestedObject(obj: Record<string, unknown>, indent = ""): string {
  const lines: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (val == null) continue;
    if (typeof val === "string") {
      lines.push(`${indent}${key}：${val}`);
    } else if (Array.isArray(val)) {
      const list = formatList(val);
      if (list) lines.push(`${indent}${key}：\n${list.split("\n").map((l) => indent + l).join("\n")}`);
    } else if (typeof val === "object") {
      lines.push(`${indent}${key}：`);
      lines.push(formatNestedObject(val as Record<string, unknown>, `${indent}  `));
    }
  }
  return lines.filter(Boolean).join("\n");
}

/** Prefer display_text / structured JSON; fall back to legacy content. */
export function formatBaseAnalysisForDisplay(input: {
  content: unknown;
  display_text?: string | null;
  raw_text?: string | null;
}): string {
  if (input.display_text?.trim()) {
    return input.display_text.trim();
  }
  const raw = input.raw_text?.trim() ?? "";
  if (typeof input.content === "string" && input.content.trim()) {
    return input.content.trim();
  }
  const root = asRecord(input.content);

  if (!root) {
    return raw || "（暂无命盘分析文本）";
  }

  if (asString(root.展示文本)) {
    return asString(root.展示文本);
  }

  const parts: string[] = [];

  const meta = asRecord(root._meta);
  if (meta?.storage === "raw_fallback" || meta?.parse_ok === false) {
    parts.push("（以下为模型原文，JSON 自动解析未完全成功，内容仍完整保留）\n");
  }

  const base = asRecord(root.命主基础);
  if (base) {
    parts.push(section("命主基础", asString(base.日主分析)));
    const pattern = asRecord(base.格局判断);
    if (pattern) parts.push(section("格局判断", formatNestedObject(pattern)));
    const yong = asRecord(base.用神忌神);
    if (yong) parts.push(section("用神忌神", formatNestedObject(yong)));
    if (asString(base.强弱定性)) parts.push(section("强弱定性", asString(base.强弱定性)));
    const highlights = formatList(base.命局亮点);
    if (highlights) parts.push(section("命局亮点", highlights));
    const risks = formatList(base.命局隐忧);
    if (risks) parts.push(section("命局隐忧", risks));
  }

  const personality = asRecord(root.性格画像);
  if (personality) parts.push(section("性格画像", formatNestedObject(personality)));

  const life = asRecord(root.人生主题);
  if (life) parts.push(section("人生主题", formatNestedObject(life)));

  const dayun = asRecord(root.大运全程);
  if (dayun) parts.push(section("大运全程", formatNestedObject(dayun)));

  const current = asRecord(root.当前大运详解);
  if (current) parts.push(section("当前大运详解", formatNestedObject(current)));

  const tune = asRecord(root.传统调候建议);
  if (tune) parts.push(section("传统调候建议", formatNestedObject(tune)));

  const structured = parts.join("\n").trim();
  if (structured.length > 80) return structured;

  if (raw) return raw;
  try {
    return JSON.stringify(root, null, 2);
  } catch {
    return "（暂无命盘分析文本）";
  }
}
