from pathlib import Path
p = Path("lib/poju/session-authority/store.ts")
t = p.read_text(encoding="utf-8")
old = "export const SESSION_AUTHORITY_CAS_LUA = `\nlocal function decode(raw)"
new = "export const SESSION_AUTHORITY_CAS_LUA = `\n-- Hash policy: this script does not recompute canonicalHash / SHA-256 of\n-- session_snapshot. Exact JS JSON.stringify + SHA-256 parity cannot be\n-- implemented safely in Redis Lua (cjson cannot faithfully distinguish []\n-- from {}, and number/unicode encoding may diverge). The production Redis\n-- adapter runs inspectStoredSessionRecord (canonicalHash) before EVAL.\n-- Lua still fail-closes on structural Record integrity and ledger probe\n-- failures and never treats a corrupted Record as missing.\nlocal function decode(raw)"
if old not in t:
    raise SystemExit("lua start not found")
p.write_text(t.replace(old, new, 1), encoding="utf-8", newline="\n")
print("lua comment inserted")