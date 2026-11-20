from pathlib import Path
import re
text = Path(r"D:\POJU\pojulife\lib\poju\decision-context\production-dc-lifecycle.ts").read_text(encoding="utf-8")
m = re.search(r"export async function persistDcLifecycleChange[\s\S]{0,800}", text)
print(m.group(0) if m else "NOT FOUND")
