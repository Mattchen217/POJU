const fs = require("fs");

function patchMemoryKv() {
  const path = "lib/kv/memory-kv.ts";
  let s = fs.readFileSync(path, "utf8");
  if (s.includes("compareAndDelete")) {
    console.log("MemoryKv: already patched");
    return;
  }
  const marker = "async del(...keys: string[]): Promise<number> {";
  const idx = s.indexOf(marker);
  if (idx < 0) throw new Error("MemoryKv: del() not found");
  const retIdx = s.indexOf("return n;", idx);
  const endIdx = s.indexOf("}", retIdx) + 1;
  const method = `

  /**
   * Token-checked compare-and-delete (atomic in-process).
   * Value may be a claim record \`{ token }\` or a bare token string.
   */
  async compareAndDelete(key: string, expectedToken: string): Promise<boolean> {
    const hit = this.store.get(key);
    if (!hit) return false;
    if (hit.expiresAt != null && hit.expiresAt <= now()) {
      this.store.delete(key);
      return false;
    }
    const value = hit.value;
    let token: string | null = null;
    if (typeof value === "string") token = value;
    else if (
      value &&
      typeof value === "object" &&
      typeof (value as { token?: unknown }).token === "string"
    ) {
      token = (value as { token: string }).token;
    }
    if (!token || token !== expectedToken) return false;
    this.store.delete(key);
    this.lists.delete(key);
    return true;
  }`;
  fs.writeFileSync(path, s.slice(0, endIdx) + method + s.slice(endIdx));
  console.log("MemoryKv: patched");
}

patchMemoryKv();
