from pathlib import Path
p = Path("lib/poju/session-authority/store.ts")
t = p.read_text(encoding="utf-8")
old = """export function decodeLedgerBindingArgs(args: string[]): LedgerBindingSnapshot | null {
  if (args.length < 14) return null;
  const hintRaw = args[9] ?? "";
  const startVersion = Number(args[10]);
  const endVersion = Number(args[11]);
  const count = Number(args[12]);
  if (!Number.isSafeInteger(startVersion) || !Number.isSafeInteger(endVersion) || !Number.isSafeInteger(count)) {
    return null;
  }
  if (args.length < 13 + count) return null;
"""
new = """export function decodeLedgerBindingArgs(args: string[]): LedgerBindingSnapshot | null {
  if (args.length < 13) return null;
  const hintRaw = args[9] ?? "";
  const startVersion = Number(args[10]);
  const endVersion = Number(args[11]);
  const count = Number(args[12]);
  if (!Number.isSafeInteger(startVersion) || !Number.isSafeInteger(endVersion) || !Number.isSafeInteger(count) || count < 0) {
    return null;
  }
  if (args.length < 13 + count) return null;
"""
if old not in t:
    raise SystemExit("decode anchor not found")
p.write_text(t.replace(old, new, 1), encoding="utf-8", newline="\n")
print("patched decodeLedgerBindingArgs")
