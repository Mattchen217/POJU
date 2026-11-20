from pathlib import Path
p = Path("temp/_fu2_write_evidence.py")
t = p.read_text(encoding="utf-8")
t = t.replace("from datetime import datetime\nfrom zoneinfo import ZoneInfo\n", "from datetime import datetime, timezone, timedelta\n")
t = t.replace(
    'now = datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%d %H:%M:%S %z (America/Chicago)")',
    'now = datetime.now(timezone(timedelta(hours=-6))).strftime("%Y-%m-%d %H:%M:%S %z (America/Chicago)")',
)
p.write_text(t, encoding="utf-8")
print("patched")
print("\n".join(t.splitlines()[:16]))
