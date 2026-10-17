import subprocess
from pathlib import Path

for sha in ["e93d3fd6", "343f9580", "3abbb85a", "b195745c", "4281b785"]:
    p = subprocess.run(["git", "show", f"{sha}:public/v2-landing.html"], capture_output=True)
    t = p.stdout.decode("utf-8", "replace")
    Path(f"temp/_land_{sha[:7]}.html").write_text(t, encoding="utf-8")
    i = t.find('id="v2-scenarios"')
    j = t.find('id="v2-product-preview"')
    print(sha, "scenarios", i, "product", j)
    if i >= 0:
        # back up to section start
        start = t.rfind("<section", 0, i + 1)
        Path(f"temp/_scen_{sha[:7]}.txt").write_text(t[start:start + 2200], encoding="utf-8")
    # search glass plate classes
    hits = []
    for kw in ["v2-scenarios", "glass", "backdrop-blur", "bg-white/", "bg-slate-900/", "rgba(16"]:
        if kw in t[max(0, i - 500) : i + 3000] if i >= 0 else "":
            hits.append(kw)
    print("  near scenarios:", hits)
print("done")
