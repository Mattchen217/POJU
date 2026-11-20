from pathlib import Path
import re
lines=Path("scripts/test-m1-production-adaptive-question-loop.ts").read_text(encoding="utf-8").splitlines()
idxs=[i for i,l in enumerate(lines) if "extracted_items:" in l or "extracted_items :" in l]
out=[]
for n,i in enumerate(idxs):
    name="?"
    for j in range(i, max(-1,i-120), -1):
        m=re.search(r'await check\("([^"]+)"', lines[j])
        if m:
            name=m.group(1)
            break
        m=re.search(r'async function (\w+)', lines[j])
        if m and name=="?":
            name="fn:"+m.group(1)
            break
    chunk="\n".join(lines[i:min(len(lines),i+40)])
    item_texts=re.findall(r'text:\s*"([^"]*)"', chunk)
    out.append("%2d L%d %s" % (n+1, i+1, name))
    out.append("   item_texts: %s" % item_texts)
Path("temp/_fu8_draft_summary.txt").write_text("\n".join(out), encoding="utf-8")
print("\n".join(out))
