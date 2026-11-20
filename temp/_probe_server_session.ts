import { loadPOJUSession } from "@/lib/poju/session-manager";

async function main() {
  try {
    const s = await loadPOJUSession("probe-session-id");
    console.log("RESULT", s === null ? "null" : "session");
  } catch (e) {
    console.log("THROWS", e instanceof Error ? `${e.name}: ${e.message}` : String(e));
  }
}
void main();
